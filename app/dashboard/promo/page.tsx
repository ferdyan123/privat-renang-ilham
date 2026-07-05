'use client'
import { useEffect, useState } from 'react'
import { getAllPromo, createPromo, nonaktifkanPromo, PromoInfo } from '@/lib/supabase'
import { formatRibuan, parseRibuan, fmtRupiah } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

export default function PromoPage() {
  const [promoList, setPromoList] = useState<PromoInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [tipe, setTipe] = useState<'baru' | 'lama'>('baru')
  const [kode, setKode] = useState('')
  const [diskonStr, setDiskonStr] = useState('')
  const [kuota, setKuota] = useState('')

  const load = async () => {
    setLoading(true)
    try { setPromoList(await getAllPromo()) }
    catch (e: any) { showToast('Gagal load promo: ' + e?.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setKode(''); setDiskonStr(''); setKuota(''); setTipe('baru')
  }

  const apply = async () => {
    if (!kode.trim()) return showToast('Kode referral wajib diisi', 'error')
    const diskon = parseRibuan(diskonStr)
    const kuotaNum = parseInt(kuota)
    if (!diskon || diskon <= 0) return showToast('Nominal diskon wajib diisi', 'error')
    if (!kuotaNum || kuotaNum <= 0) return showToast('Kuota wajib diisi', 'error')

    setSaving(true)
    try {
      await createPromo(kode, tipe, diskon, kuotaNum)
      showToast(`Kode ${kode.toUpperCase()} aktif ✓`, 'success')
      resetForm()
      load()
    } catch (e: any) {
      showToast(
        e?.message?.includes('duplicate') ? 'Kode sudah dipakai, coba kode lain' : 'Gagal: ' + e?.message,
        'error'
      )
    } finally { setSaving(false) }
  }

  const matikan = async (p: PromoInfo) => {
    if (!confirm(`Nonaktifkan kode ${p.kode}?`)) return
    try {
      await nonaktifkanPromo(p.id)
      showToast('Kode dinonaktifkan', 'success')
      load()
    } catch (e: any) { showToast('Gagal: ' + e?.message, 'error') }
  }

  const statusPromo = (p: PromoInfo): 'aktif' | 'habis' | 'nonaktif' => {
    if (!p.aktif) return p.terpakai >= p.kuota ? 'habis' : 'nonaktif'
    return 'aktif'
  }

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Info cara kerja */}
      <div className="bg-blue-light border border-blue/20 rounded-lg px-4 py-3 mb-4 text-[12px] text-blue">
        <div className="font-semibold mb-1 flex items-center gap-1.5">
          <i className="ti ti-info-circle text-sm" />Cara kerja Kode Referral
        </div>
        <div className="text-blue/70 leading-relaxed">
          Buat kode referral di bawah lalu klik <strong>Apply</strong> untuk mengaktifkan. Kode otomatis muncul sebagai
          kolom opsional di form pendaftaran (<strong>/daftar</strong>) — orang tua tinggal ketik kodenya sendiri untuk dapat potongan harga.
          Kalau kuota pemakaian sudah habis, kode otomatis nonaktif (expired).
        </div>
      </div>

      {/* Form buat kode baru */}
      <div className="bg-bg border border-border rounded-lg p-4 shadow-sm mb-5">
        <div className="text-[14px] font-semibold text-text mb-3">Buat Kode Referral Baru</div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
              Target
            </label>
            <div className="flex gap-2">
              {(['baru', 'lama'] as const).map((t) => (
                <button key={t} onClick={() => setTipe(t)}
                  className={`flex-1 py-2 rounded-md border text-[13px] font-medium transition-all ${
                    tipe === t ? 'border-blue bg-blue-light text-blue font-semibold' : 'border-border text-text-muted'
                  }`}>
                  {t === 'baru' ? 'Murid Baru' : 'Murid Lama'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
              Kode Referral
            </label>
            <input
              value={kode}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
              placeholder="Contoh: IBU2026"
              className="w-full border border-border rounded-md px-3 py-2 text-[13px] font-mono font-semibold tracking-wide text-text focus:outline-none focus:border-blue"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
                Nominal Diskon (Rp)
              </label>
              <input
                value={diskonStr}
                onChange={(e) => setDiskonStr(formatRibuan(e.target.value))}
                placeholder="50.000"
                inputMode="numeric"
                className="w-full border border-border rounded-md px-3 py-2 text-[13px] text-text focus:outline-none focus:border-blue"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
                Kuota (orang)
              </label>
              <input
                value={kuota}
                onChange={(e) => setKuota(e.target.value.replace(/\D/g, ''))}
                placeholder="10"
                inputMode="numeric"
                className="w-full border border-border rounded-md px-3 py-2 text-[13px] text-text focus:outline-none focus:border-blue"
              />
            </div>
          </div>

          <button onClick={apply} disabled={saving}
            className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-[14px] font-semibold hover:bg-[#0C447C] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <i className="ti ti-loader-2 animate-spin text-base" /> : <i className="ti ti-check text-base" />}
            Apply & Aktifkan
          </button>
        </div>
      </div>

      {/* List kode promo */}
      <div className="text-[13px] font-bold text-text mb-2.5">Kode Referral Terdaftar</div>

      {loading && (
        <div className="text-center py-8 text-text-muted text-sm">
          <i className="ti ti-loader-2 text-2xl block mb-2 animate-spin" />Memuat...
        </div>
      )}

      {!loading && promoList.length === 0 && (
        <div className="text-center py-10 text-text-muted">
          <i className="ti ti-discount-off text-4xl block mb-2 opacity-40" />
          <p className="text-sm font-medium">Belum ada kode referral</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {promoList.map((p) => {
          const st = statusPromo(p)
          return (
            <div key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-sm ${
              st === 'aktif' ? 'bg-bg border-border' : 'bg-red/5 border-red/20'
            }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[13px] text-text tracking-wide">{p.kode}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-2 text-text-muted font-medium">
                    {p.tipe === 'baru' ? 'Murid Baru' : 'Murid Lama'}
                  </span>
                </div>
                <div className="text-[12px] text-text-muted mt-0.5">
                  Potongan {fmtRupiah(p.diskon_nominal)} · Dipakai {p.terpakai}/{p.kuota}
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                st === 'aktif' ? 'bg-green/10 text-green' : st === 'habis' ? 'bg-red/10 text-red' : 'bg-bg-2 text-text-muted'
              }`}>
                {st === 'aktif' ? 'Aktif' : st === 'habis' ? 'Habis' : 'Nonaktif'}
              </span>
              {st === 'aktif' && (
                <button onClick={() => matikan(p)}
                  className="text-[11px] text-red font-medium px-2 py-1 rounded-md hover:bg-red/10 transition-all flex-shrink-0">
                  Matikan
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
