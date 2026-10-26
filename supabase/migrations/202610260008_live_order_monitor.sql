begin;

-- The monitor is an optional, read-only module. Legacy businesses default to
-- enabled so adding this module does not unexpectedly hide a screen.
create or replace function public.validate_live_order_monitor_setting()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.data#>'{settings,modules,liveOrderMonitor}' is not null and
     jsonb_typeof(new.data#>'{settings,modules,liveOrderMonitor}')<>'boolean' then
    raise exception 'Invalid module setting for liveOrderMonitor';
  end if;
  return new;
end $$;
revoke all on function public.validate_live_order_monitor_setting() from public,anon,authenticated;

drop trigger if exists workspace_live_order_monitor_setting_valid on public.workspace_state;
create trigger workspace_live_order_monitor_setting_valid
before insert or update of data on public.workspace_state
for each row execute function public.validate_live_order_monitor_setting();

-- Return only operational fields needed by the display. The existing
-- read_operations RPC remains responsible for all other workspace workflows.
create or replace function public.read_live_order_monitor(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_member public.business_memberships%rowtype;
  v_state public.workspace_state%rowtype;
  v_data jsonb;
  v_orders jsonb;
  v_riders jsonb;
  v_business_date date;
  v_timezone text;
  v_cutoff text;
begin
  select * into v_member from public.business_memberships
    where business_id=p_business_id and user_id=auth.uid() and active;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if public.staff_password_change_required() then
    raise exception 'Password change required' using errcode='42501';
  end if;
  if v_member.role not in ('owner','chef','kitchen','rider') then
    raise exception 'Live Order Monitor is not available to this role' using errcode='42501';
  end if;

  select * into v_state from public.workspace_state where business_id=p_business_id;
  if not found then raise exception 'Workspace not found'; end if;
  v_data:=v_state.data;
  if coalesce(v_data#>>'{settings,modules,liveOrderMonitor}','true')<>'true' then
    raise exception 'Live Order Monitor is disabled' using errcode='42501';
  end if;
  v_timezone:=coalesce(nullif(v_data#>>'{settings,timezone}',''),'Asia/Manila');
  v_cutoff:=coalesce(nullif(v_data#>>'{settings,businessDayCutoff}',''),'00:00');
  select (day.value->>'businessDate')::date into v_business_date
    from jsonb_array_elements(coalesce(v_data->'businessDays','[]'::jsonb)) with ordinality day(value,ordinality)
    where coalesce(v_data#>>'{settings,modules,register}','false')='true'
      and day.value->>'state'<>'closed'
    order by day.ordinality desc limit 1;
  if v_business_date is null then
    v_business_date:=public.business_operating_date(v_data->'settings',now());
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',o.value->>'id','number',o.value->>'number','createdAt',o.value->>'createdAt',
      'businessDate',o.value->>'businessDate','type',o.value->>'type','status',o.value->>'status',
      'statusHistory',coalesce((select jsonb_agg(jsonb_build_object('status',h.value->>'status','at',h.value->>'at') order by h.ordinality)
        from jsonb_array_elements(coalesce(o.value->'statusHistory','[]'::jsonb)) with ordinality h(value,ordinality)),'[]'::jsonb),
      'lines',coalesce((select jsonb_agg(jsonb_build_object('name',line.value->>'name','quantity',(line.value->>'quantity')::integer) order by line.ordinality)
        from jsonb_array_elements(coalesce(o.value->'lines','[]'::jsonb)) with ordinality line(value,ordinality)),'[]'::jsonb),
      'riderId',case when o.value->>'type'='delivery' then coalesce(o.value->>'riderId','') else '' end
    ) order by (o.value->>'createdAt')::timestamptz desc),'[]'::jsonb) into v_orders
  from jsonb_array_elements(coalesce(v_data->'orders','[]'::jsonb)) with ordinality o(value,ordinality)
  where v_member.role<>'rider' or
    (o.value->>'type'='delivery' and o.value->>'riderId'=v_member.employee_id);

  select coalesce(jsonb_agg(jsonb_build_object('id',m.value->>'id','name',m.value->>'name')),'[]'::jsonb)
    into v_riders
  from jsonb_array_elements(coalesce(v_data->'team','[]'::jsonb)) m(value)
  where m.value->>'role'='rider' and coalesce(m.value->>'active','true')='true'
    and (v_member.role<>'rider' or m.value->>'id'=v_member.employee_id);

  return jsonb_build_object(
    'businessName',coalesce(v_data#>>'{settings,businessName}','Business'),
    'timezone',v_timezone,'businessDayCutoff',v_cutoff,
    'businessDate',v_business_date::text,
    'serverTime',clock_timestamp(),
    'registerEnabled',coalesce(v_data#>>'{settings,modules,register}','false')='true',
    'orders',v_orders,'riders',v_riders);
end $$;
revoke all on function public.read_live_order_monitor(uuid) from public,anon;
grant execute on function public.read_live_order_monitor(uuid) to authenticated;

commit;
