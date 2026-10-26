begin;

-- Keep persisted payment writes within the remaining order balance even for
-- legacy tickets whose only payment summary is paidAmount. New writes remain
-- append-only and existing history is left untouched.
create or replace function public.validate_order_payment_balance()
returns trigger language plpgsql set search_path='' as $$
declare v_order jsonb; v_old_order jsonb; v_payment jsonb; v_old_count integer;
  v_existing_count integer; v_collected bigint; v_remaining bigint;
begin
  if tg_op<>'UPDATE' then return new; end if;
  for v_order in select value from jsonb_array_elements(coalesce(new.data->'orders','[]'::jsonb)) as orders(value) loop
    select value into v_old_order
      from jsonb_array_elements(coalesce(old.data->'orders','[]'::jsonb)) as orders(value)
      where value->>'id'=v_order->>'id';
    if v_old_order is null then continue; end if;
    v_old_count:=jsonb_array_length(coalesce(v_old_order->'payments','[]'::jsonb));
    if jsonb_array_length(coalesce(v_order->'payments','[]'::jsonb))<=v_old_count then continue; end if;

    select count(*)::integer,
      coalesce(sum(case when value->>'kind'='refund' then -(value->>'amount')::bigint
                        else (value->>'amount')::bigint end),0)
      into v_existing_count,v_collected
      from jsonb_array_elements(coalesce(v_old_order->'payments','[]'::jsonb)) as payments(value);
    if v_existing_count=0 then v_collected:=coalesce((v_old_order->>'paidAmount')::bigint,0); end if;

    for v_payment in
      select value from jsonb_array_elements(coalesce(v_order->'payments','[]'::jsonb))
        with ordinality as payments(value,ordinality)
      where ordinality>v_old_count order by ordinality
    loop
      if v_payment->>'kind'='payment' then
        v_remaining:=greatest(0,(v_old_order->>'total')::bigint-v_collected);
        if (v_payment->>'amount') is null or (v_payment->>'amount')::bigint<=0 or
           (v_payment->>'amount')::bigint>v_remaining then
          raise exception 'Payment exceeds remaining balance';
        end if;
        v_collected:=v_collected+(v_payment->>'amount')::bigint;
      end if;
    end loop;
  end loop;
  return new;
end $$;

drop trigger if exists workspace_payment_balance_guard on public.workspace_state;
create trigger workspace_payment_balance_guard
before update of data on public.workspace_state
for each row execute function public.validate_order_payment_balance();

create or replace function public.record_rider_collection_v2(p_business_id uuid,p_order_id text,
  p_amount bigint,p_method text,p_reference text,p_tendered bigint,p_change bigint,
  p_cash_confirmed boolean,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
  v_order jsonb; v_method jsonb; v_paid bigint; v_payment jsonb; v_next jsonb; v_response jsonb;
  v_existing_count integer;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id
    and user_id=auth.uid() and active and role='rider';
  if not found or public.staff_password_change_required() then
    raise exception 'Access denied' using errcode='42501'; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  select response into v_response from public.operation_request
    where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  select value into v_order from jsonb_array_elements(v_state.data->'orders')
    where value->>'id'=p_order_id;
  if v_order is null or v_order->>'riderId' is distinct from v_member.employee_id or
     v_order->>'type'<>'delivery' or v_order->>'status' not in ('Picked up','Out for delivery','Completed') then
    raise exception 'Assigned delivery is not eligible' using errcode='42501'; end if;
  select value into v_method from jsonb_array_elements(
    coalesce(v_state.data#>'{settings,paymentMethods}','[]'::jsonb))
    where value->>'id'=p_method and value->>'active'='true';
  if v_method is null then raise exception 'Choose an enabled payment method'; end if;

  select count(*)::integer,
    coalesce(sum(case when value->>'kind'='refund' then -(value->>'amount')::bigint
                      else (value->>'amount')::bigint end),0)
    into v_existing_count,v_paid
    from jsonb_array_elements(coalesce(v_order->'payments','[]'::jsonb)) as payments(value);
  if v_existing_count=0 then v_paid:=coalesce((v_order->>'paidAmount')::bigint,0); end if;
  if p_amount is null or p_amount<=0 or
     p_amount>greatest(0,(v_order->>'total')::bigint-v_paid) then
    raise exception 'Amount exceeds remaining balance'; end if;
  if p_method='cash' then
    if p_cash_confirmed is distinct from true or p_tendered is null or p_tendered<p_amount or
       p_change is distinct from p_tendered-p_amount then
      raise exception 'Confirm cash received and change returned'; end if;
  elsif p_tendered is not null or p_change is not null or p_cash_confirmed then
    raise exception 'Non-cash payment cannot have tender or change'; end if;
  if length(coalesce(p_reference,''))>120 then raise exception 'Reference is too long'; end if;

  v_payment:=jsonb_build_object('id',gen_random_uuid()::text,'amount',p_amount,'method',p_method,
    'methodLabel',v_method->>'label','reference',trim(coalesce(p_reference,'')),'at',now(),
    'kind','payment','receivedById',v_member.employee_id,'receivedByName',v_member.display_name,
    'receivedByRole','rider','custody',case when p_method='cash' then 'rider' else 'external' end,
    'locationId','default-location','businessDate',to_char(now() at time zone
      coalesce(nullif(v_state.data#>>'{settings,timezone}',''),'Asia/Manila'),'YYYY-MM-DD'));
  if p_method='cash' then
    v_payment:=v_payment||jsonb_build_object('tenderedAmount',p_tendered,
      'changeAmount',p_change,'cashConfirmed',true);
  end if;
  v_order:=jsonb_set(v_order,'{payments}',
    coalesce(v_order->'payments','[]'::jsonb)||jsonb_build_array(v_payment));
  select jsonb_set(v_state.data,'{orders}',jsonb_agg(
    case when value->>'id'=p_order_id then v_order else value end))
    into v_next from jsonb_array_elements(v_state.data->'orders');
  perform public.rebuild_operations_indexes(p_business_id,v_next);
  update public.workspace_state set data=v_next,revision=revision+1,updated_at=now()
    where business_id=p_business_id;
  v_response:=jsonb_build_object('payment',v_payment,
    'remaining',greatest(0,(v_order->>'total')::bigint-v_paid-p_amount));
  insert into public.operation_request(business_id,request_id,revision,response)
    values(p_business_id,p_request_id,v_state.revision+1,v_response);
  return v_response;
end $$;
revoke all on function public.record_rider_collection_v2(uuid,text,bigint,text,text,bigint,bigint,boolean,uuid)
  from public,anon;
grant execute on function public.record_rider_collection_v2(uuid,text,bigint,text,text,bigint,bigint,boolean,uuid)
  to authenticated;

notify pgrst,'reload schema';
commit;
