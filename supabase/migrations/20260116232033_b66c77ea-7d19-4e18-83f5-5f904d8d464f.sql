-- Add geolocation columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Create index for faster geospatial queries
CREATE INDEX IF NOT EXISTS idx_products_location ON public.products (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create a function to calculate distance between two points using Haversine formula
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  R DOUBLE PRECISION := 6371; -- Earth's radius in kilometers
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN R * c;
END;
$$;

-- Create a function to get products within a radius
CREATE OR REPLACE FUNCTION public.get_products_within_radius(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_km DOUBLE PRECISION,
  search_query TEXT DEFAULT NULL,
  category_filter UUID DEFAULT NULL,
  condition_filter TEXT DEFAULT NULL,
  min_price DOUBLE PRECISION DEFAULT NULL,
  max_price DOUBLE PRECISION DEFAULT NULL,
  sort_option TEXT DEFAULT 'distance'
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  price DOUBLE PRECISION,
  category_id UUID,
  condition TEXT,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  images TEXT[],
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.title,
    p.description,
    p.price,
    p.category_id,
    p.condition,
    p.location,
    p.latitude,
    p.longitude,
    p.images,
    p.status,
    p.created_at,
    p.updated_at,
    public.calculate_distance(user_lat, user_lon, p.latitude, p.longitude) as distance_km
  FROM public.products p
  WHERE p.status = 'active'
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND public.calculate_distance(user_lat, user_lon, p.latitude, p.longitude) <= radius_km
    AND (search_query IS NULL OR p.title ILIKE '%' || search_query || '%')
    AND (category_filter IS NULL OR p.category_id = category_filter)
    AND (condition_filter IS NULL OR p.condition = condition_filter)
    AND (min_price IS NULL OR p.price >= min_price)
    AND (max_price IS NULL OR p.price <= max_price)
  ORDER BY
    CASE WHEN sort_option = 'distance' THEN public.calculate_distance(user_lat, user_lon, p.latitude, p.longitude) END ASC,
    CASE WHEN sort_option = 'recent' THEN p.created_at END DESC,
    CASE WHEN sort_option = 'price_asc' THEN p.price END ASC,
    CASE WHEN sort_option = 'price_desc' THEN p.price END DESC;
END;
$$;