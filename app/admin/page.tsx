import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { getLocalizedText } from '@/types/database'

export const metadata: Metadata = { title: 'Dashboard — LocalReach' }

export default async function AdminIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: stores } = await supabase
    .from('stores')
    .select('id, store_name, default_language, brand_color')
    .order('created_at', { ascending: true })

  if (!stores || stores.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
            LocalReach · Dashboard
          </p>
          <h1 className="text-lg font-bold text-slate-900">No stores found</h1>
          <p className="text-sm text-slate-500">Contact support to set up your store.</p>
        </div>
      </div>
    )
  }

  if (stores.length === 1) redirect(`/admin/${stores[0].id}`)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
            LocalReach · Dashboard
          </p>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">Your Stores</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8 space-y-3">
        {stores.map((store) => {
          const name = getLocalizedText(
            store.store_name,
            store.default_language,
            store.default_language,
          )
          return (
            <a
              key={store.id}
              href={`/admin/${store.id}`}
              className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white
                px-5 py-4 shadow-sm hover:border-slate-400 hover:shadow-md transition-all"
            >
              <div
                className="h-8 w-8 shrink-0 rounded-lg"
                style={{ backgroundColor: store.brand_color ?? '#0f172a' }}
              />
              <div>
                <p className="text-sm font-bold text-slate-900">{name}</p>
                <p className="text-xs text-slate-400 font-mono">{store.id.slice(0, 8)}…</p>
              </div>
              <span className="ml-auto text-slate-300 text-lg leading-none">›</span>
            </a>
          )
        })}
      </main>
    </div>
  )
}
