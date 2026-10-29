begin;

-- Reinstall the corrected new-order validator for projects where the earlier
-- repair migration was not applied or its trigger/function was replaced.
-- This is forward-only; it does not modify or rewrite any order data.
create or replace function public.validate_new_order_display_settings()
returns trigger language plpgsql set search_path='' as $$
declare
  v_display jsonb; v_enabled jsonb; v_roles jsonb; v_rules jsonb;
  v_type text; v_key text; v_order jsonb; v_prior jsonb;
  v_is_new boolean; v_type_changed boolean; v_actor_role text;
  v_object_key_count integer;
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
  if jsonb_typeof(v_rules) is distinct from 'object' then raise exception 'Order field settings are incomplete'; end if;
  select count(*) into v_object_key_count from jsonb_object_keys(v_rules);
  if v_object_key_count<>4 then raise exception 'Order field settings are incomplete'; end if;
  foreach v_type in array array['pickup','take-out','delivery','dine-in'] loop
    if jsonb_typeof(v_rules->v_type) is distinct from 'object' then
      raise exception 'Order field settings are incomplete for %',v_type;
    end if;
    select count(*) into v_object_key_count from jsonb_object_keys(v_rules->v_type);
    if v_object_key_count<>8 then raise exception 'Order field settings are incomplete for %',v_type; end if;
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

drop trigger if exists workspace_new_order_settings_valid on public.workspace_state;
create trigger workspace_new_order_settings_valid
before insert or update of data on public.workspace_state
for each row execute function public.validate_new_order_display_settings();

notify pgrst,'reload schema';
commit;
