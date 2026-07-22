import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://reveta.es',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const MAX_IMAGES = 3;
const MAX_DATA_URL_LENGTH = 4_500_000;
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DAILY_LIMIT = Math.max(1, Number(Deno.env.get('AI_LISTING_DAILY_LIMIT') || 5));
const COOLDOWN_SECONDS = Math.max(5, Number(Deno.env.get('AI_LISTING_COOLDOWN_SECONDS') || 20));

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const cleanJson = (value: string) => {
  const trimmed = value.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('La IA no devolvió un resultado válido');
  return JSON.parse(trimmed.slice(start, end + 1));
};

const validateImages = (images: unknown) => {
  if (!Array.isArray(images) || images.length === 0) throw new Error('Añade al menos una fotografía del producto');
  const safeImages = images.slice(0, MAX_IMAGES).map((image) => String(image || ''));
  if (safeImages.some((image) => !/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_DATA_URL_LENGTH)) {
    throw new Error('Una de las imágenes no es válida o es demasiado grande');
  }
  return safeImages;
};

const extractOutputText = (payload: any) => {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const content = Array.isArray(payload?.output)
    ? payload.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    : [];
  return String(content.find((item: any) => item?.type === 'output_text')?.text || '');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('GROQ_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey) return respond({ error: 'Groq todavía no está configurado en el servidor' }, 503);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return respond({ error: 'Supabase no está configurado para controlar el uso de IA' }, 503);

  const authorization = req.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return respond({ error: 'Debes iniciar sesión para usar el asistente', code: 'UNAUTHENTICATED' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let usageId: string | null = null;

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return respond({ error: 'La sesión no es válida', code: 'UNAUTHENTICATED' }, 401);

    const { data: claim, error: claimError } = await userClient.rpc('claim_ai_listing_usage', {
      p_daily_limit: DAILY_LIMIT,
      p_cooldown_seconds: COOLDOWN_SECONDS,
    });
    if (claimError) {
      console.error('AI usage claim error:', claimError);
      return respond({ error: 'No se pudo comprobar el límite de uso' }, 500);
    }

    if (!claim?.ok) {
      if (claim?.code === 'COOLDOWN') {
        return respond({
          error: `Espera ${claim.retry_after_seconds || COOLDOWN_SECONDS} segundos antes de volver a intentarlo.`,
          code: 'COOLDOWN',
          retry_after_seconds: claim.retry_after_seconds,
          remaining: claim.remaining,
          reset_at: claim.reset_at,
        }, 429);
      }
      return respond({
        error: 'Has agotado los análisis gratuitos de hoy. Podrás volver a usar el asistente mañana.',
        code: 'DAILY_LIMIT',
        remaining: 0,
        reset_at: claim?.reset_at,
      }, 429);
    }

    usageId = String(claim.usage_id);
    const body = await req.json();
    const action = String(body?.action || 'analyze');
    if (action !== 'analyze') throw new Error('Groq solo permite analizar fotos y generar texto');

    const images = validateImages(body?.images);
    const categories = Array.isArray(body?.categories) ? body.categories.slice(0, 100) : [];
    const notes = String(body?.notes || '').trim().slice(0, 800);
    const current = body?.current && typeof body.current === 'object' ? body.current : {};
    const categoryText = categories.map((category: any) => {
      const subs = Array.isArray(category?.subcategories)
        ? category.subcategories.map((sub: any) => sub?.name).filter(Boolean).join(', ')
        : '';
      return `- ${category?.name || ''}${subs ? ` (subcategorías: ${subs})` : ''}`;
    }).join('\n');

    const prompt = `Eres el asistente de publicación de Reveta, un marketplace de segunda mano en España.
Analiza solo lo que sea razonablemente visible en las fotos y la información aportada. No inventes marca, modelo, capacidad, autenticidad, accesorios, funcionamiento ni defectos. Cuando algo no sea seguro, añádelo a warnings.

Devuelve SOLO JSON válido con esta forma exacta:
{
  "title": "máximo 100 caracteres",
  "description": "descripción clara en español, entre 80 y 900 caracteres",
  "category_name": "categoría exacta de la lista o cadena vacía",
  "subcategory_name": "subcategoría exacta de la lista o cadena vacía",
  "condition": "new|like_new|good|fair|poor|",
  "suggested_price": número o null,
  "price_min": número o null,
  "price_max": número o null,
  "tags": ["hasta seis etiquetas"],
  "photo_tips": ["hasta tres fotos adicionales recomendadas"],
  "warnings": ["datos que el vendedor debe comprobar"],
  "confidence": número entre 0 y 100
}

Reglas:
- El precio es orientativo en euros. Si no puedes estimarlo, usa null.
- No incluyas teléfonos, correos, enlaces ni formas de pago.
- No ocultes defectos visibles.
- Categoría y subcategoría deben coincidir literalmente con una opción disponible.

Categorías disponibles:
${categoryText || 'Sin categorías disponibles'}

Datos ya escritos:
${JSON.stringify(current)}

Notas del usuario:
${notes || 'Ninguna'}`;

    const response = await fetch(`${GROQ_BASE_URL}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('GROQ_LISTING_MODEL') || 'qwen/qwen3.6-27b',
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            ...images.map((image_url) => ({ type: 'input_image', image_url, detail: 'auto' })),
          ],
        }],
        max_output_tokens: 1400,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      const errorCode = response.status === 429 ? 'GROQ_LIMIT' : `GROQ_${response.status}`;
      await adminClient.from('ai_listing_usage').update({ status: 'failed', error_code: errorCode, completed_at: new Date().toISOString() }).eq('id', usageId);
      return respond({
        error: response.status === 429
          ? 'Se alcanzó el límite gratuito global de Groq. Inténtalo más tarde.'
          : payload?.error?.message || 'Groq no pudo analizar el producto',
        code: errorCode,
        remaining: claim.remaining,
        reset_at: claim.reset_at,
      }, response.status);
    }

    const outputText = extractOutputText(payload);
    if (!outputText) throw new Error('Groq no devolvió una propuesta de anuncio');
    const result = cleanJson(outputText);
    await adminClient.from('ai_listing_usage').update({ status: 'success', completed_at: new Date().toISOString() }).eq('id', usageId);

    return respond({
      result,
      provider: 'groq',
      model: payload?.model || null,
      remaining: claim.remaining,
      reset_at: claim.reset_at,
    });
  } catch (error) {
    console.error('ai-listing-assistant Groq error:', error);
    if (usageId) {
      await adminClient.from('ai_listing_usage').update({ status: 'failed', error_code: 'INTERNAL_ERROR', completed_at: new Date().toISOString() }).eq('id', usageId);
    }
    return respond({ error: error instanceof Error ? error.message : 'No se pudo completar la solicitud' }, 500);
  }
});
