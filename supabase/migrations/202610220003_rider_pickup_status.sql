-- Apply staff ticket-status changes against the stored order instead of the
-- redacted/enriched projection returned to non-owner clients. The existing
-- validator enforces this transition matrix: owner may manage ticket statuses;
-- chef/kitchen may move New -> Preparing -> Ready and mark pickup tickets
-- Picked up; an assigned rider may move a delivery Ready -> Picked up -> Out
-- for delivery -> Completed.
begin;

create or replace function public.apply_operations(
  p_business_id uuid,p_expected_revision bigint,p_action text,p_next jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
        v_response jsonb; v_next jsonb; v_order jsonb; v_old_order jsonb;
        v_orders jsonb; v_change_count integer:=0; v_old_history jsonb; v_new_history jsonb;
        v_previous_at timestamptz; v_new_at timestamptz; v_transition_allowed boolean;
begin
  select * into v_member from public.business_memberships
    where business_id=p_business_id and user_id=auth.uid() and active;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if public.staff_password_change_required() then
    raise exception 'Password change required' using errcode='42501';
  end if;
  select response into v_response from public.operation_request
    where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  select response into v_response from public.operation_request
    where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  if v_state.revision<>p_expected_revision then
    raise exception 'Workspace changed on another device. Refresh and review before saving.' using errcode='40001';
  end if;
  v_next:=p_next;
  if v_member.role<>'owner' then
    -- Rider read_operations deliberately returns only deliveries assigned to
    -- this rider. Accept that filtered list; never require the browser to send
    -- every business order back to the database.
    if jsonb_typeof(p_next->'orders')<>'array' or
       jsonb_array_length(p_next->'orders')>jsonb_array_length(v_state.data->'orders') or
       (select count(distinct value->>'id') from jsonb_array_elements(p_next->'orders'))<>
         jsonb_array_length(p_next->'orders') then
      raise exception 'Staff may only change ticket status' using errcode='42501';
    end if;
    v_orders:=v_state.data->'orders';
    for v_order in select value from jsonb_array_elements(p_next->'orders') loop
      select value into v_old_order from jsonb_array_elements(v_state.data->'orders')
        where value->>'id'=v_order->>'id';
      if v_old_order is null then raise exception 'Ticket not found' using errcode='42501'; end if;
      -- Riders receive a deliberately filtered order snapshot (private notes are
      -- removed and payment totals are added). Accept only the requested status
      -- fields and rebuild the order from the authoritative stored version.
      if v_order->'status' is distinct from v_old_order->'status' or
         v_order->'statusHistory' is distinct from v_old_order->'statusHistory' then
        v_change_count:=v_change_count+1;
        if jsonb_typeof(v_order->'status')<>'string' or
           jsonb_typeof(v_order->'statusHistory')<>'array' then
          raise exception 'Invalid ticket status update' using errcode='42501';
        end if;
        v_old_history:=coalesce(v_old_order->'statusHistory','[]'::jsonb);
        v_new_history:=v_order->'statusHistory';
        if jsonb_array_length(v_new_history)<>jsonb_array_length(v_old_history)+1 or
           (v_new_history - (jsonb_array_length(v_new_history)-1))<>v_old_history or
           v_new_history->(jsonb_array_length(v_new_history)-1)->>'status'<>v_order->>'status' or
           nullif(v_new_history->(jsonb_array_length(v_new_history)-1)->>'at','') is null then
          raise exception 'Status history must append exactly one matching event' using errcode='42501';
        end if;
        v_new_at:=(v_new_history->(jsonb_array_length(v_new_history)-1)->>'at')::timestamptz;
        if jsonb_array_length(v_old_history)>0 then
          v_previous_at:=(v_old_history->(jsonb_array_length(v_old_history)-1)->>'at')::timestamptz;
          if v_new_at<=v_previous_at then raise exception 'Status timestamp must move forward' using errcode='42501'; end if;
        end if;
        v_transition_allowed:=case
          when v_member.role in ('chef','kitchen') then p_action='prep' and (
            (v_old_order->>'status'='New' and v_order->>'status'='Preparing') or
            (v_old_order->>'status'='Preparing' and v_order->>'status'='Ready') or
            (v_old_order->>'status'='Ready' and v_order->>'status'='Picked up'))
          when v_member.role='rider' then p_action='deliver' and
            v_old_order->>'type'='delivery' and v_old_order->>'riderId'=v_member.employee_id and (
            (v_old_order->>'status'='Ready' and v_order->>'status'='Picked up') or
            (v_old_order->>'status'='Picked up' and v_order->>'status'='Out for delivery') or
            (v_old_order->>'status'='Out for delivery' and v_order->>'status'='Completed'))
          else false end;
        if not coalesce(v_transition_allowed,false) then
          raise exception 'This role cannot make that ticket status transition' using errcode='42501';
        end if;
        v_order:=jsonb_set(jsonb_set(v_old_order,'{status}',v_order->'status'),
          '{statusHistory}',v_order->'statusHistory');
        select jsonb_agg(case when value->>'id'=v_order->>'id' then v_order else value end)
          into v_orders from jsonb_array_elements(v_orders);
      end if;
    end loop;
    if v_change_count<>1 then raise exception 'One ticket update is required'; end if;
    v_next:=jsonb_set(v_state.data,'{orders}',v_orders);
  end if;
  if v_member.role='owner' then
    perform public.validate_operations_change(p_business_id,v_state.data,v_next,p_action,
      v_member.role,v_member.employee_id);
  end if;
  v_next:=jsonb_set(v_next,'{activity}','[]'::jsonb,true);
  perform public.rebuild_operations_indexes(p_business_id,v_next);
  update public.workspace_state set data=v_next,revision=revision+1,updated_at=now()
    where business_id=p_business_id;
  update public.businesses set name=coalesce(nullif(v_next#>>'{settings,businessName}',''),name),updated_at=now()
    where id=p_business_id;
  v_response:=public.read_operations(p_business_id);
  insert into public.operation_request(business_id,request_id,revision,response)
    values(p_business_id,p_request_id,v_state.revision+1,v_response);
  return v_response;
end $$;
revoke all on function public.apply_operations(uuid,bigint,text,jsonb,uuid) from public,anon;
grant execute on function public.apply_operations(uuid,bigint,text,jsonb,uuid) to authenticated;

-- A rider may record an additional collection while completing or after
-- completing an assigned delivery. Payments remain append-only ledger entries;
-- their method/reference/amount are retained and the remaining balance updates.
create or replace function public.record_rider_collection(p_business_id uuid,p_order_id text,
  p_amount bigint,p_method text,p_reference text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
  v_order jsonb; v_method jsonb; v_paid bigint; v_payment jsonb; v_next jsonb; v_response jsonb;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id
    and user_id=auth.uid() and active and role='rider';
  if not found or public.staff_password_change_required() then
    raise exception 'Access denied' using errcode='42501';
  end if;
  select * into v_state from public.workspace_state where business_id=p_business_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  select response into v_response from public.operation_request
    where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  select value into v_order from jsonb_array_elements(v_state.data->'orders') where value->>'id'=p_order_id;
  if v_order is null or v_order->>'riderId' is distinct from v_member.employee_id
      or v_order->>'type'<>'delivery'
      or v_order->>'status' not in ('Picked up','Out for delivery','Completed') then
    raise exception 'Assigned delivery is not eligible' using errcode='42501';
  end if;
  select value into v_method from jsonb_array_elements(coalesce(v_state.data#>'{settings,paymentMethods}','[]'::jsonb))
    where value->>'id'=p_method and value->>'active'='true';
  if v_method is null then raise exception 'Choose an enabled payment method'; end if;
  select coalesce(sum(case when value->>'kind'='refund' then -(value->>'amount')::bigint
    else (value->>'amount')::bigint end),0)
    into v_paid from jsonb_array_elements(coalesce(v_order->'payments','[]'::jsonb));
  if p_amount is null or p_amount<=0 or p_amount>(v_order->>'total')::bigint-v_paid then
    raise exception 'Amount exceeds remaining balance';
  end if;
  if length(coalesce(p_reference,''))>120 then raise exception 'Reference is too long'; end if;
  v_payment:=jsonb_build_object('id',gen_random_uuid()::text,'amount',p_amount,'method',p_method,
    'methodLabel',v_method->>'label','reference',trim(coalesce(p_reference,'')),'at',now(),
    'kind','payment','receivedById',v_member.employee_id,'receivedByName',v_member.display_name,
    'receivedByRole','rider');
  v_order:=jsonb_set(v_order,'{payments}',coalesce(v_order->'payments','[]'::jsonb)||jsonb_build_array(v_payment));
  select jsonb_set(v_state.data,'{orders}',jsonb_agg(case when value->>'id'=p_order_id then v_order else value end))
    into v_next from jsonb_array_elements(v_state.data->'orders');
  perform public.rebuild_operations_indexes(p_business_id,v_next);
  update public.workspace_state set data=v_next,revision=revision+1,updated_at=now() where business_id=p_business_id;
  v_response:=jsonb_build_object('payment',v_payment,'remaining',(v_order->>'total')::bigint-v_paid-p_amount);
  insert into public.operation_request(business_id,request_id,revision,response)
    values(p_business_id,p_request_id,v_state.revision+1,v_response);
  return v_response;
end $$;
revoke all on function public.record_rider_collection(uuid,text,bigint,text,text,uuid) from public,anon;
grant execute on function public.record_rider_collection(uuid,text,bigint,text,text,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
