begin;

-- Reinstall the custody guard with seed-tagged orders excluded from real rider cash.
create or replace function public.validate_operations_change(
  p_business_id uuid,p_old jsonb,p_new jsonb,p_action text,p_role text,p_employee_id text)
returns void language plpgsql security definer set search_path='' as $$
declare v_move jsonb; v_collected bigint; v_handed bigint;
begin
  perform public.validate_operations_change_before_custody_guard(
    p_business_id,p_old,p_new,p_action,p_role,p_employee_id);
  if p_action <> 'register' then return; end if;

  for v_move in
    select m.value from jsonb_array_elements(coalesce(p_new->'cashMovements','[]'::jsonb)) m
    where not exists (
      select 1 from jsonb_array_elements(coalesce(p_old->'cashMovements','[]'::jsonb)) prior
      where prior.value->>'id'=m.value->>'id')
  loop
    if not (case v_move->>'kind'
      when 'cash-in' then v_move->>'fromCustody'='external' and v_move->>'toCustody'='register'
      when 'cash-out' then v_move->>'fromCustody'='register' and v_move->>'toCustody'='external'
      when 'transfer' then v_move->>'fromCustody'='register' and v_move->>'toCustody' in ('safe','owner')
      when 'rider-handover' then v_move->>'fromCustody'='rider' and v_move->>'toCustody'='register'
      else false end) then
      raise exception 'Invalid cash custody movement';
    end if;
    if v_move->>'kind'='rider-handover' then
      select coalesce(sum(case when payment.value->>'kind'='refund' then -1 else 1 end *
        (payment.value->>'amount')::bigint),0) into v_collected
      from jsonb_array_elements(coalesce(p_old->'orders','[]'::jsonb)) ticket
      cross join lateral jsonb_array_elements(coalesce(ticket.value->'payments','[]'::jsonb)) payment
      where coalesce(ticket.value->>'sample','false')<>'true'
        and coalesce(ticket.value->>'testDataSeed','')=''
        and payment.value->>'method'='cash' and payment.value->>'custody'='rider'
        and payment.value->>'receivedById'=v_move->>'riderId'
        and coalesce(payment.value->>'isTest','false')<>'true';
      select coalesce(sum((prior.value->>'amount')::bigint),0) into v_handed
      from jsonb_array_elements(coalesce(p_old->'cashMovements','[]'::jsonb)) prior
      where prior.value->>'kind'='rider-handover'
        and prior.value->>'riderId'=v_move->>'riderId'
        and coalesce(prior.value->>'isTest','false')<>'true';
      if (v_move->>'amount')::bigint>v_collected-v_handed then
        raise exception 'Rider handover exceeds cash held';
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.validate_operations_change(uuid,jsonb,jsonb,text,text,text)
  from public,anon,authenticated;

notify pgrst,'reload schema';
commit;


