const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK_CITIES: Record<string, { latitude: number; longitude: number; displayName: string }> = {
  madrid: { latitude: 40.4168, longitude: -3.7038, displayName: 'Madrid' },
  barcelona: { latitude: 41.3874, longitude: 2.1686, displayName: 'Barcelona' },
  valencia: { latitude: 39.4699, longitude: -0.3763, displayName: 'Valencia' },
  sevilla: { latitude: 37.3891, longitude: -5.9845, displayName: 'Sevilla' },
  zaragoza: { latitude: 41.6488, longitude: -0.8891, displayName: 'Zaragoza' },
  malaga: { latitude: 36.7213, longitude: -4.4214, displayName: 'Málaga' },
  murcia: { latitude: 37.9922, longitude: -1.1307, displayName: 'Murcia' },
  pineda: { latitude: 41.627222, longitude: 2.691111, displayName: 'Pineda de Mar' },
  'pineda de mar': { latitude: 41.627222, longitude: 2.691111, displayName: 'Pineda de Mar' },
};

const normalize = (value: string) => value
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[.,;:()\[\]]/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/^(ciudad|municipio|localidad|pueblo|villa|zona|area)\s+(de\s+)?/, '')
  .trim();

const buildSearchQueries = (rawLocation: string) => {
  const cleaned = normalize(rawLocation);
  const withoutProvince = normalize(cleaned.split(',')[0] || cleaned);
  const queries = [
    rawLocation,
    cleaned,
    withoutProvince,
    `${cleaned}, España`,
    `${withoutProvince}, España`,
  ];

  return Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean)));
};

const geocodeWithNominatim = async (query: string) => {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=es&addressdetails=1&q=${encodedQuery}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Reveta geocoder / reveta.es',
      'Accept-Language': 'es',
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoder error ${response.status}`);
  }

  const results = await response.json();
  if (!Array.isArray(results)) return null;

  return results.find((result) => {
    const type = String(result?.type || '').toLowerCase();
    const category = String(result?.class || '').toLowerCase();
    return result?.lat && result?.lon && (
      category === 'place' ||
      ['city', 'town', 'village', 'municipality', 'administrative', 'suburb', 'hamlet'].includes(type)
    );
  }) || results.find((result) => result?.lat && result?.lon) || null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { location } = await req.json();
    const rawLocation = String(location || '').trim();

    if (!rawLocation) {
      return new Response(JSON.stringify({ error: 'Falta la ciudad o ubicación' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedLocation = normalize(rawLocation);
    const fallback = FALLBACK_CITIES[normalizedLocation];
    if (fallback) {
      return new Response(JSON.stringify({
        latitude: fallback.latitude,
        longitude: fallback.longitude,
        displayName: fallback.displayName,
        source: 'fallback',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const queries = buildSearchQueries(rawLocation);
    for (const query of queries) {
      const result = await geocodeWithNominatim(query);
      if (result?.lat && result?.lon) {
        return new Response(JSON.stringify({
          latitude: Number(result.lat),
          longitude: Number(result.lon),
          displayName: result.display_name,
          source: 'nominatim',
          query,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'No se encontró la ubicación' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('geocode-location error:', error);
    return new Response(JSON.stringify({ error: 'No se pudo convertir la ciudad en coordenadas' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
