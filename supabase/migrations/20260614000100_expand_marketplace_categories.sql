create extension if not exists pgcrypto;

do $$
declare
  deportes_id uuid;
  electronica_id uuid;
  hogar_id uuid;
  juegos_id uuid;
  libros_id uuid;
  mascotas_id uuid;
  moda_id uuid;
  motor_id uuid;
  otros_id uuid;
  belleza_id uuid;
  oficina_id uuid;
  instrumentos_id uuid;
  coleccionismo_id uuid;
begin
  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Deportes', '⚽'
  where not exists (select 1 from public.categories where lower(name) = lower('Deportes'));

  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Electrónica', '📱'
  where not exists (select 1 from public.categories where lower(name) = lower('Electrónica'));

  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Hogar', '🏠'
  where not exists (select 1 from public.categories where lower(name) = lower('Hogar'));

  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Juegos', '🎮'
  where not exists (select 1 from public.categories where lower(name) = lower('Juegos'));

  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Libros', '📚'
  where not exists (select 1 from public.categories where lower(name) = lower('Libros'));

  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Mascotas', '🐾'
  where not exists (select 1 from public.categories where lower(name) = lower('Mascotas'));

  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Moda', '👕'
  where not exists (select 1 from public.categories where lower(name) = lower('Moda'));

  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Motor', '🚗'
  where not exists (select 1 from public.categories where lower(name) = lower('Motor'));

  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Otros', '📦'
  where not exists (select 1 from public.categories where lower(name) = lower('Otros'));

  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Belleza', '💄'
  where not exists (select 1 from public.categories where lower(name) = lower('Belleza'));

  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Oficina', '💼'
  where not exists (select 1 from public.categories where lower(name) = lower('Oficina'));

  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Instrumentos', '🎸'
  where not exists (select 1 from public.categories where lower(name) = lower('Instrumentos'));

  insert into public.categories (id, name, icon)
  select gen_random_uuid(), 'Coleccionismo', '🧩'
  where not exists (select 1 from public.categories where lower(name) = lower('Coleccionismo'));

  select id into deportes_id from public.categories where lower(name) = lower('Deportes') limit 1;
  select id into electronica_id from public.categories where lower(name) = lower('Electrónica') limit 1;
  select id into hogar_id from public.categories where lower(name) = lower('Hogar') limit 1;
  select id into juegos_id from public.categories where lower(name) = lower('Juegos') limit 1;
  select id into libros_id from public.categories where lower(name) = lower('Libros') limit 1;
  select id into mascotas_id from public.categories where lower(name) = lower('Mascotas') limit 1;
  select id into moda_id from public.categories where lower(name) = lower('Moda') limit 1;
  select id into motor_id from public.categories where lower(name) = lower('Motor') limit 1;
  select id into otros_id from public.categories where lower(name) = lower('Otros') limit 1;
  select id into belleza_id from public.categories where lower(name) = lower('Belleza') limit 1;
  select id into oficina_id from public.categories where lower(name) = lower('Oficina') limit 1;
  select id into instrumentos_id from public.categories where lower(name) = lower('Instrumentos') limit 1;
  select id into coleccionismo_id from public.categories where lower(name) = lower('Coleccionismo') limit 1;

  insert into public.subcategories (id, category_id, name, icon)
  select gen_random_uuid(), category_id, name, icon
  from (values
    (deportes_id, 'Bicicletas', '🚲'),
    (deportes_id, 'Fitness', '🏋️'),
    (deportes_id, 'Fútbol', '⚽'),
    (deportes_id, 'Running', '🏃'),
    (deportes_id, 'Deportes acuáticos', '🏄'),
    (deportes_id, 'Deportes de nieve', '⛷️'),
    (electronica_id, 'Audio', '🎧'),
    (electronica_id, 'Móviles', '📱'),
    (electronica_id, 'Ordenadores', '💻'),
    (electronica_id, 'TV', '📺'),
    (electronica_id, 'Tablets', '📲'),
    (electronica_id, 'Cámaras', '📷'),
    (electronica_id, 'Consolas', '🎮'),
    (hogar_id, 'Muebles', '🛋️'),
    (hogar_id, 'Electrodomésticos', '🧺'),
    (hogar_id, 'Decoración', '🖼️'),
    (hogar_id, 'Cocina', '🍳'),
    (hogar_id, 'Jardín', '🌿'),
    (hogar_id, 'Herramientas', '🧰'),
    (juegos_id, 'Consolas', '🎮'),
    (juegos_id, 'Videojuegos', '🕹️'),
    (juegos_id, 'Juegos de mesa', '🎲'),
    (juegos_id, 'Juguetes', '🧸'),
    (libros_id, 'Novelas', '📖'),
    (libros_id, 'Cómics', '💬'),
    (libros_id, 'Manga', '📚'),
    (libros_id, 'Libros de texto', '🎓'),
    (mascotas_id, 'Perros', '🐶'),
    (mascotas_id, 'Gatos', '🐱'),
    (mascotas_id, 'Acuarios', '🐠'),
    (mascotas_id, 'Accesorios', '🐾'),
    (moda_id, 'Complementos', '👜'),
    (moda_id, 'Ropa', '👕'),
    (moda_id, 'Zapatos', '👟'),
    (motor_id, 'Accesorios', '🔋'),
    (motor_id, 'Coches', '🚗'),
    (motor_id, 'Motos', '🏍️'),
    (belleza_id, 'Perfumes', '🧴'),
    (belleza_id, 'Maquillaje', '💄'),
    (belleza_id, 'Cuidado personal', '🪒'),
    (oficina_id, 'Material de oficina', '✏️'),
    (oficina_id, 'Mobiliario de oficina', '🪑'),
    (oficina_id, 'Impresoras', '🖨️'),
    (instrumentos_id, 'Guitarras', '🎸'),
    (instrumentos_id, 'Pianos y teclados', '🎹'),
    (instrumentos_id, 'Sonido profesional', '🎤'),
    (coleccionismo_id, 'Monedas y billetes', '🪙'),
    (coleccionismo_id, 'Cartas', '🃏'),
    (coleccionismo_id, 'Antigüedades', '🏺'),
    (otros_id, 'Otros', '📦')
  ) as s(category_id, name, icon)
  where category_id is not null
    and not exists (
      select 1
      from public.subcategories existing
      where existing.category_id = s.category_id
        and lower(existing.name) = lower(s.name)
    );
end $$;
