-- Reminder notifications for active 24h reservations nearing expiry.

create or replace function public.send_product_reservation_expiry_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reminder_count integer := 0;
  reservation_row record;
  product_title text;
  reminder_data jsonb;
begin
  for reservation_row in
    select
      r.id,
      r.product_id,
      r.buyer_id,
      r.seller_id,
      r.expires_at
    from public.product_reservations r
    where r.status = 'active'
      and r.expires_at > now()
      and r.expires_at <= now() + interval '2 hours'
  loop
    select p.title
      into product_title
    from public.products p
    where p.id = reservation_row.product_id;

    reminder_data := jsonb_build_object(
      'reservation_id', reservation_row.id,
      'product_id', reservation_row.product_id,
      'expires_at', reservation_row.expires_at,
      'url', '/product/' || reservation_row.product_id
    );

    if not exists (
      select 1
      from public.notifications n
      where n.user_id = reservation_row.buyer_id
        and n.type = 'product_reservation_expiring_soon'
        and n.data ->> 'reservation_id' = reservation_row.id::text
    ) then
      insert into public.notifications (user_id, type, title, message, data, read)
      values (
        reservation_row.buyer_id,
        'product_reservation_expiring_soon',
        'Tu reserva caduca pronto',
        'Quedan menos de 2 horas para completar la compra de “' || coalesce(product_title, 'este producto') || '”.',
        reminder_data,
        false
      );
      reminder_count := reminder_count + 1;
    end if;

    if not exists (
      select 1
      from public.notifications n
      where n.user_id = reservation_row.seller_id
        and n.type = 'product_reservation_expiring_soon_seller'
        and n.data ->> 'reservation_id' = reservation_row.id::text
    ) then
      insert into public.notifications (user_id, type, title, message, data, read)
      values (
        reservation_row.seller_id,
        'product_reservation_expiring_soon_seller',
        'Una reserva caduca pronto',
        'La reserva de “' || coalesce(product_title, 'tu producto') || '” caduca en menos de 2 horas.',
        reminder_data,
        false
      );
      reminder_count := reminder_count + 1;
    end if;
  end loop;

  return reminder_count;
end;
$$;

revoke all on function public.send_product_reservation_expiry_reminders() from public;
grant execute on function public.send_product_reservation_expiry_reminders() to service_role;

-- Schedule the reminder job when pg_cron is available. The guarded block keeps
-- the migration safe in projects where cron is not enabled.
do $$
begin
  if to_regnamespace('cron') is not null then
    begin
      perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'reveta-reservation-expiry-reminders';

      perform cron.schedule(
        'reveta-reservation-expiry-reminders',
        '*/15 * * * *',
        'select public.send_product_reservation_expiry_reminders();'
      );
    exception
      when insufficient_privilege or undefined_function or undefined_table then
        raise notice 'pg_cron is unavailable or cannot be configured; reminder function was still created.';
    end;
  end if;
end;
$$;
