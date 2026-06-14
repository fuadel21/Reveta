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
  palma: { latitude: 39.5696, longitude: 2.6502, displayName: 'Palma' },
  'palma de mallorca': { latitude: 39.5696, longitude: 2.6502, displayName: 'Palma de Mallorca' },
  'las palmas': { latitude: 28.1235, longitude: -15.4363, displayName: 'Las Palmas de Gran Canaria' },
  bilbao: { latitude: 43.263, longitude: -2.935, displayName: 'Bilbao' },
  alicante: { latitude: 38.3452, longitude: -0.481, displayName: 'Alicante' },
  cordoba: { latitude: 37.8882, longitude: -4.7794, displayName: 'Córdoba' },
  valladolid: { latitude: 41.6523, longitude: -4.7245, displayName: 'Valladolid' },
  vigo: { latitude: 42.2406, longitude: -8.7207, displayName: 'Vigo' },
  gijon: { latitude: 43.5322, longitude: -5.6611, displayName: 'Gijón' },
  'a coruna': { latitude: 43.3623, longitude: -8.4115, displayName: 'A Coruña' },
  coruna: { latitude: 43.3623, longitude: -8.4115, displayName: 'A Coruña' },
  granada: { latitude: 37.1773, longitude: -3.5986, displayName: 'Granada' },
  elche: { latitude: 38.2699, longitude: -0.7126, displayName: 'Elche' },
  oviedo: { latitude: 43.3619, longitude: -5.8494, displayName: 'Oviedo' },
  badalona: { latitude: 41.4500, longitude: 2.2474, displayName: 'Badalona' },
  cartagena: { latitude: 37.6257, longitude: -0.9966, displayName: 'Cartagena' },
  terrassa: { latitude: 41.5632, longitude: 2.0089, displayName: 'Terrassa' },
  jerez: { latitude: 36.685, longitude: -6.1261, displayName: 'Jerez de la Frontera' },
  sabadell: { latitude: 41.5463, longitude: 2.1086, displayName: 'Sabadell' },
  mostoles: { latitude: 40.3223, longitude: -3.8649, displayName: 'Móstoles' },
  alcala: { latitude: 40.48198, longitude: -3.36354, displayName: 'Alcalá de Henares' },
  'alcala de henares': { latitude: 40.48198, longitude: -3.36354, displayName: 'Alcalá de Henares' },
  pamplona: { latitude: 42.8125, longitude: -1.6458, displayName: 'Pamplona' },
  santander: { latitude: 43.4623, longitude: -3.8099, displayName: 'Santander' },
  burgos: { latitude: 42.3439, longitude: -3.6969, displayName: 'Burgos' },
  almeria: { latitude: 36.8340, longitude: -2.4637, displayName: 'Almería' },
  salamanca: { latitude: 40.9701, longitude: -5.6635, displayName: 'Salamanca' },
  leon: { latitude: 42.5987, longitude: -5.5671, displayName: 'León' },
  cadiz: { latitude: 36.5271, longitude: -6.2886, displayName: 'Cádiz' },
  huelva: { latitude: 37.2614, longitude: -6.9447, displayName: 'Huelva' },
  logrono: { latitude: 42.4627, longitude: -2.4449, displayName: 'Logroño' },
  badajoz: { latitude: 38.8794, longitude: -6.9707, displayName: 'Badajoz' },
};

const normalize = (value: string) => value
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

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

    const fallback = FALLBACK_CITIES[normalize(rawLocation)];
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

    const query = encodeURIComponent(`${rawLocation}, España`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es&q=${query}`;
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
    const result = Array.isArray(results) ? results[0] : null;

    if (!result?.lat || !result?.lon) {
      return new Response(JSON.stringify({ error: 'No se encontró la ubicación' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      displayName: result.display_name,
      source: 'nominatim',
    }), {
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
