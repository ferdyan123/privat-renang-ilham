'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { getRekapPemasukan, getBulanPemasukanList, PemasukanItem } from '@/lib/supabase'
import { fmtBulan, bulanStr, fmtRupiah } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

export default function PemasukanPage() {
  const [bulan, setBulan] = useState(bulanStr())
  const [bulanList, setBulanList] = useState<string[]>([])
  const [items, setItems] = useState<PemasukanItem[]>([])
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()

  const initBulan = useCallback(async () => {
    try {
      const months = await getBulanPemasukanList()
      setBulanList(months)
      if (months[0] && !months.includes(bulan)) setBulan(months[0])
    } catch { showToast('Gagal load daftar bulan', 'error') }
  }, [])

  useEffect(() => { initBulan() }, [])
  useEffect(() => { if (pathname?.includes('pemasukan')) initBulan() }, [pathname])

  useEffect(() => {
    if (!bulan) return
    const load = async () => {
      setLoading(true)
      try { setItems(await getRekapPemasukan(bulan)) }
      catch (e: any) { showToast('Gagal load pemasukan: ' + e?.message, 'error') }
      finally { setLoading(false) }
    }
    load()
  }, [bulan])

  const muridBaru = items.filter((i) => i.kategori === 'baru')
  const muridLama = items.filter((i) => i.kategori === 'lama')

  const sum = (list: PemasukanItem[], key: 'totalAsli' | 'potongan' | 'netto') =>
    list.reduce((s, x) => s + x[key], 0)

  const totalNetto = sum(items, 'netto')
  const totalPotongan = sum(items, 'potongan')
  const totalAsli = sum(items, 'totalAsli')

  const pemilikBadge = (pemilik: string) => {
    if (pemilik === 'Ilham') return 'bg-blue/10 text-blue'
    if (pemilik === 'Ibun') return 'bg-yellow/10 text-yellow'
    return 'bg-purple-100 text-purple-600'
  }

  const Grup = ({ title, list, kategori }: { title: string; list: PemasukanItem[]; kategori: 'baru' | 'lama' }) => (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[13px] font-bold text-text flex items-center gap-1.5">
          <i className={`ti ${kategori === 'baru' ? 'ti-user-plus' : 'ti-user-check'} text-[15px]`} />
          {title}
          <span className="text-[11px] font-normal text-text-muted">({list.length})</span>
        </div>
        <div className="text-[13px] font-bold text-green">{fmtRupiah(sum(list, 'netto'))}</div>
      </div>

      {list.length === 0 && (
        <div className="text-center py-6 text-text-muted text-[12px] bg-bg-2 rounded-lg">
          Tidak ada transaksi bulan ini
        </div>
      )}

      <div className="flex flex-col gap-2">
        {list.map((it) => (
          <div key={it.id} className="bg-bg border border-border rounded-lg px-3.5 py-2.5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-semibold text-text flex-1 truncate">{it.nama}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${pemilikBadge(it.pemilik)}`}>
                {it.pemilik}
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-text-muted">
                {new Date(it.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </span>
              {it.potongan > 0 ? (
                <span className="text-right">
                  <span className="line-through text-text-muted/60 mr-1.5">{fmtRupiah(it.totalAsli)}</span>
                  <strong className="text-text">{fmtRupiah(it.netto)}</strong>
                </span>
              ) : (
                <strong className="text-text">{fmtRupiah(it.netto)}</strong>
              )}
            </div>
            {it.potongan > 0 && (
              <div className="text-[10.5px] text-red mt-0.5">
                {it.pemilik} : {fmtRupiah(it.netto)} (asli {fmtRupiah(it.totalAsli)}, dipotong {fmtRupiah(it.potongan)})
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Bulan picker */}
      <div className="mb-4">
        <select
          value={bulan}
          onChange={(e) => setBulan(e.target.value)}
          className="border border-border rounded-md px-3 py-2 text-sm bg-bg text-text"
        >
          {bulanList.length === 0 && <option value={bulan}>{fmtBulan(bulan)}</option>}
          {bulanList.map((b) => <option key={b} value={b}>{fmtBulan(b)}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: 'Pemasukan Kotor', val: fmtRupiah(totalAsli), color: 'text-text' },
          { label: 'Total Potongan', val: fmtRupiah(totalPotongan), color: 'text-red' },
          { label: 'Pemasukan Bersih', val: fmtRupiah(totalNetto), color: 'text-green' },
        ].map((c) => (
          <div key={c.label} className="bg-bg border border-border rounded-lg p-3 text-center shadow-sm">
            <div className={`text-[13px] font-bold ${c.color}`}>{c.val}</div>
            <div className="text-[10px] text-text-muted mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="text-center py-12 text-text-muted text-sm">
          <i className="ti ti-loader-2 text-3xl block mb-2 animate-spin" />Menghitung...
        </div>
      )}

      {!loading && (
        <>
          <Grup title="Murid Baru" list={muridBaru} kategori="baru" />
          <Grup title="Murid Lama" list={muridLama} kategori="lama" />
        </>
      )}
    </div>
  )
}
