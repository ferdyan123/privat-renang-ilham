'use client'
import { useEffect, useRef, useState } from 'react'
import { getMurid, getSesi, getAbsensi } from '@/lib/supabase'
import { fmtBulan, fmtShort, COLORS } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

export default function GrafikPage() {
  const trendRef = useRef<HTMLCanvasElement>(null)
  const muridRef = useRef<HTMLCanvasElement>(null)
  const trendInstance = useRef<any>(null)
  const muridInstance = useRef<any>(null)
  const [bulan, setBulan] = useState('')
  const [bulanList, setBulanList] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Chart.js harus diload setelah mount, simpan ke ref bukan state
    import('chart.js/auto').then(() => setReady(true))
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const sesiAll = await getSesi(200)
        const months = Array.from(new Set(sesiAll.map((s) => s.tanggal.slice(0, 7)))).sort().reverse()
        setBulanList(months)
        if (months[0]) setBulan(months[0])
      } catch (e: any) { showToast('Gagal load: ' + e?.message, 'error') }
    }
    init()
  }, [])

  useEffect(() => {
    if (!bulan || !ready) return
    const load = async () => {
      setLoading(true)
      try {
        const { Chart } = await import('chart.js/auto')
        const [muridAll, sesiAll] = await Promise.all([getMurid(), getSesi(200)])
        const sesiBulan = sesiAll
          .filter((s) => s.tanggal.startsWith(bulan))
          .sort((a, b) => a.tanggal.localeCompare(b.tanggal))

        if (!sesiBulan.length) { setLoading(false); return }

        const allAbs = await Promise.all(sesiBulan.map((s) => getAbsensi(s.id)))

        // Tren per sesi
        const labels = sesiBulan.map((s) => fmtShort(s.tanggal) + ' ' + s.jam + ':' + s.menit)
        const hadirPcts = sesiBulan.map((s, i) => {
          const h = allAbs[i].filter((a) => a.status === 'hadir').length
          return muridAll.length ? Math.round(h / muridAll.length * 100) : 0
        })

        trendInstance.current?.destroy()
        if (trendRef.current) {
          trendInstance.current = new Chart(trendRef.current, {
            type: 'line',
            data: {
              labels,
              datasets: [{
                label: '% Kehadiran',
                data: hadirPcts,
                borderColor: '#185FA5',
                backgroundColor: 'rgba(24,95,165,0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#185FA5',
              }],
            },
            options: {
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                y: { min: 0, max: 100, ticks: { callback: (v: any) => v + '%', font: { size: 11 } } },
                x: { ticks: { font: { size: 10 }, maxRotation: 30 } },
              },
            },
          })
        }

        // Per murid
        const absFlat = allAbs.flat()
        const muridLabels = muridAll.map((m) => m.nama.split(' ')[0])
        const muridHadir = muridAll.map((m) =>
          absFlat.filter((a) => a.murid_id === m.id && a.status === 'hadir').length
        )

        muridInstance.current?.destroy()
        if (muridRef.current) {
          muridInstance.current = new Chart(muridRef.current, {
            type: 'bar',
            data: {
              labels: muridLabels,
              datasets: [{
                label: 'Hadir',
                data: muridHadir,
                backgroundColor: COLORS.slice(0, muridAll.length),
                borderRadius: 6,
              }],
            },
            options: {
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, ticks: { font: { size: 11 } } },
                x: { ticks: { font: { size: 11 } } },
              },
            },
          })
        }
      } catch (e: any) {
        showToast('Gagal load grafik: ' + e?.message, 'error')
        console.error(e)
      }
      finally { setLoading(false) }
    }
    load()
  }, [bulan, ready])

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="mb-4">
        <select value={bulan} onChange={(e) => setBulan(e.target.value)}
          className="border border-border rounded-md px-3 py-2 text-sm bg-bg text-text">
          {bulanList.map((b) => <option key={b} value={b}>{fmtBulan(b)}</option>)}
        </select>
      </div>

      {loading && (
        <div className="text-center py-12 text-text-muted text-sm">
          <i className="ti ti-loader-2 text-3xl block mb-2 animate-spin" />Memuat grafik...
        </div>
      )}

      {!loading && bulanList.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <i className="ti ti-chart-line text-4xl block mb-2 opacity-30" />
          <p className="text-sm">Belum ada data sesi.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="bg-bg border border-border rounded-lg p-4 shadow-sm">
          <div className="text-[13px] font-semibold text-text mb-3">Tren Kehadiran per Sesi</div>
          <canvas ref={trendRef} />
        </div>
        <div className="bg-bg border border-border rounded-lg p-4 shadow-sm">
          <div className="text-[13px] font-semibold text-text mb-3">Kehadiran per Murid</div>
          <canvas ref={muridRef} />
        </div>
      </div>
    </div>
  )
}