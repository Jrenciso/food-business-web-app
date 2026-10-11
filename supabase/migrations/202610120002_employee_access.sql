-- Owner-managed access from the Employees screen. Run after 202610120001.
-- A pending email acquires membership only after Supabase confirms ownership
-- of that email. No Auth admin secret is exposed to the browser.
create table if not exists public.employee_access_invites (
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  employee_id text not null,
  role text not null check (role in ('owner','kitchen','chef','rider')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,email),
  unique (business_id,employee_id),
  check (email=lower(trim(email)) and length(email) between 3 and 254)
);
alter table public.employee_access_invites enable row level security;
revoke all on public.employee_access_invites from public,anon,authenticated;

create or replace function public.attach_pending_employee_access()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_invite public.employee_access_invites%rowtype;
begin
  if new.email_confirmed_at is null or new.email is null then return new; end if;
  for v_invite in select * from public.employee_access_invites
    where email=lower(trim(new.email)) and active
  loop
    insert into public.business_memberships
      (business_id,user_id,role,employee_id,display_name,active)
    values (v_invite.business_id,new.id,v_invite.role,v_invite.employee_id,
      coalesce(nullif(new.raw_user_meta_data->>'full_name',''),new.email),true)
    on conflict (business_id,user_id) do update set
      role=excluded.role,employee_id=excluded.employee_id,
      display_name=excluded.display_name,active=true,updated_at=now();
    delete from public.employee_access_invites
      where business_id=v_invite.business_id and email=v_invite.email;
  end loop;
  return new;
end $$;
revoke all on function public.attach_pending_employee_access() from public,anon,authenticated;
drop trigger if exists attach_employee_access_on_insert on auth.users;
create trigger attach_employee_access_on_insert after insert on auth.users
  for each row execute function public.attach_pending_employee_access();
drop trigger if exists attach_employee_access_on_confirm on auth.users;
create trigger attach_employee_access_on_confirm after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.attach_pending_employee_access();

drop function if exists public.set_business_member(uuid,text,text,text,boolean);
create function public.set_business_member(
  p_business_id uuid,p_email text,p_role text,p_employee_id text,p_active boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid; v_email text:=lower(trim(p_email)); v_employee jsonb;
begin
  if not exists(select 1 from public.business_memberships where business_id=p_business_id
    and user_id=auth.uid() and active and role='owner')
    then raise exception 'Owner access required' using errcode='42501'; end if;
  if p_role not in ('owner','kitchen','chef','rider') then raise exception 'Invalid role'; end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    then raise exception 'Enter a valid access email'; end if;
  if nullif(p_employee_id,'') is null then raise exception 'Select an employee record'; end if;
  select value into v_employee from public.workspace_state s,
    jsonb_array_elements(coalesce(s.data->'team','[]'::jsonb)) e(value)
    where s.business_id=p_business_id and value->>'id'=p_employee_id;
  if v_employee is null or v_employee->>'role'<>p_role
    then raise exception 'Employee and role must match the saved profile'; end if;
  if exists(select 1 from public.business_memberships
    where business_id=p_business_id and user_id=auth.uid()
      and employee_id=p_employee_id)
    and (not p_active or v_email<>(select lower(email) from auth.users where id=auth.uid()))
    then raise exception 'Owner cannot remove own owner access'; end if;
  -- A changed email must not leave the old account with access to this employee.
  update public.business_memberships set active=false,updated_at=now()
    where business_id=p_business_id and employee_id=p_employee_id
      and user_id<>coalesce((select id from auth.users
        where lower(email)=v_email and email_confirmed_at is not null),
        '00000000-0000-0000-0000-000000000000'::uuid);
  delete from public.employee_access_invites
    where business_id=p_business_id and employee_id=p_employee_id and email<>v_email;
  if v_employee->>'active'<>'true' or not p_active then
    update public.business_memberships set active=false,updated_at=now()
      where business_id=p_business_id and employee_id=p_employee_id;
    delete from public.employee_access_invites
      where business_id=p_business_id and employee_id=p_employee_id;
    return 'disabled';
  end if;
  select id into v_user_id from auth.users
    where lower(email)=v_email and email_confirmed_at is not null;
  if v_user_id=auth.uid() and p_role<>'owner'
    then raise exception 'Owner cannot remove own owner access'; end if;
  if v_user_id is not null then
    insert into public.business_memberships
      (business_id,user_id,role,employee_id,display_name,active)
    values (p_business_id,v_user_id,p_role,p_employee_id,
      coalesce((select nullif(raw_user_meta_data->>'full_name','')
        from auth.users where id=v_user_id),v_email),true)
    on conflict (business_id,user_id) do update set role=excluded.role,
      employee_id=excluded.employee_id,display_name=excluded.display_name,
      active=true,updated_at=now();
    delete from public.employee_access_invites
      where business_id=p_business_id and email=v_email;
    return 'linked';
  end if;
  insert into public.employee_access_invites
    (business_id,email,employee_id,role,active)
  values (p_business_id,v_email,p_employee_id,p_role,true)
  on conflict (business_id,email) do update set
    employee_id=excluded.employee_id,role=excluded.role,
    active=true,updated_at=now();
  return 'pending';
end $$;
revoke all on function public.set_business_member(uuid,text,text,text,boolean)
  from public,anon;
grant execute on function public.set_business_member(uuid,text,text,text,boolean)
  to authenticated;

-- Save the employee profile and its access change in one database transaction.
-- A failed access update rolls back the profile write as well.
create or replace function public.save_employee_access(
  p_business_id uuid,p_expected_revision bigint,p_next jsonb,p_request_id uuid,
  p_email text,p_role text,p_employee_id text,p_active boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_response jsonb; v_status text;
begin
  if not exists(select 1 from public.business_memberships
    where business_id=p_business_id and user_id=auth.uid() and active and role='owner')
    then raise exception 'Owner access required' using errcode='42501'; end if;
  select response into v_response from public.operation_request
    where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  v_response:=public.apply_operations(p_business_id,p_expected_revision,'staff',p_next,p_request_id);
  v_status:=public.set_business_member(p_business_id,p_email,p_role,p_employee_id,p_active);
  v_response:=v_response || jsonb_build_object('accessStatus',v_status);
  update public.operation_request set response=v_response
    where business_id=p_business_id and request_id=p_request_id;
  return v_response;
end $$;
revoke all on function public.save_employee_access(uuid,bigint,jsonb,uuid,text,text,text,boolean)
  from public,anon;
grant execute on function public.save_employee_access(uuid,bigint,jsonb,uuid,text,text,text,boolean)
  to authenticated;
notify pgrst, 'reload schema';
