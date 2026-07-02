'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getPendingCount } from '@/lib/supabase'
import { ToastProvider } from '@/components/ui/Toast'
import NotificationSetup from '@/components/ui/NotificationSetup'

const NAV = [
  { tab: 'hari-ini',   href: '/dashboard',          icon: 'ti-calendar-check', label: 'Hari Ini' },
  { tab: 'murid',      href: '/dashboard/murid',     icon: 'ti-users',          label: 'Murid' },
  { tab: 'jadwal',     href: '/dashboard/jadwal',    icon: 'ti-clock',          label: 'Jadwal' },
  { tab: 'rekap',      href: '/dashboard/rekap',     icon: 'ti-chart-bar',      label: 'Rekap' },
  { tab: 'grafik',     href: '/dashboard/grafik',    icon: 'ti-chart-line',     label: 'Grafik' },
  { tab: 'kirim',      href: '/dashboard/kirim',     icon: 'ti-send',           label: 'Kirim' },
  { tab: 'daftar',     href: '/dashboard/daftar',    icon: 'ti-user-plus',      label: 'Daftar', badge: true },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [pending, tagihan] = await Promise.all([
          getPendingCount(),
          import('@/lib/supabase').then(m => 
            m.supabase.from('tagihan').select('*', { count: 'exact', head: true }).eq('status', 'menunggu_konfirmasi').then(r => r.count ?? 0)
          )
        ])
        setPendingCount((pending as number) + (tagihan as number))
      } catch {}
    }
    loadCounts()
  }, [pathname])

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const nowFmt = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
  const nowFull = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const pageTitle = NAV.find((n) => isActive(n.href))?.label ?? 'SwimTrack'

  return (
    <div className="flex min-h-screen">
      {/* ── SIDEBAR desktop ── */}
      <aside className="hidden lg:flex flex-col w-[220px] min-h-screen bg-bg border-r border-border fixed top-0 left-0 z-30 py-5">
        <div className="flex items-center gap-[10px] px-5 pb-5 border-b border-border mb-3">
          <div className="w-[34px] h-[34px] bg-[#185FA5] rounded-md flex items-center justify-center flex-shrink-0">
            <i className="ti ti-ripple text-white text-xl" />
          </div>
          <span className="text-base font-semibold text-text">SwimTrack</span>
        </div>
        <div className="text-[11px] text-text-muted px-5 mb-2">{nowFull}</div>
        <nav className="flex flex-col gap-0.5 px-[10px]">
          {NAV.map((n) => (
            <button
              key={n.tab}
              onClick={() => router.push(n.href)}
              className={`flex items-center gap-[10px] px-3 py-[9px] rounded-[10px] text-[13px] font-medium w-full text-left transition-all ${
                isActive(n.href)
                  ? 'bg-blue-light text-[#185FA5] font-semibold'
                  : 'text-text-muted hover:bg-bg-2 hover:text-text'
              }`}
            >
              <i className={`ti ${n.icon} text-[18px] flex-shrink-0`} />
              {n.label}
              {n.badge && pendingCount > 0 && (
                <span className="ml-auto bg-[#E24B4A] text-white text-[9px] font-bold rounded-full px-[6px] py-0 leading-[14px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 lg:ml-[220px] bg-bg min-h-screen flex flex-col">
        {/* Mobile topbar */}
        <div className="lg:hidden sticky top-0 z-20 bg-bg border-b border-border px-4 py-3 flex items-center gap-[10px]">
          <div className="w-8 h-8 bg-[#185FA5] rounded-md flex items-center justify-center flex-shrink-0">
            <i className="ti ti-ripple text-white text-[18px]" />
          </div>
          <span className="text-base font-semibold text-text">SwimTrack</span>
          <span className="text-[12px] text-text-muted ml-auto">{nowFmt}</span>
        </div>

        {/* Mobile tabs */}
        <nav className="lg:hidden sticky top-[57px] z-[19] bg-bg border-b border-border flex overflow-x-auto scrollbar-none">
          {NAV.map((n) => (
            <button
              key={n.tab}
              onClick={() => router.push(n.href)}
              className={`relative flex-1 min-w-[48px] flex flex-col items-center py-[10px] px-[6px] text-[10px] font-medium border-b-2 transition-all whitespace-nowrap ${
                isActive(n.href)
                  ? 'text-[#185FA5] border-[#185FA5]'
                  : 'text-text-muted border-transparent'
              }`}
            >
              <i className={`ti ${n.icon} text-[18px] mb-0.5`} />
              {n.label}
              {n.badge && pendingCount > 0 && (
                <span className="absolute top-1 right-[calc(50%-22px)] bg-[#E24B4A] text-white text-[9px] font-bold rounded-full px-[5px] leading-[14px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Desktop header */}
        <div className="hidden lg:flex items-center justify-between px-7 pt-5 pb-4 border-b border-border">
          <div className="text-xl font-semibold text-text">{pageTitle}</div>
          <div className="text-[13px] text-text-muted">{nowFull}</div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 lg:px-7 lg:py-6">{children}</main>
      </div>

      <ToastProvider />
      <NotificationSetup />
    </div>
  )
}