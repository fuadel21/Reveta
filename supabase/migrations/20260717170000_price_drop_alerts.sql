-- Reveta: notificar a usuarios que marcaron como favorito un producto cuando baja de precio.

create or replace function public.notify_favoriters_on_price_drop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  discount_percent integer;
begin
  if new.price is null or old.price is null or new.price >= old.price then
    return new;
  end if;

  if old.price <= 0 then
    return new;
  end if;

  discount_percent := greatest(1, round(((old.price - new.price) / old.price) * 100)::integer);

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    data,
    read
  )
  select
    f.user_id,
    'price_drop',
    'Ha bajado el precio de un favorito',
    '“' || new.title || '” ha bajado de ' ||
      trim(to_char(old.price, 'FM999999990D00')) || ' € a ' ||
      trim(to_char(new.price, 'FM999999990D00')) || ' €.',
    jsonb_build_object(
      'product_id', new.id,
      'old_price', old.price,
      'new_price', new.price,
      'discount_percent', discount_percent,
      'url', '/product/' || new.id
    ),
    false
  from public.favorites f
  where f.product_id = new.id
    and f.user_id <> new.user_id
    and not exists (
      select 1
      from public.notifications n
      where n.user_id = f.user_id
        and n.type = 'price_drop'
        and n.data ->> 'product_id' = new.id::text
        and (n.data ->> 'new_price')::numeric = new.price
        and n.created_at >= now() - interval '5 minutes'
    );

  return new;
exception when others then
  raise warning 'No se pudieron crear alertas de bajada de precio para producto %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists products_notify_price_drop on public.products;
create trigger products_notify_price_drop
after update of price on public.products
for each row
when (new.price < old.price)
execute function public.notify_favoriters_on_price_drop();

revoke all on function public.notify_favoriters_on_price_drop() from public;
