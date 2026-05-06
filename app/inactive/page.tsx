import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Service Inactive — LocalReach' }

export default function InactivePage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-slate-500"
            aria-hidden="true"
          >
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
            <line x1="12" y1="2" x2="12" y2="12" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900">Service Inactive</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            This service is currently unavailable. Please contact your service provider for assistance.
          </p>
        </div>
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-300">
          LocalReach
        </p>
      </div>
    </main>
  )
}
