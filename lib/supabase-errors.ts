/**
 * PostgREST answers a SELECT that names a column the live schema lacks with
 * 42703 (undefined_column) or PGRST204 (schema cache). Reads that add a column
 * in the same release as a migration use this to degrade instead of 404-ing
 * every store when the code reaches Vercel before the migration reaches the
 * database (the same shape /api/customer-leads uses for customer_name).
 */
export type SupabaseErrorLike = {
  code?: string
  message?: string
  details?: string
  hint?: string
} | null

export function isMissingColumnError(error: SupabaseErrorLike, column: string): boolean {
  if (!error) return false
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return (
    (error.code === '42703' || error.code === 'PGRST204' || text.includes('column')) &&
    text.includes(column.toLowerCase())
  )
}
