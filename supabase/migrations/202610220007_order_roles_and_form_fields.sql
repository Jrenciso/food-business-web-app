begin;

-- Backfill only order-entry settings. Existing orders and their snapshots are
-- not rewritten; older businesses keep chef/kitchen access and gain safe
-- defaults for the newly configurable form fields.
update public.workspace_state w
set data=jsonb_set(w.data,'{settings,newOrderDisplay}',
  coalesce(w.data#>'{settings,newOrderDisplay}','{}'::jsonb) || jsonb_build_object(
    'orderCreationRoles',coalesce(w.data#>'{settings,newOrderDisplay,orderCreationRoles}','["owner","chef","kitchen"]'::jsonb),
    'fieldRules',coalesce(w.data#>'{settings,newOrderDisplay,fieldRules}',
      '{
        "delivery":{"customer":"required","contact":"required","deliveryArea":"required","address":"required","landmark":"optional","rider":"required","dineInReference":"hidden","notes":"optional"},
        "take-out":{"customer":"required","contact":"optional","deliveryArea":"hidden","address":"hidden","landmark":"hidden","rider":"hidden","dineInReference":"hidden","notes":"optional"},
        "dine-in":{"customer":"required","contact":"hidden","deliveryArea":"hidden","address":"hidden","landmark":"hidden","rider":"hidden","dineInReference":"optional","notes":"optional"},
        "pickup":{"customer":"required","contact":"optional","deliveryArea":"hidden","address":"hidden","landmark":"hidden","rider":"hidden","dineInReference":"hidden","notes":"optional"}
      }'::jsonb)
  ),true),
  revision=revision+1,updated_at=now();

create or replace function public.validate_new_order_form_fields(p_order jsonb,p_display jsonb)
returns void language plpgsql set search_path='' as $$
declare v_type text:=p_order->>'type'; v_key text; v_rule text; v_value text;
begin
  for v_key in select unnest(array['customer','contact','deliveryArea','address','landmark','rider','dineInReference','notes']) loop
    v_rule:=p_display#>>array['fieldRules',v_type,v_key];
    if v_rule is null then
      v_rule:=case
        when v_type='delivery' and v_key in ('customer','contact','deliveryArea','address','rider') then 'required'
        when v_type='delivery' and v_key='landmark' then 'optional'
        when v_type='dine-in' and v_key='contact' then 'hidden'
        when v_type='dine-in' and v_key='dineInReference' then 'optional'
        when v_key in ('deliveryArea','address','landmark','rider','dineInReference') then 'hidden'
        when v_key='contact' then 'optional'
        when v_key='notes' then 'optional'
        else 'required'
      end;
    end if;
    v_value:=case v_key
      when 'customer' then coalesce(p_order->>'customer','')
      when 'contact' then coalesce(p_order->>'contact','')
      when 'deliveryArea' then coalesce(p_order->>'deliveryAreaId','')
      when 'address' then coalesce(p_order->>'address','')
      when 'landmark' then coalesce(p_order->>'landmark','')
      when 'rider' then coalesce(p_order->>'riderId','')
      when 'dineInReference' then coalesce(p_order->>'dineInReference','')
      when 'notes' then coalesce(p_order->>'notes','')
    end;
    if v_rule='required' and nullif(trim(v_value),'') is null then
      raise exception '% is required for this order type',case v_key
        when 'customer' then 'Customer name' when 'contact' then 'Mobile / contact number'
        when 'deliveryArea' then 'Delivery area' when 'address' then 'Delivery address'
        when 'landmark' then 'Landmark / directions' when 'rider' then 'Assigned rider'
        when 'dineInReference' then 'Table number / dine-in reference' else 'Order notes / instructions' end;
    end if;
    if v_rule='hidden' and nullif(trim(v_value),'') is not null then
      raise exception '% must be cleared for this order type',case v_key
        when 'customer' then 'Customer name' when 'contact' then 'Mobile / contact number'
        when 'deliveryArea' then 'Delivery area' when 'address' then 'Delivery address'
        when 'landmark' then 'Landmark / directions' when 'rider' then 'Assigned rider'
        when 'dineInReference' then 'Table number / dine-in reference' else 'Order notes / instructions' end;
    end if;
  end loop;
end $$;
revoke all on function public.validate_new_order_form_fields(jsonb,jsonb) from public,anon,authenticated;

-- Extend the deployed validator in place through this new migration, without
-- changing 004, 005, or 006 after deployment.
create or replace function public.validate_new_order_display_settings()
returns trigger language plpgsql set search_path='' as $$
declare
  v_display jsonb; v_enabled jsonb; v_roles jsonb; v_rules jsonb;
  v_type text; v_key text; v_order jsonb; v_prior jsonb;
  v_is_new boolean; v_type_changed boolean; v_actor_role text;
begin
  v_display:=new.data#>'{settings,newOrderDisplay}';
  if v_display is null or jsonb_typeof(v_display)<>'object' then raise exception 'Invalid new-order settings'; end if;
  v_enabled:=v_display->'enabledOrderTypes';
  if jsonb_typeof(v_enabled) is distinct from 'array' or jsonb_array_length(v_enabled)=0 or
    (select count(*) from jsonb_array_elements_text(v_enabled))<>(select count(distinct value) from jsonb_array_elements_text(v_enabled)) or exists(
    select 1 from jsonb_array_elements(v_enabled) x(value)
    where jsonb_typeof(x.value)<>'string' or x.value#>>'{}' not in ('pickup','take-out','delivery','dine-in')
  ) then raise exception 'Unsupported new-order type'; end if;
  if v_display->>'layout' is null or v_display->>'layout' not in ('tiles','list')
    or v_display->>'tileSize' is null or v_display->>'tileSize' not in ('compact','standard','large')
    or v_display->>'showImages' is null or v_display->>'showImages' not in ('true','false') then raise exception 'Invalid new-order display settings'; end if;
  v_roles:=v_display->'orderCreationRoles';
  if jsonb_typeof(v_roles) is distinct from 'array' or not (v_roles @> '["owner"]'::jsonb) or exists(
    select 1 from jsonb_array_elements(v_roles) x(value)
    where jsonb_typeof(x.value)<>'string' or x.value#>>'{}' not in ('owner','chef','kitchen','rider')
  ) or (select count(*) from jsonb_array_elements_text(v_roles))<>(select count(distinct value) from jsonb_array_elements_text(v_roles))
    then raise exception 'Invalid order-creation role settings'; end if;
  v_rules:=v_display->'fieldRules';
  if jsonb_typeof(v_rules) is distinct from 'object' or jsonb_object_length(v_rules)<>4 then raise exception 'Order field settings are incomplete'; end if;
  foreach v_type in array array['pickup','take-out','delivery','dine-in'] loop
    if jsonb_typeof(v_rules->v_type) is distinct from 'object' or jsonb_object_length(v_rules->v_type)<>8 then raise exception 'Order field settings are incomplete for %',v_type; end if;
    foreach v_key in array array['customer','contact','deliveryArea','address','landmark','rider','dineInReference','notes'] loop
      if v_rules#>>array[v_type,v_key] is null or v_rules#>>array[v_type,v_key] not in ('required','optional','hidden') then
        raise exception 'Invalid rule for % on %',v_key,v_type;
      end if;
    end loop;
  end loop;
  if v_rules#>>'{delivery,deliveryArea}'<>'required' or v_rules#>>'{delivery,address}'<>'required'
    or v_rules#>>'{delivery,rider}'<>'required' then
    raise exception 'Delivery area, address, and assigned rider are required system fields';
  end if;
  if v_rules#>>'{dine-in,contact}'<>'hidden' then raise exception 'Dine-in orders do not collect a contact number'; end if;
  foreach v_type in array array['pickup','take-out','dine-in'] loop
    if v_rules#>>array[v_type,'deliveryArea']<>'hidden' or v_rules#>>array[v_type,'address']<>'hidden'
      or v_rules#>>array[v_type,'landmark']<>'hidden' or v_rules#>>array[v_type,'rider']<>'hidden' then
      raise exception 'Delivery-only fields must be hidden for non-delivery orders'; end if;
  end loop;
  foreach v_type in array array['pickup','take-out','delivery'] loop
    if v_rules#>>array[v_type,'dineInReference']<>'hidden' then raise exception 'Dine-in reference must be hidden for non-dine-in orders'; end if;
  end loop;

  for v_order in select value from jsonb_array_elements(coalesce(new.data->'orders','[]'::jsonb)) loop
    v_is_new:=tg_op='INSERT'; v_type_changed:=v_is_new;
    if not v_is_new then
      select prior.value into v_prior from jsonb_array_elements(coalesce(old.data->'orders','[]'::jsonb)) prior(value)
        where prior.value->>'id'=v_order->>'id' limit 1;
      v_is_new:=v_prior is null;
      v_type_changed:=v_is_new or v_prior->>'type' is distinct from v_order->>'type';
    end if;
    if (v_is_new or v_type_changed) then
      perform public.validate_new_order_form_fields(v_order,v_display);
    end if;
    if (v_is_new or (v_prior->>'status' is distinct from v_order->>'status') or v_type_changed)
      and v_order->>'type'='dine-in' and v_order->>'status' in ('Picked up','Out for delivery') then
      raise exception 'Dine-in tickets cannot use delivery statuses';
    end if;
    if v_is_new and not exists(select 1 from jsonb_array_elements_text(v_enabled) e(value) where e.value=v_order->>'type')
      then raise exception 'This order type is disabled in New order settings'; end if;
    if (v_is_new or v_type_changed) and v_order->>'type'='delivery' and not exists(
      select 1 from jsonb_array_elements(coalesce(new.data->'team','[]'::jsonb)) member(value)
      where member.value->>'id'=v_order->>'riderId' and member.value->>'role'='rider' and member.value->>'active'='true'
    ) then raise exception 'Choose an active rider for delivery'; end if;
    if v_is_new and auth.uid() is not null then
      select role into v_actor_role from public.business_memberships
        where business_id=new.business_id and user_id=auth.uid() and active;
      if v_actor_role is distinct from 'owner' and not exists(
        select 1 from jsonb_array_elements_text(v_roles) r(value) where r.value=v_actor_role
      ) then raise exception 'This role is not allowed to create new orders' using errcode='42501'; end if;
    end if;
  end loop;
  return new;
end $$;

-- The existing workspace validator assumes every order has a contact number.
-- Wrap it so optional/hidden contacts are checked by the new field rules while
-- preserving all of its existing money, authorization, and history checks.
alter function public.validate_operations_change(uuid,jsonb,jsonb,text,text,text)
  rename to validate_operations_change_base;

create or replace function public.validate_operations_change(
  p_business_id uuid,p_old jsonb,p_new jsonb,p_action text,p_role text,p_employee_id text)
returns void language plpgsql security definer set search_path='' as $$
declare v_order jsonb; v_prior jsonb; v_doc_old jsonb:=p_old; v_doc_new jsonb:=p_new;
        v_old_orders jsonb; v_new_orders jsonb; v_item jsonb; v_display jsonb;
begin
  if p_action='pos' then
    v_display:=p_new#>'{settings,newOrderDisplay}';
    for v_order in select value from jsonb_array_elements(coalesce(p_new->'orders','[]'::jsonb)) loop
      select value into v_prior from jsonb_array_elements(coalesce(p_old->'orders','[]'::jsonb)) where value->>'id'=v_order->>'id' limit 1;
      if v_prior is null or v_prior->>'type' is distinct from v_order->>'type' then
        perform public.validate_new_order_form_fields(v_order,v_display);
      end if;
    end loop;
    select coalesce(jsonb_agg(case when coalesce(v_display#>>array['fieldRules',value->>'type','contact'],case when value->>'type'='delivery' then 'required' when value->>'type'='dine-in' then 'hidden' else 'optional' end)<>'required'
      then jsonb_set(value,'{contact}','"optional-contact-checked-by-settings"'::jsonb,true) else value end order by ord),'[]'::jsonb)
      into v_new_orders from jsonb_array_elements(coalesce(p_new->'orders','[]'::jsonb)) with ordinality a(value,ord);
    v_doc_new:=jsonb_set(p_new,'{orders}',v_new_orders,true);
    select coalesce(jsonb_agg(case when coalesce(p_old#>>array['settings','newOrderDisplay','fieldRules',value->>'type','contact'],case when value->>'type'='delivery' then 'required' when value->>'type'='dine-in' then 'hidden' else 'optional' end)<>'required'
      then jsonb_set(value,'{contact}','"optional-contact-checked-by-settings"'::jsonb,true) else value end order by ord),'[]'::jsonb)
      into v_old_orders from jsonb_array_elements(coalesce(p_old->'orders','[]'::jsonb)) with ordinality a(value,ord);
    v_doc_old:=jsonb_set(p_old,'{orders}',v_old_orders,true);
  end if;
  perform public.validate_operations_change_base(p_business_id,v_doc_old,v_doc_new,p_action,p_role,p_employee_id);
end $$;
revoke all on function public.validate_operations_change(uuid,jsonb,jsonb,text,text,text) from public,anon,authenticated;

-- Rider accounts may use the staff order RPC only when the business setting
-- permits it. The workspace trigger performs the setting check as well.
create or replace function public.apply_staff_order(p_business_id uuid,p_expected_revision bigint,
  p_next jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
  v_response jsonb; v_order jsonb; v_item jsonb; v_line jsonb; v_next jsonb;
  v_count integer; v_ticket bigint; v_display jsonb;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id
    and user_id=auth.uid() and active and role in ('chef','kitchen','rider');
  if not found or public.staff_password_change_required() then raise exception 'Access denied' using errcode='42501'; end if;
  select response into v_response from public.operation_request where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  select response into v_response from public.operation_request where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  if v_state.revision<>p_expected_revision then raise exception 'Workspace changed on another device. Refresh and review before saving.' using errcode='40001'; end if;
  if jsonb_typeof(p_next->'orders')<>'array' then raise exception 'Invalid order list'; end if;
  select count(*) into v_count from jsonb_array_elements(p_next->'orders') n
    where not exists(select 1 from jsonb_array_elements(v_state.data->'orders') o where o->>'id'=n.value->>'id');
  if v_count<>1 then raise exception 'Staff may create one new ticket at a time' using errcode='42501'; end if;
  select n.value into v_order from jsonb_array_elements(p_next->'orders') n
    where not exists(select 1 from jsonb_array_elements(v_state.data->'orders') o where o->>'id'=n.value->>'id');
  v_ticket:=coalesce((v_state.data->>'nextTicket')::bigint,1001);
  if v_order->>'number'<>v_ticket::text or v_order->>'status'<>'New'
    or jsonb_typeof(v_order->'payments')<>'array' or jsonb_array_length(v_order->'payments')<>0
    or coalesce((v_order->>'sample')::boolean,false) then
    raise exception 'Staff tickets must start with the next ticket number, New, unpaid, and live'; end if;
  v_display:=coalesce(v_state.data#>'{settings,newOrderDisplay}','{}'::jsonb);
  perform public.validate_new_order_form_fields(v_order,v_display);
  v_order:=jsonb_set(v_order,'{createdByEmployeeId}',to_jsonb(coalesce(v_member.employee_id::text,'')),true);
  perform public.validate_order_money(v_order,v_state.data->'items',v_state.data->'deliveryAreas');
  if v_member.role='rider' and v_order->>'type'='delivery' and v_order->>'riderId' is distinct from v_member.employee_id::text then
    raise exception 'Rider-created deliveries must be assigned to the signed-in rider'; end if;
  for v_line in select value from jsonb_array_elements(v_order->'lines') loop
    select value into v_item from jsonb_array_elements(v_state.data->'items') where value->>'id'=v_line->>'itemId';
    if v_item is null or v_item->>'available'<>'true' or v_item->>'name'<>v_line->>'name'
       or v_item->>'price'<>v_line->>'unitPrice' then raise exception 'Order item does not match the active menu'; end if;
  end loop;
  if v_order->>'type'='delivery' and not exists(select 1 from public.business_memberships m
    where m.business_id=p_business_id and m.active and m.role='rider' and m.employee_id=v_order->>'riderId') then
    raise exception 'Choose an active rider for delivery'; end if;
  v_next:=jsonb_set(v_state.data,'{orders}',coalesce(v_state.data->'orders','[]'::jsonb)||jsonb_build_array(v_order),true);
  v_next:=jsonb_set(v_next,'{nextTicket}',to_jsonb(v_ticket+1),true);
  perform public.rebuild_operations_indexes(p_business_id,v_next);
  update public.workspace_state set data=v_next,revision=revision+1,updated_at=now() where business_id=p_business_id;
  v_response:=public.read_operations(p_business_id);
  insert into public.operation_request(business_id,request_id,revision,response) values(p_business_id,p_request_id,v_state.revision+1,v_response);
  return v_response;
end $$;
revoke all on function public.apply_staff_order(uuid,bigint,jsonb,uuid) from public,anon;
grant execute on function public.apply_staff_order(uuid,bigint,jsonb,uuid) to authenticated;

drop trigger if exists workspace_new_order_settings_valid on public.workspace_state;
create trigger workspace_new_order_settings_valid before insert or update of data on public.workspace_state
for each row execute function public.validate_new_order_display_settings();

notify pgrst,'reload schema';
commit;
