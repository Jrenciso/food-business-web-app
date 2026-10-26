begin;

create or replace function public.business_operating_date(p_settings jsonb,p_at timestamptz)
returns date language plpgsql stable set search_path='' as $$
declare v_zone text:=coalesce(nullif(p_settings->>'timezone',''),'Asia/Manila');
  v_cutoff time:=coalesce(nullif(p_settings->>'businessDayCutoff',''),'00:00')::time;
  v_local timestamp;
begin
  v_local:=p_at at time zone v_zone;
  return v_local::date-case when v_local::time<v_cutoff then 1 else 0 end;
end $$;
revoke all on function public.business_operating_date(jsonb,timestamptz) from public,anon,authenticated;

-- This migration is additive. The workspace row remains the serialized source of
-- truth and existing orders/payments are never rewritten.
alter function public.validate_operations_change(uuid,jsonb,jsonb,text,text,text)
  rename to validate_operations_change_before_register;

create or replace function public.validate_operations_change(
  p_business_id uuid,p_old jsonb,p_new jsonb,p_action text,p_role text,p_employee_id text)
returns void language plpgsql security definer set search_path='' as $$
declare v_module text; v_day jsonb; v_prior jsonb; v_movement jsonb; v_order jsonb;
  v_old_order jsonb; v_payment jsonb; v_entry jsonb; v_old_count integer; v_new_count integer;
begin
  for v_module in select unnest(array['dashboard','register','attendance','payroll','reports','riderTracking']) loop
    if p_new#>array['settings','modules',v_module] is not null and
       jsonb_typeof(p_new#>array['settings','modules',v_module])<>'boolean' then
      raise exception 'Invalid module setting for %',v_module;
    end if;
  end loop;
  if p_action='settings' and p_role='owner' then
    if coalesce(p_old#>>'{settings,modules,register}','false')='true' and
       coalesce(p_new#>>'{settings,modules,register}','false')='false' and exists(
       select 1 from jsonb_array_elements(coalesce(p_old->'businessDays','[]'::jsonb)) x
       where x.value->>'state'<>'closed') then raise exception 'Close the current business day before disabling Register'; end if;
  end if;
  if p_action='attendance' and p_old#>>'{settings,modules,attendance}'='false' then raise exception 'Attendance is disabled'; end if;
  if p_action='payroll' and p_old#>>'{settings,modules,payroll}'='false' then raise exception 'Payroll is disabled'; end if;
  if p_action='payroll' and p_old#>>'{settings,modules,attendance}'='false' then
    if p_role<>'owner' or p_new-'manualPayrollEntries'-'cashMovements'-'activity'<>
       p_old-'manualPayrollEntries'-'cashMovements'-'activity' then
      raise exception 'Manual payroll is owner-only' using errcode='42501'; end if;
    v_old_count:=jsonb_array_length(coalesce(p_old->'manualPayrollEntries','[]'::jsonb));
    v_new_count:=jsonb_array_length(coalesce(p_new->'manualPayrollEntries','[]'::jsonb));
    if v_new_count<>v_old_count+1 or not (coalesce(p_new->'manualPayrollEntries','[]'::jsonb)
       @> coalesce(p_old->'manualPayrollEntries','[]'::jsonb)) then raise exception 'Manual payroll is append-only'; end if;
    v_entry:=p_new->'manualPayrollEntries'->(v_new_count-1);
    if (v_entry->>'amount')::bigint<=0 or v_entry->>'from'>v_entry->>'to' or
       not exists(select 1 from jsonb_array_elements(coalesce(p_old->'team','[]'::jsonb)) t
         where t.value->>'id'=v_entry->>'employeeId' and t.value->>'active'='true') or
       not exists(select 1 from jsonb_array_elements(coalesce(p_old#>'{settings,paymentMethods}','[]'::jsonb)) m
         where m.value->>'id'=v_entry->>'method' and m.value->>'active'='true') then
      raise exception 'Invalid manual payroll payment'; end if;
    v_old_count:=jsonb_array_length(coalesce(p_old->'cashMovements','[]'::jsonb));
    v_new_count:=jsonb_array_length(coalesce(p_new->'cashMovements','[]'::jsonb));
    if v_entry->>'method'='cash' and p_old#>>'{settings,modules,register}'='true' then
      if v_new_count<>v_old_count+1 then raise exception 'Payroll cash needs one drawer movement'; end if;
      v_movement:=p_new->'cashMovements'->(v_new_count-1);
      if v_movement->>'id'<>('payroll-'||(v_entry->>'id')) or
         (v_movement->>'amount')::bigint<>(v_entry->>'amount')::bigint or
         v_movement->>'kind'<>'cash-out' or v_movement->>'category'<>'Payroll' or
         v_movement->>'fromCustody'<>'register' then
        raise exception 'Payroll drawer movement is invalid'; end if;
    elsif v_new_count<>v_old_count then raise exception 'Unexpected cash movement'; end if;
    if not (coalesce(p_new->'cashMovements','[]'::jsonb) @> coalesce(p_old->'cashMovements','[]'::jsonb))
      then raise exception 'Existing cash movements cannot change'; end if;
    return;
  end if;
  if p_action='pos' and jsonb_array_length(coalesce(p_new->'orders','[]'::jsonb))>
       jsonb_array_length(coalesce(p_old->'orders','[]'::jsonb)) and
       p_old#>>'{settings,modules,register}'='true' and not exists(
       select 1 from jsonb_array_elements(coalesce(p_old->'businessDays','[]'::jsonb)) x
       where x.value->>'state'='accepting' and x.value->>'businessDate'=
         public.business_operating_date(p_old->'settings',now())::text) then
    raise exception 'New orders are stopped. Open or resume the business day';
  end if;
  if p_action='register' then
    if coalesce(p_old#>>'{settings,modules,register}','false')<>'true' then raise exception 'Register is disabled'; end if;
    if p_role<>'owner' and not exists(select 1 from jsonb_array_elements_text(
      coalesce(p_old#>'{settings,dayControlRoles}','[]'::jsonb)) r where r.value=p_role) then
      raise exception 'Register permission denied' using errcode='42501'; end if;
    if p_new-'businessDays'-'cashMovements'-'activity'<>p_old-'businessDays'-'cashMovements'-'activity'
      then raise exception 'Register action changed unrelated records'; end if;
    if jsonb_array_length(coalesce(p_new->'businessDays','[]'::jsonb)) not between
       jsonb_array_length(coalesce(p_old->'businessDays','[]'::jsonb)) and
       jsonb_array_length(coalesce(p_old->'businessDays','[]'::jsonb))+1 then
      raise exception 'Business day history must be append-only'; end if;
    if jsonb_array_length(coalesce(p_new->'cashMovements','[]'::jsonb)) not between
       jsonb_array_length(coalesce(p_old->'cashMovements','[]'::jsonb)) and
       jsonb_array_length(coalesce(p_old->'cashMovements','[]'::jsonb))+1 then
      raise exception 'Cash movements must be append-only'; end if;
    for v_prior in select value from jsonb_array_elements(coalesce(p_old->'businessDays','[]'::jsonb)) loop
      select value into v_day from jsonb_array_elements(coalesce(p_new->'businessDays','[]'::jsonb))
       where value->>'id'=v_prior->>'id';
      if v_day is null or v_day->>'businessDate'<>v_prior->>'businessDate' or
         v_day->>'openedAt'<>v_prior->>'openedAt' or v_day->>'openedById'<>v_prior->>'openedById' or
         jsonb_array_length(coalesce(v_day->'closeSnapshots','[]'::jsonb))<
         jsonb_array_length(coalesce(v_prior->'closeSnapshots','[]'::jsonb)) or
         not (coalesce(v_day->'closeSnapshots','[]'::jsonb) @> coalesce(v_prior->'closeSnapshots','[]'::jsonb)) or
         (v_prior->>'state'='closed' and v_day->>'state'<>'closed') then
        raise exception 'Saved close history cannot be changed'; end if;
      if v_prior->>'state'='accepting' and v_day->>'state' not in ('accepting','stopped','closed') or
         v_prior->>'state'='stopped' and v_day->>'state' not in ('stopped','accepting','closed') then
        raise exception 'Invalid business-day transition'; end if;
      if v_prior->>'state' is distinct from 'closed' and v_day->>'state'='closed' then
        if jsonb_array_length(coalesce(v_day->'closeSnapshots','[]'::jsonb))<>
           jsonb_array_length(coalesce(v_prior->'closeSnapshots','[]'::jsonb))+1 or
           v_day->>'closedById' is distinct from coalesce(p_employee_id,'') or
           v_day->>'closedAt' is null then raise exception 'Close needs one confirmed snapshot and actor'; end if;
      end if;
      if v_prior->>'state'='closed' and v_day<>v_prior then
        if p_role<>'owner' or jsonb_array_length(coalesce(v_day->'closeSnapshots','[]'::jsonb))<>
           jsonb_array_length(coalesce(v_prior->'closeSnapshots','[]'::jsonb))+1 or
           nullif(trim(v_day->'closeSnapshots'->(jsonb_array_length(v_day->'closeSnapshots')-1)->>'reason'),'') is null
          then raise exception 'Closed report correction needs owner and reason'; end if;
      end if;
    end loop;
    if jsonb_array_length(coalesce(p_new->'businessDays','[]'::jsonb))>
       jsonb_array_length(coalesce(p_old->'businessDays','[]'::jsonb)) then
      v_day:=p_new->'businessDays'->(jsonb_array_length(p_new->'businessDays')-1);
      if v_day->>'state'<>'accepting' or
         v_day->>'businessDate'<>public.business_operating_date(p_old->'settings',now())::text or
         v_day->>'openedById' is distinct from coalesce(p_employee_id,'') or
         (v_day->>'openingFloat')::bigint<0 or
         exists(select 1 from jsonb_array_elements(coalesce(p_old->'businessDays','[]'::jsonb)) x
           where x.value->>'state'<>'closed') then raise exception 'Invalid business-day opening'; end if;
      if exists(select 1 from jsonb_array_elements(coalesce(p_old->'businessDays','[]'::jsonb)) x
           where x.value->>'businessDate'=v_day->>'businessDate') and
         (p_role<>'owner' or nullif(v_day->>'reopenReason','') is null or
          not exists(select 1 from jsonb_array_elements(coalesce(p_old->'businessDays','[]'::jsonb)) x
            where x.value->>'id'=v_day->>'reopenedFromId' and x.value->>'state'='closed')) then
        raise exception 'Reopening a closed date requires the owner and a reason'; end if;
    end if;
    if (select count(*) from jsonb_array_elements(coalesce(p_new->'businessDays','[]'::jsonb)) x
        where x.value->>'state'<>'closed')>1 then raise exception 'Only one business day may be open'; end if;
    if not (coalesce(p_new->'cashMovements','[]'::jsonb) @> coalesce(p_old->'cashMovements','[]'::jsonb))
      then raise exception 'Cash movements cannot be changed'; end if;
    for v_movement in select value from jsonb_array_elements(coalesce(p_new->'cashMovements','[]'::jsonb)) x
      where not exists(select 1 from jsonb_array_elements(coalesce(p_old->'cashMovements','[]'::jsonb)) y
        where y.value->>'id'=x.value->>'id') loop
      if (v_movement->>'amount')::bigint<=0 or v_movement->>'fromCustody'=v_movement->>'toCustody' or
         nullif(trim(v_movement->>'category'),'') is null or nullif(trim(v_movement->>'description'),'') is null
        then raise exception 'Invalid cash movement'; end if;
      if v_movement->>'actorId' is distinct from coalesce(p_employee_id,'') or
         v_movement->>'kind' not in ('cash-in','cash-out','transfer','rider-handover') or
         not exists(select 1 from jsonb_array_elements(coalesce(p_old->'businessDays','[]'::jsonb)) d
           where d.value->>'state'<>'closed' and d.value->>'registerSessionId'=v_movement->>'registerSessionId'
             and d.value->>'businessDate'=v_movement->>'businessDate') then
        raise exception 'Cash movement needs an open register session and actor'; end if;
      if v_movement->>'kind'='cash-in' and lower(v_movement->>'category') in ('sale','customer payment')
        then raise exception 'Customer payments belong on tickets'; end if;
      if v_movement->>'kind'='rider-handover' and (v_movement->>'fromCustody'<>'rider' or
         v_movement->>'toCustody'<>'register' or nullif(v_movement->>'riderId','') is null)
        then raise exception 'Invalid rider cash handover'; end if;
    end loop;
    return;
  end if;
  if p_action='payment' then
    for v_order in select value from jsonb_array_elements(coalesce(p_new->'orders','[]'::jsonb)) loop
      select value into v_old_order from jsonb_array_elements(coalesce(p_old->'orders','[]'::jsonb))
       where value->>'id'=v_order->>'id';
      if v_old_order is not null and jsonb_array_length(coalesce(v_order->'payments','[]'::jsonb))>
         jsonb_array_length(coalesce(v_old_order->'payments','[]'::jsonb)) then
        v_payment:=v_order->'payments'->(jsonb_array_length(v_order->'payments')-1);
        if v_payment->>'kind'='payment' then
          if v_payment->>'method'='cash' then
            if v_payment->>'cashConfirmed'<>'true' or (v_payment->>'tenderedAmount')::bigint<
              (v_payment->>'amount')::bigint or (v_payment->>'changeAmount')::bigint<>
              (v_payment->>'tenderedAmount')::bigint-(v_payment->>'amount')::bigint or
              v_payment->>'custody'<>'register' then raise exception 'Cash tender and change are invalid'; end if;
          elsif v_payment ? 'tenderedAmount' or v_payment ? 'changeAmount' then
            raise exception 'Non-cash payments cannot contain change';
          end if;
        end if;
      end if;
    end loop;
  end if;
  perform public.validate_operations_change_before_register(p_business_id,p_old,p_new,p_action,p_role,p_employee_id);
end $$;
revoke all on function public.validate_operations_change(uuid,jsonb,jsonb,text,text,text) from public,anon,authenticated;

-- Covers staff order RPCs as well as owner saves, including direct updates
-- performed through other protected server functions.
create or replace function public.validate_business_day_write()
returns trigger language plpgsql set search_path='' as $$
declare v_order jsonb; v_prior_order jsonb; v_payment jsonb; v_module text; v_date date;
begin
  for v_module in select unnest(array['dashboard','register','attendance','payroll','reports','riderTracking']) loop
    if new.data#>array['settings','modules',v_module] is not null and
       jsonb_typeof(new.data#>array['settings','modules',v_module])<>'boolean' then
      raise exception 'Invalid module setting for %',v_module;
    end if;
  end loop;
  if tg_op='UPDATE' and new.data#>>'{settings,modules,register}'='true' then
    v_date:=public.business_operating_date(new.data->'settings',now());
    for v_order in select value from jsonb_array_elements(coalesce(new.data->'orders','[]'::jsonb)) x
      where not exists(select 1 from jsonb_array_elements(coalesce(old.data->'orders','[]'::jsonb)) y
        where y.value->>'id'=x.value->>'id') loop
      if not exists(select 1 from jsonb_array_elements(coalesce(old.data->'businessDays','[]'::jsonb)) d
        where d.value->>'state'='accepting' and d.value->>'businessDate'=v_date::text) then
        raise exception 'New orders are stopped. Open or resume the business day';
      end if;
    end loop;
  end if;
  if tg_op='UPDATE' then
    for v_order in select value from jsonb_array_elements(coalesce(new.data->'orders','[]'::jsonb)) loop
      select value into v_prior_order from jsonb_array_elements(coalesce(old.data->'orders','[]'::jsonb)) x
        where x.value->>'id'=v_order->>'id';
      if v_prior_order is not null and jsonb_array_length(coalesce(v_order->'payments','[]'::jsonb))>
         jsonb_array_length(coalesce(v_prior_order->'payments','[]'::jsonb)) then
        v_payment:=v_order->'payments'->(jsonb_array_length(v_order->'payments')-1);
        if v_payment->>'kind'='payment' and v_payment->>'method'='cash' and
           (v_payment->>'cashConfirmed' is distinct from 'true' or
            (v_payment->>'tenderedAmount')::bigint<(v_payment->>'amount')::bigint or
            (v_payment->>'changeAmount')::bigint is distinct from
              (v_payment->>'tenderedAmount')::bigint-(v_payment->>'amount')::bigint or
            v_payment->>'custody' not in ('register','rider')) then
          raise exception 'Cash tender, change, and custody are required';
        end if;
        if v_payment->>'kind'='payment' and v_payment->>'method'<>'cash' and
           (v_payment ? 'tenderedAmount' or v_payment ? 'changeAmount') then
          raise exception 'Non-cash payments cannot contain change'; end if;
      end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists workspace_business_day_valid on public.workspace_state;
create trigger workspace_business_day_valid before insert or update of data on public.workspace_state
for each row execute function public.validate_business_day_write();

create or replace function public.validate_rider_tracking_enabled()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.sharing_enabled and exists(select 1 from public.workspace_state w where w.business_id=new.business_id
    and w.data#>>'{settings,modules,riderTracking}'='false') then
    raise exception 'Rider tracking is turned off for this business' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists rider_tracking_module_guard on public.rider_current_location;
create trigger rider_tracking_module_guard before insert or update on public.rider_current_location
for each row execute function public.validate_rider_tracking_enabled();

create or replace function public.apply_register_operations(p_business_id uuid,p_expected_revision bigint,
  p_next jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype; v_response jsonb; v_next jsonb;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id
    and user_id=auth.uid() and active;
  if not found or public.staff_password_change_required() then raise exception 'Access denied' using errcode='42501'; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  select response into v_response from public.operation_request where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  if v_state.revision<>p_expected_revision then raise exception 'Workspace changed on another device. Refresh and review before saving.' using errcode='40001'; end if;
  v_next:=jsonb_set(jsonb_set(v_state.data,'{businessDays}',coalesce(p_next->'businessDays','[]'::jsonb),true),
    '{cashMovements}',coalesce(p_next->'cashMovements','[]'::jsonb),true);
  perform public.validate_operations_change(p_business_id,v_state.data,v_next,'register',v_member.role,v_member.employee_id);
  update public.workspace_state set data=v_next,revision=revision+1,updated_at=now() where business_id=p_business_id;
  v_response:=public.read_operations(p_business_id);
  insert into public.operation_request(business_id,request_id,revision,response)
    values(p_business_id,p_request_id,v_state.revision+1,v_response);
  return v_response;
end $$;
revoke all on function public.apply_register_operations(uuid,bigint,jsonb,uuid) from public,anon;
grant execute on function public.apply_register_operations(uuid,bigint,jsonb,uuid) to authenticated;

create or replace function public.register_feature_ready()
returns boolean language sql stable set search_path='' as $$ select true $$;
revoke all on function public.register_feature_ready() from public,anon;
grant execute on function public.register_feature_ready() to authenticated;

-- Staff reads contain the settings needed to enforce business-day and payment
-- choices in the UI. Sensitive HR and owner-only data stay excluded.
create or replace function public.read_operations(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
  v_data jsonb; v_orders jsonb;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id and user_id=auth.uid() and active;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id;
  if not found then raise exception 'Workspace not found'; end if;
  v_data:=v_state.data;
  if v_member.role<>'owner' then
    select coalesce(jsonb_agg(case when v_member.role in (select value from jsonb_array_elements_text(
        coalesce(v_state.data#>'{settings,dayControlRoles}','[]'::jsonb))) then o.snapshot
        else jsonb_set(o.snapshot,'{payments}','[]'::jsonb,true) end order by o.created_at desc),'[]'::jsonb)
      into v_orders from public.order_index o where o.business_id=p_business_id
       and (v_member.role<>'rider' or v_member.role in (select value from jsonb_array_elements_text(
         coalesce(v_state.data#>'{settings,dayControlRoles}','[]'::jsonb))) or
         (o.order_type='delivery' and o.rider_employee_id=v_member.employee_id));
    v_data:=jsonb_build_object('orders',v_orders,
      'categories',coalesce(v_state.data->'categories','[]'::jsonb),
      'items',coalesce(v_state.data->'items','[]'::jsonb),
      'team',(select coalesce(jsonb_agg(jsonb_build_object('id',m.employee_id,'name',m.display_name,
        'role',m.role,'active',m.active,'rates','[]'::jsonb)),'[]'::jsonb)
        from public.business_memberships m where m.business_id=p_business_id and m.active),
      'attendance','[]'::jsonb,'adjustments','[]'::jsonb,'payrollRuns','[]'::jsonb,
      'payrollBatches','[]'::jsonb,'payrollDraft',null,
      'deliveryAreas',coalesce(v_state.data->'deliveryAreas','[]'::jsonb),
      'workShifts','[]'::jsonb,'activity','[]'::jsonb,
      'businessDays',coalesce(v_state.data->'businessDays','[]'::jsonb),
      'cashMovements',case when v_member.role in (select value from jsonb_array_elements_text(
        coalesce(v_state.data#>'{settings,dayControlRoles}','[]'::jsonb))) then
        coalesce(v_state.data->'cashMovements','[]'::jsonb) else '[]'::jsonb end,
      'locations',coalesce(v_state.data->'locations','[]'::jsonb),
      'registers',coalesce(v_state.data->'registers','[]'::jsonb),
      'settings',jsonb_build_object('businessName',v_data#>>'{settings,businessName}',
        'currency',v_data#>>'{settings,currency}','timezone',v_data#>>'{settings,timezone}',
        'theme',v_data#>>'{settings,theme}','accent',v_data#>>'{settings,accent}',
        'newOrderDisplay',v_data#>'{settings,newOrderDisplay}',
        'paymentMethods',v_data#>'{settings,paymentMethods}',
        'modules',v_data#>'{settings,modules}',
        'businessDayCutoff',v_data#>>'{settings,businessDayCutoff}',
        'dayControlRoles',v_data#>'{settings,dayControlRoles}',
        'cashVarianceThreshold',v_data#>'{settings,cashVarianceThreshold}',
        'dataMode','live'),
      'nextTicket',coalesce(v_state.data->'nextTicket','1001'::jsonb));
  end if;
  return jsonb_build_object('data',v_data,'revision',v_state.revision,'role',v_member.role,
    'employeeId',v_member.employee_id,'displayName',v_member.display_name);
end $$;
revoke all on function public.read_operations(uuid) from public,anon;
grant execute on function public.read_operations(uuid) to authenticated;

-- Riders use a locked and idempotent path, with tender/change kept on the
-- same immutable payment event as the applied amount.
create or replace function public.record_rider_collection_v2(p_business_id uuid,p_order_id text,
  p_amount bigint,p_method text,p_reference text,p_tendered bigint,p_change bigint,
  p_cash_confirmed boolean,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
  v_order jsonb; v_method jsonb; v_paid bigint; v_payment jsonb; v_next jsonb; v_response jsonb;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id
    and user_id=auth.uid() and active and role='rider';
  if not found or public.staff_password_change_required() then raise exception 'Access denied' using errcode='42501'; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  select response into v_response from public.operation_request where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  select value into v_order from jsonb_array_elements(v_state.data->'orders') where value->>'id'=p_order_id;
  if v_order is null or v_order->>'riderId' is distinct from v_member.employee_id or
     v_order->>'type'<>'delivery' or v_order->>'status' not in ('Picked up','Out for delivery','Completed')
    then raise exception 'Assigned delivery is not eligible' using errcode='42501'; end if;
  select value into v_method from jsonb_array_elements(coalesce(v_state.data#>'{settings,paymentMethods}','[]'::jsonb))
    where value->>'id'=p_method and value->>'active'='true';
  if v_method is null then raise exception 'Choose an enabled payment method'; end if;
  select coalesce(sum(case when value->>'kind'='refund' then -(value->>'amount')::bigint
    else (value->>'amount')::bigint end),0) into v_paid
    from jsonb_array_elements(coalesce(v_order->'payments','[]'::jsonb));
  if p_amount is null or p_amount<=0 or p_amount>(v_order->>'total')::bigint-v_paid
    then raise exception 'Amount exceeds remaining balance'; end if;
  if p_method='cash' then
    if p_cash_confirmed is distinct from true or p_tendered is null or p_tendered<p_amount or
       p_change is distinct from p_tendered-p_amount then raise exception 'Confirm cash received and change returned'; end if;
  elsif p_tendered is not null or p_change is not null or p_cash_confirmed then
    raise exception 'Non-cash payment cannot have tender or change'; end if;
  if length(coalesce(p_reference,''))>120 then raise exception 'Reference is too long'; end if;
  v_payment:=jsonb_build_object('id',gen_random_uuid()::text,'amount',p_amount,'method',p_method,
    'methodLabel',v_method->>'label','reference',trim(coalesce(p_reference,'')),'at',now(),
    'kind','payment','receivedById',v_member.employee_id,'receivedByName',v_member.display_name,
    'receivedByRole','rider','custody',case when p_method='cash' then 'rider' else 'external' end,
    'locationId','default-location','businessDate',to_char(now() at time zone
      coalesce(nullif(v_state.data#>>'{settings,timezone}',''),'Asia/Manila'),'YYYY-MM-DD'));
  if p_method='cash' then v_payment:=v_payment||jsonb_build_object('tenderedAmount',p_tendered,
    'changeAmount',p_change,'cashConfirmed',true); end if;
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
revoke all on function public.record_rider_collection_v2(uuid,text,bigint,text,text,bigint,bigint,boolean,uuid) from public,anon;
grant execute on function public.record_rider_collection_v2(uuid,text,bigint,text,text,bigint,bigint,boolean,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
