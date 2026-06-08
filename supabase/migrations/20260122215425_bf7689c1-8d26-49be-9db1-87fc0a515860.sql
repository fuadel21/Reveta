-- Create subcategories table
CREATE TABLE public.subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint for subcategory name within category
CREATE UNIQUE INDEX subcategories_category_name_idx ON public.subcategories(category_id, name);

-- Enable RLS
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- Everyone can view subcategories
CREATE POLICY "Subcategories are viewable by everyone" 
ON public.subcategories 
FOR SELECT 
USING (true);

-- Only admins can manage subcategories
CREATE POLICY "Admins can manage subcategories" 
ON public.subcategories 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add subcategory_id to products table
ALTER TABLE public.products 
ADD COLUMN subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX products_subcategory_id_idx ON public.products(subcategory_id);

-- Insert subcategories for Motor
INSERT INTO public.subcategories (category_id, name, icon) VALUES
('38f8524c-9e55-439b-a66f-54ce037465cb', 'Coches', 'Car'),
('38f8524c-9e55-439b-a66f-54ce037465cb', 'Motos', 'Bike'),
('38f8524c-9e55-439b-a66f-54ce037465cb', 'Camiones', 'Truck'),
('38f8524c-9e55-439b-a66f-54ce037465cb', 'Furgonetas', 'Bus'),
('38f8524c-9e55-439b-a66f-54ce037465cb', 'Caravanas', 'Caravan'),
('38f8524c-9e55-439b-a66f-54ce037465cb', 'Recambios', 'Wrench'),
('38f8524c-9e55-439b-a66f-54ce037465cb', 'Accesorios', 'Settings');

-- Insert subcategories for Electrónica
INSERT INTO public.subcategories (category_id, name, icon) VALUES
('e4243b23-07df-42c5-8bbd-1a0a7b82162d', 'Móviles', 'Smartphone'),
('e4243b23-07df-42c5-8bbd-1a0a7b82162d', 'Ordenadores', 'Laptop'),
('e4243b23-07df-42c5-8bbd-1a0a7b82162d', 'Tablets', 'Tablet'),
('e4243b23-07df-42c5-8bbd-1a0a7b82162d', 'TV y Audio', 'Tv'),
('e4243b23-07df-42c5-8bbd-1a0a7b82162d', 'Fotografía', 'Camera'),
('e4243b23-07df-42c5-8bbd-1a0a7b82162d', 'Consolas', 'Gamepad2'),
('e4243b23-07df-42c5-8bbd-1a0a7b82162d', 'Componentes', 'Cpu'),
('e4243b23-07df-42c5-8bbd-1a0a7b82162d', 'Wearables', 'Watch');

-- Insert subcategories for Hogar
INSERT INTO public.subcategories (category_id, name, icon) VALUES
('9ef62d18-ffd3-42fb-bfef-d017f0b4f812', 'Muebles', 'Sofa'),
('9ef62d18-ffd3-42fb-bfef-d017f0b4f812', 'Electrodomésticos', 'Refrigerator'),
('9ef62d18-ffd3-42fb-bfef-d017f0b4f812', 'Decoración', 'Lamp'),
('9ef62d18-ffd3-42fb-bfef-d017f0b4f812', 'Jardín', 'Flower2'),
('9ef62d18-ffd3-42fb-bfef-d017f0b4f812', 'Cocina', 'ChefHat'),
('9ef62d18-ffd3-42fb-bfef-d017f0b4f812', 'Baño', 'Bath'),
('9ef62d18-ffd3-42fb-bfef-d017f0b4f812', 'Herramientas', 'Hammer');

-- Insert subcategories for Moda
INSERT INTO public.subcategories (category_id, name, icon) VALUES
('251298fc-5649-463f-a6ae-4349e008816f', 'Ropa Hombre', 'User'),
('251298fc-5649-463f-a6ae-4349e008816f', 'Ropa Mujer', 'User'),
('251298fc-5649-463f-a6ae-4349e008816f', 'Ropa Niños', 'Baby'),
('251298fc-5649-463f-a6ae-4349e008816f', 'Calzado', 'Footprints'),
('251298fc-5649-463f-a6ae-4349e008816f', 'Bolsos', 'ShoppingBag'),
('251298fc-5649-463f-a6ae-4349e008816f', 'Accesorios', 'Glasses'),
('251298fc-5649-463f-a6ae-4349e008816f', 'Joyas y Relojes', 'Watch');

-- Insert subcategories for Deportes
INSERT INTO public.subcategories (category_id, name, icon) VALUES
('b73a4253-b2cf-4dec-a862-d7225cd17b2f', 'Fitness', 'Dumbbell'),
('b73a4253-b2cf-4dec-a862-d7225cd17b2f', 'Ciclismo', 'Bike'),
('b73a4253-b2cf-4dec-a862-d7225cd17b2f', 'Fútbol', 'Circle'),
('b73a4253-b2cf-4dec-a862-d7225cd17b2f', 'Running', 'Footprints'),
('b73a4253-b2cf-4dec-a862-d7225cd17b2f', 'Natación', 'Waves'),
('b73a4253-b2cf-4dec-a862-d7225cd17b2f', 'Deportes de Invierno', 'Snowflake'),
('b73a4253-b2cf-4dec-a862-d7225cd17b2f', 'Camping', 'Tent'),
('b73a4253-b2cf-4dec-a862-d7225cd17b2f', 'Pesca', 'Fish');

-- Insert subcategories for Juegos
INSERT INTO public.subcategories (category_id, name, icon) VALUES
('4a8fc635-c862-4461-a6e2-292c7653c3d9', 'Videojuegos', 'Gamepad2'),
('4a8fc635-c862-4461-a6e2-292c7653c3d9', 'Juegos de Mesa', 'Dice5'),
('4a8fc635-c862-4461-a6e2-292c7653c3d9', 'Cartas Coleccionables', 'Layers'),
('4a8fc635-c862-4461-a6e2-292c7653c3d9', 'Puzzles', 'Puzzle'),
('4a8fc635-c862-4461-a6e2-292c7653c3d9', 'Juguetes', 'ToyBrick');

-- Insert subcategories for Mascotas
INSERT INTO public.subcategories (category_id, name, icon) VALUES
('e71fb1dc-aaee-4f08-ba18-2cb1ef7ca720', 'Perros', 'Dog'),
('e71fb1dc-aaee-4f08-ba18-2cb1ef7ca720', 'Gatos', 'Cat'),
('e71fb1dc-aaee-4f08-ba18-2cb1ef7ca720', 'Pájaros', 'Bird'),
('e71fb1dc-aaee-4f08-ba18-2cb1ef7ca720', 'Peces', 'Fish'),
('e71fb1dc-aaee-4f08-ba18-2cb1ef7ca720', 'Roedores', 'Rabbit'),
('e71fb1dc-aaee-4f08-ba18-2cb1ef7ca720', 'Accesorios', 'ShoppingBag');

-- Insert subcategories for Libros
INSERT INTO public.subcategories (category_id, name, icon) VALUES
('4789e5b2-129a-40e4-b57f-769dbada8f94', 'Novelas', 'BookOpen'),
('4789e5b2-129a-40e4-b57f-769dbada8f94', 'Cómics y Manga', 'Image'),
('4789e5b2-129a-40e4-b57f-769dbada8f94', 'Libros de Texto', 'GraduationCap'),
('4789e5b2-129a-40e4-b57f-769dbada8f94', 'Infantil', 'Baby'),
('4789e5b2-129a-40e4-b57f-769dbada8f94', 'Revistas', 'Newspaper');