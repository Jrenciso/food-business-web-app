begin;

-- Repair deployments whose workspace trigger was left at the pre-Take-out
-- definition. This is intentionally forward-only; preserve migration 004/005.
-- Validate enabled choices on every write, but apply the enabled/disabled
-- restriction only to order IDs newly added in this workspace write.
create or replace function public.validate_new_order_display_settings()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_display jsonb;
  v_enabled jsonb;
  v_order jsonb;
  v_is_new boolean;
  v_status_changed boolean;
begin
  v_display := new.data #> '{settings,newOrderDisplay}';
  if v_display is not null then
    if jsonb_typeof(v_display) <> 'object' then
      raise exception 'Invalid new-order display settings';
    end if;

    v_enabled := v_display -> 'enabledOrderTypes';
    if jsonb_typeof(v_enabled) is distinct from 'array' then
      raise exception 'At least one new-order type must be enabled';
    end if;
    if jsonb_array_length(v_enabled) = 0 then
      raise exception 'At least one new-order type must be enabled';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_enabled) as item(value)
      where jsonb_typeof(item.value) <> 'string'
         or item.value #>> '{}' not in ('pickup','take-out','delivery','dine-in')
    ) then
      raise exception 'Unsupported new-order type';
    end if;
    if (v_display ->> 'layout') is null
       or (v_display ->> 'layout') not in ('tiles','list')
       or (v_display ->> 'tileSize') is null
       or (v_display ->> 'tileSize') not in ('compact','standard','large')
       or (v_display ->> 'showImages') is null
       or (v_display ->> 'showImages') not in ('true','false') then
      raise exception 'Invalid new-order display settings';
    end if;
  end if;

  for v_order in
    select value from jsonb_array_elements(coalesce(new.data -> 'orders', '[]'::jsonb))
  loop
    v_is_new := tg_op = 'INSERT';
    v_status_changed := v_is_new;
    if not v_is_new then
      select not exists (
        select 1
        from jsonb_array_elements(coalesce(old.data -> 'orders', '[]'::jsonb)) as prior(value)
        where prior.value ->> 'id' = v_order ->> 'id'
      ) into v_is_new;
      if not v_is_new then
        select prior.value -> 'status' is distinct from v_order -> 'status'
            or prior.value -> 'type' is distinct from v_order -> 'type'
          into v_status_changed
        from jsonb_array_elements(coalesce(old.data -> 'orders', '[]'::jsonb)) as prior(value)
        where prior.value ->> 'id' = v_order ->> 'id'
        limit 1;
      end if;
    end if;

    if v_status_changed and v_order ->> 'type' = 'dine-in'
       and v_order ->> 'status' in ('Picked up','Out for delivery') then
      raise exception 'Dine-in tickets cannot use delivery statuses';
    end if;

    if v_display is not null and v_is_new and not exists (
      select 1 from jsonb_array_elements_text(v_enabled) as enabled(value)
      where enabled.value = v_order ->> 'type'
    ) then
      raise exception 'This order type is disabled in New order settings';
    end if;
  end loop;

  return new;
end
$$;

drop trigger if exists workspace_new_order_settings_valid on public.workspace_state;
create trigger workspace_new_order_settings_valid
  before insert or update of data on public.workspace_state
  for each row execute function public.validate_new_order_display_settings();

notify pgrst, 'reload schema';
commit;
