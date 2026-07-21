const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://reveta.es',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const MAX_IMAGES = 3;
const MAX_DATA_URL_LENGTH = 4_500_000;
const XAI_BASE_URL = 'https://api.x.ai/v1';

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

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
  }
  return btoa(binary);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('XAI_API_KEY');
  if (!apiKey) return respond({ error: 'Grok todavía no está configurado en el servidor' }, 503);

  try {
    const body = await req.json();
    const action = String(body?.action || 'analyze');
    const images = validateImages(body?.images);

    if (action === 'analyze') {
      const categories = Array.isArray(body?.categories) ? body.categories.slice(0, 100) : [];
      const notes = String(body?.notes || '').trim().slice(0, 800);
      const current = body?.current && typeof body.current === 'object' ? body.current : {};
      const categoryText = categories.map((category: any) => {
        const subs = Array.isArray(category?.subcategories)
          ? category.subcategories.map((sub: any) => sub?.name).filter(Boolean).join(', ')
          : '';
        return `- ${category?.name || ''}${subs ? ` (subcategorías: ${subs})` : ''}`;
      }).join('\n');

      const prompt = `Eres Grok actuando como asistente de publicación de Reveta, un marketplace de segunda mano en España.
Analiza únicamente lo que sea razonablemente visible en las fotos y la información del usuario. No inventes marca, modelo, capacidad, autenticidad, accesorios, funcionamiento ni defectos. Cuando algo no sea seguro, indícalo como dato que el vendedor debe revisar.

Devuelve SOLO un objeto JSON válido con esta forma exacta:
{
  "title": "máximo 100 caracteres",
  "description": "descripción clara en español, entre 80 y 900 caracteres, con párrafos breves",
  "category_name": "una categoría exacta de la lista o cadena vacía",
  "subcategory_name": "una subcategoría exacta de la lista o cadena vacía",
  "condition": "new|like_new|good|fair|poor|",
  "suggested_price": número o null,
  "price_min": número o null,
  "price_max": número o null,
  "tags": ["hasta", "seis", "etiquetas"],
  "photo_tips": ["hasta tres fotos adicionales que convendría tomar"],
  "warnings": ["datos que el vendedor debe comprobar"],
  "confidence": número entre 0 y 100
}

Reglas:
- El precio es solo orientativo en euros y debe ser prudente. Si no puedes estimarlo, usa null.
- No incluyas teléfonos, correos, enlaces, formas de pago ni afirmaciones legales.
- No ocultes defectos visibles.
- category_name y subcategory_name deben coincidir literalmente con una opción disponible.

Categorías disponibles:
${categoryText || 'Sin categorías disponibles'}

Datos ya escritos por el usuario:
${JSON.stringify(current)}

Notas adicionales del usuario:
${notes || 'Ninguna'}`;

      const response = await fetch(`${XAI_BASE_URL}/responses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: Deno.env.get('XAI_LISTING_MODEL') || 'grok-4.5',
          store: false,
          input: [{
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              ...images.map((image_url) => ({ type: 'input_image', image_url, detail: 'high' })),
            ],
          }],
          max_output_tokens: 1400,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        console.error('xAI Grok listing analysis error:', payload);
        return respond({ error: payload?.error?.message || 'Grok no pudo analizar el producto' }, response.status);
      }

      const outputText = extractOutputText(payload);
      if (!outputText) return respond({ error: 'Grok no devolvió una propuesta de anuncio' }, 502);
      return respond({ result: cleanJson(outputText), provider: 'xai', model: payload?.model || null });
    }

    if (action === 'enhance-image') {
      const title = String(body?.title || 'producto de segunda mano').trim().slice(0, 120);
      const notes = String(body?.notes || '').trim().slice(0, 400);
      const prompt = `Edita esta fotografía real para usarla como imagen principal de un anuncio de marketplace. Conserva exactamente el mismo producto, sus colores, forma, desgaste, daños, accesorios visibles y proporciones. No añadas piezas, marcas, texto, logotipos, embalajes ni características inexistentes. Mejora iluminación, encuadre y nitidez de forma natural; elimina únicamente distracciones del fondo y coloca un fondo neutro claro con sombra suave. Debe seguir pareciendo una fotografía honesta del producto real. Producto indicado: ${title}. Notas del vendedor: ${notes || 'ninguna'}.`;

      const imageResponse = await fetch(`${XAI_BASE_URL}/images/edits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: Deno.env.get('XAI_IMAGE_MODEL') || 'grok-imagine-image-quality',
          prompt,
          image: { url: images[0], type: 'image_url' },
          response_format: 'b64_json',
        }),
      });

      const imagePayload = await imageResponse.json();
      if (!imageResponse.ok) {
        console.error('xAI Grok image edit error:', imagePayload);
        return respond({ error: imagePayload?.error?.message || 'Grok no pudo mejorar la fotografía' }, imageResponse.status);
      }

      const imageResult = imagePayload?.data?.[0];
      if (imageResult?.b64_json) {
        return respond({ image: `data:image/jpeg;base64,${imageResult.b64_json}`, ai_generated: true, provider: 'xai' });
      }

      if (imageResult?.url) {
        const generatedResponse = await fetch(imageResult.url);
        if (!generatedResponse.ok) return respond({ error: 'No se pudo descargar la imagen creada por Grok' }, 502);
        const mimeType = generatedResponse.headers.get('content-type') || imageResult?.mime_type || 'image/jpeg';
        const base64 = arrayBufferToBase64(await generatedResponse.arrayBuffer());
        return respond({ image: `data:${mimeType};base64,${base64}`, ai_generated: true, provider: 'xai' });
      }

      return respond({ error: 'Grok no devolvió ninguna imagen' }, 502);
    }

    return respond({ error: 'Acción no válida' }, 400);
  } catch (error) {
    console.error('ai-listing-assistant xAI error:', error);
    return respond({ error: error instanceof Error ? error.message : 'No se pudo completar la solicitud' }, 500);
  }
});