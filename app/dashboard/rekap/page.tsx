'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
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

// Grup adik kakak: satu kartu, data tetap per anak
interface GroupStat {
  key: string               // kelompok_adik_kakak id, atau murid.id kalau single
  namaLabel: string         // "Husam & Basam & Wisam" atau "Arsya"
  members: MuridStat[]      // 1 item kalau single, >1 kalau adik kakak
  // aggregat grup (rata-rata kehadiran semua anak)
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
          const izin  = mine.filter((a) => a.status === 'izin').length
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

  // ── Grouping adik kakak (murni tampilan) ─────────────────────────────────
  const groups = useMemo<GroupStat[]>(() => {
    const byGroup: Record<string, MuridStat[]> = {}
    const solo: GroupStat[] = []

    for (const s of stats) {
      const grpKey = s.murid.kelompok_adik_kakak
      if (grpKey) {
        ;(byGroup[grpKey] ??= []).push(s)
      } else {
        solo.push({
          key: s.murid.id,
          namaLabel: s.murid.nama,
          members: [s],
          hadir: s.hadir,
          izin:  s.izin,
          alpha: s.alpha,
          total: s.total,
          pct:   s.pct,
        })
      }
    }

    const grouped: GroupStat[] = Object.entries(byGroup).map(([key, members]) => {
      const namaLabel = members.map((m) => m.murid.nama).join(' & ')
      // Ambil sesi hadir UNIK per sesi (bukan jumlah anak × sesi)
      // karena tiap anak bisa hadir/alpha berbeda → rata-rata pct grup
      const avgHadir = Math.round(members.reduce((s, m) => s + m.hadir, 0) / members.length)
      const avgIzin  = Math.round(members.reduce((s, m) => s + m.izin,  0) / members.length)
      const avgAlpha = Math.round(members.reduce((s, m) => s + m.alpha, 0) / members.length)
      const total    = members[0]?.total ?? 0
      const pct      = Math.round(members.reduce((s, m) => s + m.pct, 0) / members.length)
      return { key, namaLabel, members, hadir: avgHadir, izin: avgIzin, alpha: avgAlpha, total, pct }
    })

    // Gabung & sort by pct desc
    return [...grouped, ...solo].sort((a, b) => b.pct - a.pct)
  }, [stats])

  const pctColor = (p: number) => p >= 80 ? 'text-green' : p >= 60 ? 'text-yellow' : 'text-red'
  const barColor = (p: number) => p >= 80 ? 'bg-green'  : p >= 60 ? 'bg-yellow'  : 'bg-red'

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
      {groups.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Rata kehadiran', val: `${Math.round(groups.reduce((s, x) => s + x.pct, 0) / groups.length)}%`, color: 'text-blue' },
            { label: 'Hadir terbanyak', val: groups[0]?.namaLabel.split(' ')[0], color: 'text-green' },
            { label: 'Total sesi', val: groups[0]?.total, color: 'text-text' },
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

      {/* Stats list */}
      <div className="flex flex-col gap-2">
        {groups.map((g, idx) => {
          const isSingle = g.members.length === 1

          return (
            <div key={g.key} className="bg-bg border border-border rounded-lg px-4 py-3 shadow-sm">
              {/* Header grup */}
              <div className="flex items-center gap-3 mb-2">
                <div className="text-[12px] font-bold text-text-muted w-5 text-center">{idx + 1}</div>
                <Avatar nama={g.namaLabel} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="text-[13px] font-semibold text-text truncate">{g.namaLabel}</div>
                    {!isSingle && (
                      <span className="bg-blue-light text-blue text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {g.members.length} anak
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-muted">{g.members[0].murid.paket}</div>
                </div>
                <div className={`text-[18px] font-bold ${pctColor(g.pct)}`}>{g.pct}%</div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-bg-3 rounded-full overflow-hidden mb-2">
                <div className={`h-full ${barColor(g.pct)} rounded-full transition-all`} style={{ width: `${g.pct}%` }} />
              </div>

              {/* Breakdown agregat grup */}
              <div className="flex gap-2">
                {[
                  { label: 'Hadir', val: g.hadir, cls: 'text-blue' },
                  { label: 'Izin',  val: g.izin,  cls: 'text-yellow' },
                  { label: 'Alpha', val: g.alpha, cls: 'text-red' },
                  { label: 'Total', val: g.total, cls: 'text-text-muted' },
                ].map((b) => (
                  <div key={b.label} className="flex-1 text-center bg-bg-2 rounded-md py-1">
                    <div className={`text-[13px] font-bold ${b.cls}`}>{b.val}</div>
                    <div className="text-[10px] text-text-muted">{b.label}</div>
                  </div>
                ))}
              </div>

              {/* Per-anak breakdown (hanya kalau adik kakak) */}
              {!isSingle && (
                <div className="border-t border-border mt-2.5 pt-2 flex flex-col gap-1.5">
                  {g.members.map(({ murid, hadir, izin, alpha, pct: mp }) => (
                    <div key={murid.id} className="flex items-center gap-2 bg-bg-2 rounded-md px-2.5 py-1.5">
                      <Avatar nama={murid.nama} size="sm" />
                      <div className="text-[12px] font-semibold text-text flex-1 truncate">{murid.nama}</div>
                      <div className="flex gap-2 text-[11px]">
                        <span className="text-blue font-bold">{hadir}H</span>
                        <span className="text-yellow font-bold">{izin}I</span>
                        <span className="text-red font-bold">{alpha}A</span>
                      </div>
                      <div className={`text-[12px] font-bold w-9 text-right ${pctColor(mp)}`}>{mp}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}