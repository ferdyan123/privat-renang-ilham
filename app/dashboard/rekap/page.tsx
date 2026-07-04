'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { getMurid, getSesi, getAbsensi, Murid, Sesi } from '@/lib/supabase'
import { fmtBulan, bulanStr } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import Avatar from '@/components/ui/Avatar'

interface MuridStat {
  murid: Murid
  hadir: number
  izin: number
  alpha: number
  total: number
  pct: number
}

export default function RekapPage() {
  const [bulan, setBulan] = useState(bulanStr())
  const [stats, setStats] = useState<MuridStat[]>([])
  const [loading, setLoading] = useState(false)
  const [bulanList, setBulanList] = useState<string[]>([])
  const pathname = usePathname()

  const initBulan = useCallback(async () => {
    try {
      const sesiAll = await getSesi(200)
      const months = Array.from(new Set(sesiAll.map((s) => s.tanggal.slice(0, 7)))).sort().reverse()
      setBulanList(months)
      if (months[0] && !bulan) setBulan(months[0])
    } catch { showToast('Gagal load data', 'error') }
  }, [])

  useEffect(() => { initBulan() }, [])
  // Re-fetch saat tab aktif (pathname berubah ke rekap)
  useEffect(() => { if (pathname?.includes('rekap')) initBulan() }, [pathname])

  useEffect(() => {
    if (!bulan) return
    const load = async () => {
      setLoading(true)
      try {
        const [muridAll, sesiAll] = await Promise.all([getMurid(), getSesi(200)])
        const sesiBulan = sesiAll.filter((s) => s.tanggal.startsWith(bulan))
        const allAbs = await Promise.all(sesiBulan.map((s) => getAbsensi(s.id)))
        const absFlat = allAbs.flat()

        const result: MuridStat[] = muridAll.map((m) => {
          const mine = absFlat.filter((a) => a.murid_id === m.id)
          const hadir = mine.filter((a) => a.status === 'hadir').length
          const izin = mine.filter((a) => a.status === 'izin').length
          const alpha = mine.filter((a) => a.status === 'alpha').length
          const total = sesiBulan.length
          return { murid: m, hadir, izin, alpha, total, pct: total ? Math.round(hadir / total * 100) : 0 }
        })
        result.sort((a, b) => b.pct - a.pct)
        setStats(result)
      } catch { showToast('Gagal load rekap', 'error') }
      finally { setLoading(false) }
    }
    load()
  }, [bulan])

  const pctColor = (p: number) => p >= 80 ? 'text-green' : p >= 60 ? 'text-yellow' : 'text-red'
  const barColor = (p: number) => p >= 80 ? 'bg-green' : p >= 60 ? 'bg-yellow' : 'bg-red'

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Bulan picker */}
      <div className="mb-4">
        <select
          value={bulan}
          onChange={(e) => setBulan(e.target.value)}
          className="border border-border rounded-md px-3 py-2 text-sm bg-bg text-text"
        >
          {bulanList.map((b) => <option key={b} value={b}>{fmtBulan(b)}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      {stats.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Rata kehadiran', val: `${Math.round(stats.reduce((s,x)=>s+x.pct,0)/stats.length)}%`, color: 'text-blue' },
            { label: 'Hadir terbanyak', val: stats[0]?.murid.nama.split(' ')[0], color: 'text-green' },
            { label: 'Total sesi', val: stats[0]?.total, color: 'text-text' },
          ].map((c) => (
            <div key={c.label} className="bg-bg border border-border rounded-lg p-3 text-center shadow-sm">
              <div className={`text-[18px] font-bold ${c.color}`}>{c.val}</div>
              <div className="text-[11px] text-text-muted mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-text-muted text-sm">
          <i className="ti ti-loader-2 text-3xl block mb-2 animate-spin" />Menghitung...
        </div>
      )}

      {/* Murid stats */}
      <div className="flex flex-col gap-2">
        {stats.map(({ murid, hadir, izin, alpha, total, pct }, idx) => (
          <div key={murid.id} className="bg-bg border border-border rounded-lg px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-[12px] font-bold text-text-muted w-5 text-center">{idx + 1}</div>
              <Avatar nama={murid.nama} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-text truncate">{murid.nama}</div>
                <div className="text-[11px] text-text-muted">{murid.paket}</div>
              </div>
              <div className={`text-[18px] font-bold ${pctColor(pct)}`}>{pct}%</div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-bg-3 rounded-full overflow-hidden mb-2">
              <div className={`h-full ${barColor(pct)} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
            {/* Breakdown */}
            <div className="flex gap-2">
              {[
                { label: 'Hadir', val: hadir, cls: 'text-blue' },
                { label: 'Izin', val: izin, cls: 'text-yellow' },
                { label: 'Alpha', val: alpha, cls: 'text-red' },
                { label: 'Total', val: total, cls: 'text-text-muted' },
              ].map((b) => (
                <div key={b.label} className="flex-1 text-center bg-bg-2 rounded-md py-1">
                  <div className={`text-[13px] font-bold ${b.cls}`}>{b.val}</div>
                  <div className="text-[10px] text-text-muted">{b.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}