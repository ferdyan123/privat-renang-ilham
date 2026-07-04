'use client'
import { useEffect, useState } from 'react'
import { getSlotDariJadwal, upsertSlotStatus, SlotInfo } from '@/lib/supabase'
import { showToast } from '@/components/ui/Toast'

export default function SlotPage() {
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [generatedLink, setGeneratedLink] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try { setSlots(await getSlotDariJadwal()) }
    catch (e: any) { showToast('Gagal load slot: ' + e?.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const toggleStatus = async (slot: SlotInfo) => {
    const key = `${slot.hari}__${slot.jam_mulai}__${slot.kolam}`
    setToggling(key)
    const next = slot.status === 'tersedia' ? 'penuh' : 'tersedia'
    try {
      await upsertSlotStatus(slot.hari, slot.jam_mulai, slot.kolam, next)
      setSlots(prev => prev.map(s =>
        s.hari === slot.hari && s.jam_mulai === slot.jam_mulai && s.kolam === slot.kolam
          ? { ...s, status: next } : s
      ))
      showToast(
        next === 'penuh'
          ? `${slot.kolam} ${slot.hari} ${slot.jam_mulai} → Penuh`
          : `${slot.kolam} ${slot.hari} ${slot.jam_mulai} → Tersedia`,
        'success'
      )
    } catch (e: any) { showToast('Gagal update: ' + e?.message, 'error') }
    finally { setToggling(null) }
  }

  const generateLink = () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const link = `${appUrl}/daftar`
    setGeneratedLink(link)
    showToast('Link berhasil dibuat ✓', 'success')
  }

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink)
      .then(() => showToast('Link disalin ✓', 'success'))
  }

  // Group by kolam
  const grouped = slots.reduce<Record<string, SlotInfo[]>>((acc, s) => {
    acc[s.kolam] = acc[s.kolam] ? [...acc[s.kolam], s] : [s]
    return acc
  }, {})

  const tersediaCount = slots.filter(s => s.status === 'tersedia').length
  const penuhCount = slots.filter(s => s.status === 'penuh').length

  return (
    <div className="max-w-[720px] mx-auto">

      {/* Info cara kerja */}
      <div className="bg-blue-light border border-blue/20 rounded-lg px-4 py-3 mb-4 text-[12px] text-blue">
        <div className="font-semibold mb-1 flex items-center gap-1.5">
          <i className="ti ti-info-circle text-sm" />Cara kerja Tab Slot
        </div>
        <div className="text-blue/70 leading-relaxed">
          Slot jadwal diambil otomatis dari data sesi di tab <strong>Jadwal</strong> — deduplikasi berdasarkan hari + jam + kolam yang sama.
          Klik tombol untuk toggle <strong>Tersedia ↔ Penuh</strong>. Jadwal penuh tetap muncul di form pendaftaran tapi tidak bisa dipilih orang tua.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-bg border border-border rounded-md px-3 py-2 text-center">
          <div className="text-[18px] font-bold text-text">{slots.length}</div>
          <div className="text-[11px] text-text-muted">Total slot</div>
        </div>
        <div className="bg-green/10 border border-green/20 rounded-md px-3 py-2 text-center">
          <div className="text-[18px] font-bold text-green">{tersediaCount}</div>
          <div className="text-[11px] text-text-muted">Tersedia</div>
        </div>
        <div className="bg-red/10 border border-red/20 rounded-md px-3 py-2 text-center">
          <div className="text-[18px] font-bold text-red">{penuhCount}</div>
          <div className="text-[11px] text-text-muted">Penuh</div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-text-muted text-sm">
          <i className="ti ti-loader-2 text-3xl block mb-2 animate-spin" />Memuat dari data jadwal...
        </div>
      )}

      {!loading && slots.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <i className="ti ti-calendar-off text-4xl block mb-2 opacity-40" />
          <p className="text-sm font-medium">Belum ada slot jadwal</p>
          <p className="text-[12px] mt-1">Tambahkan sesi di tab <strong>Jadwal</strong> dulu, nanti akan muncul otomatis di sini.</p>
        </div>
      )}

      {/* Slot per kolam */}
      {Object.entries(grouped).map(([kolam, kolamSlots]) => (
        <div key={kolam} className="mb-5">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-2 h-2 rounded-full bg-blue flex-shrink-0" />
            <div className="text-[13px] font-bold text-text">{kolam}</div>
            <div className="text-[11px] text-text-muted ml-1">
              {kolamSlots.filter(s=>s.status==='tersedia').length} tersedia ·{' '}
              {kolamSlots.filter(s=>s.status==='penuh').length} penuh
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {kolamSlots.map((slot) => {
              const key = `${slot.hari}__${slot.jam_mulai}__${slot.kolam}`
              const isToggling = toggling === key
              return (
                <div key={key} className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all shadow-sm ${
                  slot.status === 'penuh' ? 'bg-red/5 border-red/20' : 'bg-bg border-border'
                }`}>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-text">{slot.hari}</div>
                    <div className="text-[12px] text-text-muted">{slot.jam_mulai} – {slot.jam_selesai}</div>
                  </div>
                  <button
                    onClick={() => toggleStatus(slot)}
                    disabled={isToggling}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all disabled:opacity-50 ${
                      slot.status === 'tersedia'
                        ? 'bg-green/10 border-green/30 text-green hover:bg-green hover:text-white'
                        : 'bg-red/10 border-red/30 text-red hover:bg-red hover:text-white'
                    }`}
                  >
                    {isToggling ? (
                      <i className="ti ti-loader-2 animate-spin text-sm" />
                    ) : (
                      <i className={`ti ${slot.status === 'tersedia' ? 'ti-circle-check' : 'ti-circle-x'} text-sm`} />
                    )}
                    {slot.status === 'tersedia' ? 'Tersedia' : 'Penuh'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Refresh button */}
      {!loading && slots.length > 0 && (
        <button onClick={load}
          className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text mb-6 mx-auto">
          <i className="ti ti-refresh text-sm" />Refresh dari data jadwal
        </button>
      )}

      {/* Generate link */}
      <div className="bg-bg border border-border rounded-lg p-4 shadow-sm">
        <div className="text-[14px] font-semibold text-text mb-1">Generate Link Pendaftaran</div>
        <div className="text-[12px] text-text-muted mb-4">
          Link menampilkan semua slot di atas. Yang <strong className="text-red">Penuh</strong> tidak bisa dipilih.
        </div>

        {/* Mini preview */}
        <div className="bg-bg-2 rounded-md p-3 mb-4">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-2">Preview di form pendaftaran</div>
          <div className="flex flex-col gap-1">
            {slots.map(s => (
              <div key={`${s.hari}${s.jam_mulai}${s.kolam}`}
                className={`flex items-center gap-2 text-[12px] py-0.5 ${s.status === 'penuh' ? 'opacity-40' : ''}`}>
                <i className={`ti ${s.status === 'tersedia' ? 'ti-circle-check text-green' : 'ti-circle-x text-red'} text-sm flex-shrink-0`} />
                <span className="text-text">{s.kolam} · {s.hari} {s.jam_mulai}–{s.jam_selesai}</span>
                {s.status === 'penuh' && <span className="text-[10px] text-red font-semibold ml-auto">Penuh</span>}
              </div>
            ))}
            {slots.length === 0 && <div className="text-[12px] text-text-muted">Belum ada slot</div>}
          </div>
        </div>

        <button onClick={generateLink}
          className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-[14px] font-semibold hover:bg-[#0C447C] transition-all flex items-center justify-center gap-2 mb-3">
          <i className="ti ti-link text-base" />Generate Link Pendaftaran
        </button>

        {generatedLink && (
          <div className="flex flex-col gap-2">
            <div className="bg-bg-2 border border-border rounded-md px-3 py-2 text-[12px] text-blue break-all font-medium">
              {generatedLink}
            </div>
            <div className="flex gap-2">
              <button onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-1.5 border border-border text-text text-[13px] font-medium py-2 rounded-md hover:bg-bg-2 transition-all">
                <i className="ti ti-copy text-base" />Salin Link
              </button>
              <button onClick={() => {
                const msg = `Halo! Berikut link pendaftaran les renang Privat Renang Ilham:\n\n${generatedLink}\n\nSilakan pilih jadwal yang tersedia 🏊`
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
              }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] text-white text-[13px] font-semibold py-2 rounded-md hover:bg-[#1ab254] transition-all">
                <i className="ti ti-brand-whatsapp text-base" />Share WA
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}