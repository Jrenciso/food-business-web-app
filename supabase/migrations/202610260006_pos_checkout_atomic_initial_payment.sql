begin;

-- Finalize one newly created POS ticket, optionally appending its first payment,
-- in one locked workspace write. A failed payment rolls the order back too.
create or replace function public.finalize_pos_checkout(
  p_business_id uuid,
  p_expected_revision bigint,
  p_next jsonb,
  p_payment jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.business_memberships%rowtype;
  v_state public.workspace_state%rowtype;
  v_response jsonb;
  v_unpaid jsonb;
  v_final jsonb;
  v_order jsonb;
  v_paid_order jsonb;
  v_payment jsonb;
  v_method jsonb;
  v_day jsonb;
  v_order_id text;
  v_order_count integer;
  v_paid bigint;
  v_refunds bigint;
  v_remaining bigint;
  v_amount bigint;
  v_tendered bigint;
  v_change bigint;
  v_cash_confirmed boolean;
  v_register_enabled boolean;
  v_business_date date;
begin
  select * into v_member
    from public.business_memberships
    where business_id=p_business_id and user_id=auth.uid() and active;
  if not found or v_member.role<>'owner' or public.staff_password_change_required() then
    raise exception 'Owner access required' using errcode='42501';
  end if;

  select response into v_response from public.operation_request
    where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;

  select * into v_state from public.workspace_state
    where business_id=p_business_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  select response into v_response from public.operation_request
    where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  if v_state.revision<>p_expected_revision then
    raise exception 'Workspace changed on another device. Refresh and review before saving.' using errcode='40001';
  end if;

  select count(*) into v_order_count from jsonb_array_elements(coalesce(p_next->'orders','[]'::jsonb)) as n(value)
    where not exists(select 1 from jsonb_array_elements(coalesce(v_state.data->'orders','[]'::jsonb)) o
      where o.value->>'id'=n.value->>'id');
  if v_order_count<>1 then raise exception 'Checkout must add exactly one new ticket'; end if;
  select n.value into v_order from jsonb_array_elements(p_next->'orders') as n(value)
    where not exists(select 1 from jsonb_array_elements(coalesce(v_state.data->'orders','[]'::jsonb)) as old(value)
      where old.value->>'id'=n.value->>'id');
  if v_order is null or v_order->>'status'<>'New' or
     jsonb_array_length(coalesce(v_order->'payments','[]'::jsonb))<>0 then
    raise exception 'Checkout ticket must start new and unpaid';
  end if;
  v_order_id:=v_order->>'id';
  perform public.validate_operations_change(p_business_id,v_state.data,p_next,'pos',v_member.role,
    coalesce(v_member.employee_id,''));
  v_unpaid:=p_next;

  if p_payment is not null and p_payment<>'null'::jsonb then
    v_amount:=nullif(p_payment->>'amount','')::bigint;
    if v_amount is null or v_amount<=0 then raise exception 'Payment amount must be positive'; end if;
    select value into v_method from jsonb_array_elements(coalesce(v_state.data#>'{settings,paymentMethods}','[]'::jsonb)) m
      where m->>'id'=p_payment->>'method' and m->>'active'='true';
    if v_method is null then raise exception 'Choose an enabled payment method'; end if;
    if length(coalesce(p_payment->>'reference',''))>120 then raise exception 'Reference is too long'; end if;

    select coalesce(sum((value->>'amount')::bigint) filter(where value->>'kind'='payment'),0),
           coalesce(sum((value->>'amount')::bigint) filter(where value->>'kind'='refund'),0)
      into v_paid,v_refunds from jsonb_array_elements(coalesce(v_order->'payments','[]'::jsonb));
    v_remaining:=(v_order->>'total')::bigint-v_paid+v_refunds;
    if v_amount>v_remaining then raise exception 'Payment exceeds remaining balance'; end if;

    v_register_enabled:=coalesce(v_state.data#>>'{settings,modules,register}','false')='true';
    v_business_date:=public.business_operating_date(v_state.data->'settings',now());
    if v_register_enabled then
      select value into v_day from jsonb_array_elements(coalesce(v_state.data->'businessDays','[]'::jsonb)) days
      where days.value->>'state'='accepting' and days.value->>'businessDate'=v_business_date::text
        order by (days.value->>'openedAt')::timestamptz desc limit 1;
      if v_day is null then raise exception 'Open register session is required before recording this payment'; end if;
    end if;

    v_cash_confirmed:=coalesce((p_payment->>'cashConfirmed')::boolean,false);
    if p_payment->>'method'='cash' then
      v_tendered:=nullif(p_payment->>'tenderedAmount','')::bigint;
      v_change:=nullif(p_payment->>'changeAmount','')::bigint;
      if not v_cash_confirmed or v_tendered is null or v_tendered<v_amount or
         v_change is distinct from v_tendered-v_amount then
        raise exception 'Confirm cash received and change returned';
      end if;
    elsif p_payment ? 'tenderedAmount' or p_payment ? 'changeAmount' or v_cash_confirmed then
      raise exception 'Non-cash payment cannot have tender or change';
    end if;

    v_payment:=jsonb_build_object(
      'id',gen_random_uuid()::text,
      'amount',v_amount,
      'method',v_method->>'id',
      'methodLabel',v_method->>'label',
      'reference',trim(coalesce(p_payment->>'reference','')),
      'at',now(),
      'kind','payment',
      'receivedById',coalesce(v_member.employee_id,''),
      'receivedByName',v_member.display_name,
      'receivedByRole',v_member.role,
      'custody',case when p_payment->>'method'='cash' and v_register_enabled then 'register' else 'external' end,
      'locationId',coalesce(v_day->>'locationId','default-location'),
      'businessDate',v_business_date::text
    );
    if v_register_enabled then v_payment:=v_payment||jsonb_build_object('registerSessionId',v_day->>'registerSessionId'); end if;
    if p_payment->>'method'='cash' then
      v_payment:=v_payment||jsonb_build_object('tenderedAmount',v_tendered,'changeAmount',v_change,'cashConfirmed',true);
    end if;
    v_paid_order:=jsonb_set(v_order,'{payments}',jsonb_build_array(v_payment),true);
    v_final:=jsonb_set(v_unpaid,'{orders}',(
      select jsonb_agg(case when value->>'id'=v_order_id then v_paid_order else value end order by ordinality)
      from jsonb_array_elements(v_unpaid->'orders') with ordinality
    ),true);
    perform public.validate_operations_change(p_business_id,v_unpaid,v_final,'payment',v_member.role,
      coalesce(v_member.employee_id,''));
  else
    v_final:=v_unpaid;
  end if;

  v_final:=jsonb_set(v_final,'{activity}','[]'::jsonb,true);
  perform public.rebuild_operations_indexes(p_business_id,v_final);
  update public.workspace_state set data=v_final,revision=revision+1,updated_at=now()
    where business_id=p_business_id;
  v_response:=public.read_operations(p_business_id);
  insert into public.operation_request(business_id,request_id,revision,response)
    values(p_business_id,p_request_id,v_state.revision+1,v_response);
  return v_response;
end;
$$;

revoke all on function public.finalize_pos_checkout(uuid,bigint,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.finalize_pos_checkout(uuid,bigint,jsonb,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
