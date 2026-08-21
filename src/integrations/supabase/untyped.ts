import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './client';

/**
 * Vista del cliente Supabase **sin** los tipos generados de `types.ts`.
 *
 * `types.ts` está desactualizado respecto a `supabase/migrations`: tablas como
 * `offers`, `user_blocks`, `safety_reports`, `product_reservations`,
 * `user_reputation` o `saved_searches` aún no aparecen en él. Mientras se
 * regeneran los tipos desde la base de datos, las consultas a esas tablas usan
 * este cliente en lugar de esparcir `as any` por el código.
 *
 * Cuando `types.ts` vuelva a generarse desde la base de datos, este cliente se
 * puede eliminar y sus usos volver a `supabase`.
 */
export const supabaseUntyped: SupabaseClient = supabase as unknown as SupabaseClient;

/** Builder de consulta (.from(...).select(...)) del cliente sin tipos. */
export type UntypedFilterBuilder = ReturnType<ReturnType<SupabaseClient['from']>['select']>;
