/**
 * Utilidades para consultas Supabase lanzadas con Promise.allSettled, donde
 * cada promesa resuelve a `{ data, error }`. Centralizan la lectura de filas y
 * la detección de secciones fallidas sin recurrir a `any`.
 */
export type QuerySettledResult = PromiseSettledResult<{ data: unknown[] | null; error: unknown | null }>;

/** Devuelve las filas de un resultado resuelto sin error, o un array vacío. */
export const rowsFrom = <T,>(result: QuerySettledResult): T[] =>
  result.status === 'fulfilled' && !result.value.error ? ((result.value.data || []) as T[]) : [];

/** Indica si una sección de la consulta falló (promesa rechazada o error de Supabase). */
export const queryFailed = (result: QuerySettledResult): boolean =>
  result.status === 'rejected' || (result.status === 'fulfilled' && Boolean(result.value.error));

/** Número de secciones fallidas de un lote Promise.allSettled. */
export const countFailed = (results: QuerySettledResult[]): number =>
  results.filter(queryFailed).length;
