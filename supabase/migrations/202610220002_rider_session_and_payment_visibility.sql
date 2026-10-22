-- Keep current rider sharing independent of delivery assignment, and expose
-- operational payment details to authorized members without widening access.
begin;

grant all on table public.staff_accounts to service_role;
grant select, insert, update on table public.business_memberships to service_role;

alter table public.rider_current_location alter column order_id drop not null;
alter table public.rider_current_location alter column latitude drop not null;
alter table public.rider_current_location alter column longitude drop not null;
alter table public.rider_current_location alter column accuracy_m drop not null;
alter table public.rider_current_location alter column updated_at drop not null;
alter table public.rider_current_location add column if not exists sharing_enabled boolean not null default true;
alter table public.rider_current_location add column if not exists session_seen_at timestamptz;
update public.rider_current_location set session_seen_at=updated_at where session_seen_at is null;

-- Remove abandoned session rows and coordinates promptly, even when an owner
-- is not viewing the rider panel. One current row per rider is never a trail.
create extension if not exists pg_cron;
do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='expire-rider-current-locations';
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule('expire-rider-current-locations','*/1 * * * *',
    'delete from public.rider_current_location where coalesce(session_seen_at,updated_at) <= now() - interval ''10 minutes''');
end $$;

create or replace function public.owner_rider_locations(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.business_memberships where business_id=p_business_id
      and user_id=auth.uid() and active and role='owner')
    then raise exception 'Access denied' using errcode='42501'; end if;
  update public.rider_current_location set latitude=null,longitude=null,accuracy_m=null,order_id=null,updated_at=null
    where business_id=p_business_id and updated_at<=now()-interval '10 minutes';
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'employeeId',m.employee_id,'name',m.display_name,
    'orderId',coalesce((select o.order_id from public.order_index o where o.business_id=m.business_id
      and o.order_id=l.order_id and o.rider_employee_id=m.employee_id and o.order_type='delivery'
      and o.status not in ('Completed','Cancelled')),(select o.order_id from public.order_index o
      where o.business_id=m.business_id and o.rider_employee_id=m.employee_id and o.order_type='delivery'
       and o.status not in ('Completed','Cancelled') order by o.created_at desc limit 1)),
    'latitude',l.latitude,'longitude',l.longitude,'accuracy',l.accuracy_m,'updatedAt',l.updated_at,
    'sessionSeenAt',l.session_seen_at,'sharing',coalesce(l.sharing_enabled,false),
    'status',case when l.session_seen_at is null or l.session_seen_at<=now()-interval '2 minutes' then 'offline'
      when l.sharing_enabled and l.latitude is null then 'waiting'
      when l.sharing_enabled then 'sharing' else 'paused' end
  ) order by m.display_name),'[]'::jsonb)
    from public.business_memberships m left join public.rider_current_location l
      on l.business_id=m.business_id and l.employee_id=m.employee_id
    where m.business_id=p_business_id and m.active and m.role='rider');
end $$;
revoke all on function public.owner_rider_locations(uuid) from public,anon;
grant execute on function public.owner_rider_locations(uuid) to authenticated;

create or replace function public.set_rider_location(p_business_id uuid,p_order_id text,
  p_latitude double precision,p_longitude double precision,p_accuracy double precision)
returns void language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id
    and user_id=auth.uid() and active and role='rider';
  if not found or public.staff_password_change_required() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_latitude is null or p_longitude is null or p_accuracy is null or
     p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or p_accuracy not between 0 and 10000
    then raise exception 'Invalid location'; end if;
  if p_order_id is not null and not exists(select 1 from public.order_index where business_id=p_business_id
    and order_id=p_order_id and rider_employee_id=v_member.employee_id and order_type='delivery'
    and status not in ('Completed','Cancelled')) then raise exception 'Delivery is not assigned to this rider' using errcode='42501'; end if;
  if exists(select 1 from public.rider_current_location where business_id=p_business_id
      and employee_id=v_member.employee_id and updated_at>now()-interval '12 seconds') then
    update public.rider_current_location set session_seen_at=now(),sharing_enabled=true
      where business_id=p_business_id and employee_id=v_member.employee_id;
    return;
  end if;
  insert into public.rider_current_location(business_id,employee_id,user_id,order_id,latitude,longitude,accuracy_m,updated_at,sharing_enabled,session_seen_at)
    values(p_business_id,v_member.employee_id,auth.uid(),p_order_id,p_latitude,p_longitude,p_accuracy,now(),true,now())
    on conflict (business_id,employee_id) do update set user_id=excluded.user_id,order_id=excluded.order_id,
      latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,
      updated_at=excluded.updated_at,sharing_enabled=true,session_seen_at=excluded.session_seen_at;
end $$;
revoke all on function public.set_rider_location(uuid,text,double precision,double precision,double precision) from public,anon;
grant execute on function public.set_rider_location(uuid,text,double precision,double precision,double precision) to authenticated;

create or replace function public.set_rider_sharing(p_business_id uuid,p_sharing boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id
    and user_id=auth.uid() and active and role='rider';
  if not found or public.staff_password_change_required() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_sharing then
    insert into public.rider_current_location(business_id,employee_id,user_id,sharing_enabled,session_seen_at,updated_at)
      values(p_business_id,v_member.employee_id,auth.uid(),true,now(),null)
      on conflict (business_id,employee_id) do update set user_id=excluded.user_id,sharing_enabled=true,
        session_seen_at=excluded.session_seen_at,order_id=null,latitude=null,longitude=null,accuracy_m=null,updated_at=null;
  else
    insert into public.rider_current_location(business_id,employee_id,user_id,sharing_enabled,session_seen_at,updated_at)
      values(p_business_id,v_member.employee_id,auth.uid(),false,now(),null)
      on conflict (business_id,employee_id) do update set user_id=excluded.user_id,sharing_enabled=false,
        session_seen_at=excluded.session_seen_at,order_id=null,latitude=null,longitude=null,accuracy_m=null,updated_at=null;
  end if;
end $$;
revoke all on function public.set_rider_sharing(uuid,boolean) from public,anon;
grant execute on function public.set_rider_sharing(uuid,boolean) to authenticated;

create or replace function public.stop_rider_location(p_business_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.rider_current_location where business_id=p_business_id and user_id=auth.uid();
end $$;
revoke all on function public.stop_rider_location(uuid) from public,anon;
grant execute on function public.stop_rider_location(uuid) to authenticated;

create or replace function public.revoke_inactive_staff()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.business_memberships m set role=e.role,display_name=coalesce(nullif(e.name,''),m.display_name),updated_at=now()
    from (select value->>'id' as id,value->>'role' as role,value->>'name' as name
      from jsonb_array_elements(coalesce(new.data->'team','[]'::jsonb)) value
      where value->>'active'='true' and value->>'role' in ('rider','chef','kitchen')) e
    where m.business_id=new.business_id and m.role<>'owner' and m.employee_id=e.id
      and (m.role is distinct from e.role or m.display_name is distinct from e.name);
  update public.business_memberships m set active=false,updated_at=now()
    where m.business_id=new.business_id and m.role<>'owner' and m.active
      and exists(select 1 from jsonb_array_elements(coalesce(new.data->'team','[]'::jsonb)) e
        where e->>'id'=m.employee_id and (e->>'active'='false' or e->>'role'='owner'));
  delete from public.rider_current_location l where l.business_id=new.business_id and
    not exists(select 1 from public.business_memberships m where m.business_id=l.business_id
      and m.user_id=l.user_id and m.active and m.role='rider');
  return new;
end $$;

create or replace function public.read_operations(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
  v_data jsonb; v_orders jsonb;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id and user_id=auth.uid() and active;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if public.staff_password_change_required() then raise exception 'Password change required' using errcode='42501'; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id;
  if not found then raise exception 'Workspace not found'; end if;
  v_data:=v_state.data;
  if v_member.role<>'owner' then
    select coalesce(jsonb_agg(
      case when v_member.role='rider' then
        jsonb_set(jsonb_set(jsonb_set(jsonb_set(o.snapshot,'{paidAmount}',to_jsonb(coalesce((select sum(case when p.kind='refund' then -p.amount_centavos else p.amount_centavos end)
          from public.order_payment_index p where p.business_id=o.business_id and p.order_id=o.order_id),0)),true),
          '{notes}','""'::jsonb,true),
          '{lines}',coalesce((select jsonb_agg(x.value-'note') from jsonb_array_elements(coalesce(o.snapshot->'lines','[]'::jsonb)) as x(value)),'[]'::jsonb),true),
          '{payments}',coalesce(o.snapshot->'payments','[]'::jsonb),true)
      else jsonb_set(o.snapshot,'{paidAmount}',to_jsonb(coalesce((select sum(case when p.kind='refund' then -p.amount_centavos else p.amount_centavos end)
          from public.order_payment_index p where p.business_id=o.business_id and p.order_id=o.order_id),0)),true)
      end order by o.created_at desc),'[]'::jsonb) into v_orders
    from public.order_index o where o.business_id=p_business_id and
      (v_member.role<>'rider' or o.order_type='delivery' and o.rider_employee_id=v_member.employee_id);
    v_data:=jsonb_build_object('orders',v_orders,'categories','[]'::jsonb,'items','[]'::jsonb,
      'team',(select coalesce(jsonb_agg(jsonb_build_object('id',m.employee_id,'name',m.display_name,
        'role',m.role,'active',m.active,'rates','[]'::jsonb)),'[]'::jsonb)
        from public.business_memberships m where m.business_id=p_business_id and m.active
          and (v_member.role<>'rider' or m.employee_id=v_member.employee_id)),
      'attendance','[]'::jsonb,'adjustments','[]'::jsonb,'payrollRuns','[]'::jsonb,'payrollBatches','[]'::jsonb,
      'payrollDraft',null,'deliveryAreas','[]'::jsonb,'workShifts','[]'::jsonb,'activity','[]'::jsonb,
      'settings',jsonb_build_object('businessName',v_data#>>'{settings,businessName}',
        'tagline',coalesce(v_data#>>'{settings,tagline}',''),'logo',coalesce(v_data#>>'{settings,logo}',''),
        'currency',v_data#>>'{settings,currency}','timezone',v_data#>>'{settings,timezone}',
        'theme',v_data#>>'{settings,theme}','accent',v_data#>>'{settings,accent}',
        'paymentMethods',coalesce(v_data#>'{settings,paymentMethods}','[]'::jsonb),'dataMode','live'),
      'nextTicket',0);
  end if;
  return jsonb_build_object('data',v_data,'revision',v_state.revision,'role',v_member.role,
    'employeeId',v_member.employee_id,'displayName',v_member.display_name);
end $$;
revoke all on function public.read_operations(uuid) from public,anon;
grant execute on function public.read_operations(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
