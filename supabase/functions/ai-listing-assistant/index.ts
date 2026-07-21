const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://reveta.es',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const MAX_IMAGES = 3;
const MAX_DATA_URL_LENGTH = 4_500_000;

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const cleanJson = (value: string) => {
  const trimmed = value.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('La IA no devolvió un resultado válido');
  return JSON.parse(trimmed.slice(start, end + 1));
};

const dataUrlToBlob = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error('Formato de imagen no válido');
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  return { blob: new Blob([bytes], { type: match[1] }), mimeType: match[1] };
};

const validateImages = (images: unknown) => {
  if (!Array.isArray(images) || images.length === 0) throw new Error('Añade al menos una fotografía del producto');
  const safeImages = images.slice(0, MAX_IMAGES).map((image) => String(image || ''));
  if (safeImages.some((image) => !image.startsWith('data:image/') || image.length > MAX_DATA_URL_LENGTH)) {
    throw new Error('Una de las imágenes no es válida o es demasiado grande');
  }
  return safeImages;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return respond({ error: 'La IA todavía no está configurada en el servidor' }, 503);

  try {
    const body = await req.json();
    const action = String(body?.action || 'analyze');
    const images = validateImages(body?.images);

    if (action === 'analyze') {
      const categories = Array.isArray(body?.categories) ? body.categories.slice(0, 100) : [];
      const notes = String(body?.notes || '').trim().slice(0, 800);
      const current = body?.current && typeof body.current === 'object' ? body.current : {};
      const categoryText = categories.map((category: any) => {
        const subs = Array.isArray(category?.subcategories) ? category.subcategories.map((sub: any) => sub?.name).filter(Boolean).join(', ') : '';
        return `- ${category?.name || ''}${subs ? ` (subcategorías: ${subs})` : ''}`;
      }).join('\n');

      const prompt = `Eres el asistente de publicación de Reveta, un marketplace de segunda mano en España.
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

      const inputContent = [
        { type: 'input_text', text: prompt },
        ...images.map((image_url) => ({ type: 'input_image', image_url })),
      ];

      const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: Deno.env.get('OPENAI_LISTING_MODEL') || 'gpt-4.1-mini',
          input: [{ role: 'user', content: inputContent }],
          max_output_tokens: 1400,
        }),
      });

      const payload = await openAIResponse.json();
      if (!openAIResponse.ok) {
        console.error('OpenAI listing analysis error:', payload);
        return respond({ error: payload?.error?.message || 'No se pudo analizar el producto' }, openAIResponse.status);
      }

      const outputText = String(payload?.output_text || payload?.output?.flatMap((item: any) => item?.content || []).find((item: any) => item?.type === 'output_text')?.text || '');
      const result = cleanJson(outputText);
      return respond({ result });
    }

    if (action === 'enhance-image') {
      const { blob, mimeType } = dataUrlToBlob(images[0]);
      const title = String(body?.title || 'producto de segunda mano').trim().slice(0, 120);
      const notes = String(body?.notes || '').trim().slice(0, 400);
      const form = new FormData();
      form.append('model', Deno.env.get('OPENAI_IMAGE_MODEL') || 'gpt-image-1');
      form.append('image', blob, mimeType === 'image/png' ? 'producto.png' : mimeType === 'image/webp' ? 'producto.webp' : 'producto.jpg');
      form.append('size', '1024x1024');
      form.append('quality', 'medium');
      form.append('output_format', 'png');
      form.append('prompt', `Edita esta fotografía real para usarla como imagen principal de un anuncio de marketplace. Conserva exactamente el mismo producto, sus colores, forma, desgaste, daños, accesorios visibles y proporciones. No añadas piezas, marcas, texto, logotipos, embalajes ni características inexistentes. Mejora iluminación, encuadre y nitidez de forma natural; elimina únicamente distracciones del fondo y coloca un fondo neutro claro con sombra suave. Debe seguir pareciendo una fotografía honesta del producto real. Producto indicado: ${title}. Notas del vendedor: ${notes || 'ninguna'}.`);

      const imageResponse = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      const imagePayload = await imageResponse.json();
      if (!imageResponse.ok) {
        console.error('OpenAI image edit error:', imagePayload);
        return respond({ error: imagePayload?.error?.message || 'No se pudo mejorar la fotografía' }, imageResponse.status);
      }
      const base64 = imagePayload?.data?.[0]?.b64_json;
      if (!base64) return respond({ error: 'La IA no devolvió ninguna imagen' }, 502);
      return respond({ image: `data:image/png;base64,${base64}`, ai_generated: true });
    }

    return respond({ error: 'Acción no válida' }, 400);
  } catch (error) {
    console.error('ai-listing-assistant error:', error);
    return respond({ error: error instanceof Error ? error.message : 'No se pudo completar la solicitud' }, 500);
  }
});
