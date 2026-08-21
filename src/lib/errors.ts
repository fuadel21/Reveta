/**
 * Helpers para leer mensajes de error de forma segura cuando el error es
 * `unknown` (catch sin tipar). Supabase (PostgrestError) y las Edge Functions
 * devuelven objetos planos que no extienden Error, así que se comprueban por
 * forma en lugar de con `instanceof`.
 */

type ErrorLike = { message?: unknown; code?: unknown; context?: unknown };

const asErrorLike = (error: unknown): ErrorLike | null =>
  typeof error === 'object' && error !== null ? (error as ErrorLike) : null;

export const getErrorMessage = (error: unknown, fallback = 'Inténtalo de nuevo.'): string => {
  const like = asErrorLike(error);
  if (like && typeof like.message === 'string' && like.message.trim()) return like.message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
};

export const getErrorCode = (error: unknown): string | null => {
  const like = asErrorLike(error);
  return like && typeof like.code === 'string' ? like.code : null;
};

/**
 * Extrae el mensaje de error de una respuesta fallida de una Edge Function.
 * `FunctionsHttpError` expone la respuesta original en `context`; intenta leer
 * el cuerpo antes de caer en el mensaje genérico.
 */
export const getFunctionErrorMessage = async (error: unknown): Promise<string> => {
  try {
    const like = asErrorLike(error);
    const context = like?.context as { json?: unknown } | undefined;
    if (context && typeof context.json === 'function') {
      const payload = (await context.json()) as { error?: unknown; message?: unknown } | null;
      if (payload && typeof payload.error === 'string' && payload.error) return payload.error;
      if (payload && typeof payload.message === 'string' && payload.message) return payload.message;
    }
  } catch {
    // Ignora errores al parsear el cuerpo de la respuesta.
  }
  return getErrorMessage(error, 'No se pudo conectar con el servidor.');
};
