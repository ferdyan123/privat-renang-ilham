'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getPendingCount } from '@/lib/supabase'
import { isLoggedIn, logout } from '@/lib/auth'
import { ToastProvider } from '@/components/ui/Toast'
import NotificationSetup from '@/components/ui/NotificationSetup'
import Modal from '@/components/ui/Modal'

const NAV = [
  { tab: 'hari-ini',   href: '/dashboard',          icon: 'ti-calendar-check', label: 'Hari Ini' },
  { tab: 'murid',      href: '/dashboard/murid',     icon: 'ti-users',          label: 'Murid' },
  { tab: 'jadwal',     href: '/dashboard/jadwal',    icon: 'ti-clock',          label: 'Jadwal' },
  { tab: 'rekap',      href: '/dashboard/rekap',     icon: 'ti-chart-bar',      label: 'Rekap' },
  { tab: 'grafik',     href: '/dashboard/grafik',    icon: 'ti-chart-line',     label: 'Grafik' },
  { tab: 'kirim',      href: '/dashboard/kirim',     icon: 'ti-send',           label: 'Kirim' },
  { tab: 'daftar',     href: '/dashboard/daftar',    icon: 'ti-user-plus',      label: 'Daftar', badge: true },
  { tab: 'slot',       href: '/dashboard/slot',     icon: 'ti-calendar-event',  label: 'Slot' },
]

// Menu utama yang selalu keliatan di nav mobile (biar nggak sesak/berdempetan)
const MOBILE_PRIMARY_TABS = ['hari-ini', 'murid', 'jadwal', 'kirim']
const NAV_PRIMARY = NAV.filter((n) => MOBILE_PRIMARY_TABS.includes(n.tab))
const NAV_MORE = NAV.filter((n) => !MOBILE_PRIMARY_TABS.includes(n.tab))

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)
  const [authChecked, setAuthChecked] = useState(false)
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login')
    } else {
      setAuthChecked(true)
    }
  }, [router])

  const handleLogout = () => {
    if (!confirm('Keluar dari dashboard?')) return
    logout()
    router.replace('/login')
  }

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

  const pageTitle = NAV.find((n) => isActive(n.href))?.label ?? 'Privat Renang Ilham'

  if (!authChecked) return null

  return (
    <div className="flex min-h-screen">
      {/* ── SIDEBAR desktop ── */}
      <aside className="hidden lg:flex flex-col w-[220px] min-h-screen bg-bg border-r border-border fixed top-0 left-0 z-30 py-5">
        <div className="flex items-center gap-[10px] px-5 pb-5 border-b border-border mb-3">
          <img src="/icon-192.png" alt="Logo" className="w-[34px] h-[34px] rounded-md flex-shrink-0 object-cover" />
          <span className="text-base font-semibold text-text">Privat Renang Ilham</span>
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
        <button
          onClick={handleLogout}
          className="flex items-center gap-[10px] px-3 py-[9px] mx-[10px] mt-auto rounded-[10px] text-[13px] font-medium text-red hover:bg-red/5 transition-all"
        >
          <i className="ti ti-logout text-[18px] flex-shrink-0" />Keluar
        </button>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 lg:ml-[220px] bg-bg min-h-screen flex flex-col">
        {/* Mobile topbar */}
        <div className="lg:hidden sticky top-0 z-20 bg-bg border-b border-border px-4 py-3 flex items-center gap-[10px]">
          <img src="/icon-192.png" alt="Logo" className="w-8 h-8 rounded-md flex-shrink-0 object-cover" />
          <span className="text-base font-semibold text-text">Privat Renang Ilham</span>
          <span className="text-[12px] text-text-muted ml-auto mr-1">{nowFmt}</span>
          <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-full text-red hover:bg-red/5 transition-all flex-shrink-0">
            <i className="ti ti-logout text-[18px]" />
          </button>
        </div>

        {/* Mobile tabs — cuma menu utama + Lainnya, biar nggak sesak */}
        <nav className="lg:hidden sticky top-[57px] z-[19] bg-bg border-b border-border flex">
          {NAV_PRIMARY.map((n) => (
            <button
              key={n.tab}
              onClick={() => router.push(n.href)}
              className={`relative flex-1 flex flex-col items-center py-[10px] px-[6px] text-[10px] font-medium border-b-2 transition-all ${
                isActive(n.href)
                  ? 'text-[#185FA5] border-[#185FA5]'
                  : 'text-text-muted border-transparent'
              }`}
            >
              <i className={`ti ${n.icon} text-[18px] mb-0.5`} />
              {n.label}
            </button>
          ))}
          <button
            onClick={() => setShowMore(true)}
            className={`relative flex-1 flex flex-col items-center py-[10px] px-[6px] text-[10px] font-medium border-b-2 transition-all ${
              NAV_MORE.some((n) => isActive(n.href))
                ? 'text-[#185FA5] border-[#185FA5]'
                : 'text-text-muted border-transparent'
            }`}
          >
            <i className="ti ti-dots text-[18px] mb-0.5" />
            Lainnya
            {pendingCount > 0 && (
              <span className="absolute top-1 right-[calc(50%-22px)] bg-[#E24B4A] text-white text-[9px] font-bold rounded-full px-[5px] leading-[14px]">
                {pendingCount}
              </span>
            )}
          </button>
        </nav>

        {/* Bottom sheet: menu lainnya (mobile) */}
        <Modal open={showMore} onClose={() => setShowMore(false)} title="Menu Lainnya">
          <div className="grid grid-cols-2 gap-2.5">
            {NAV_MORE.map((n) => (
              <button
                key={n.tab}
                onClick={() => { router.push(n.href); setShowMore(false) }}
                className={`relative flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-all ${
                  isActive(n.href)
                    ? 'border-[#185FA5] bg-blue-light text-[#185FA5]'
                    : 'border-border text-text'
                }`}
              >
                <i className={`ti ${n.icon} text-[20px] flex-shrink-0`} />
                <span className="text-[13px] font-medium">{n.label}</span>
                {n.badge && pendingCount > 0 && (
                  <span className="absolute top-2 right-2 bg-[#E24B4A] text-white text-[9px] font-bold rounded-full px-[6px] py-0 leading-[14px]">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Modal>

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