'use client'
import { useEffect, useState } from 'react'
import { getJadwalSlot, updateJadwalSlotStatus, addJadwalSlot, deleteJadwalSlot, JadwalSlot } from '@/lib/supabase'
import { showToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'

const KOLAM_LIST = ['Kolam Asa', 'Kolam BBS', 'Kolam KCC']
const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const JAM_LIST = ['07:00','08:00','09:00','10:00','10:30','11:00','13:30','15:00','16:00','17:00']

export default function SlotPage() {
  const [slots, setSlots] = useState<JadwalSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [form, setForm] = useState({
    kolam: KOLAM_LIST[0], hari: '', jam_mulai: '', jam_selesai: '', urutan: 99
  })

  const load = async () => {
    setLoading(true)
    try { setSlots(await getJadwalSlot()) }
    catch (e: any) { showToast('Gagal load slot: ' + e?.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const toggleStatus = async (slot: JadwalSlot) => {
    const next = slot.status === 'tersedia' ? 'penuh' : 'tersedia'
    try {
      await updateJadwalSlotStatus(slot.id, next)
      setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, status: next } : s))
      showToast(next === 'penuh' ? `${slot.hari} ${slot.jam_mulai} → Penuh` : `${slot.hari} ${slot.jam_mulai} → Tersedia`, 'success')
    } catch (e: any) { showToast('Gagal update: ' + e?.message, 'error') }
  }

  const handleAdd = async () => {
    if (!form.hari || !form.jam_mulai || !form.jam_selesai) { showToast('Lengkapi semua field'); return }
    setSaving(true)
    try {
      await addJadwalSlot({ ...form, status: 'tersedia' })
      showToast('Slot ditambahkan ✓', 'success')
      setShowAdd(false)
      setForm({ kolam: KOLAM_LIST[0], hari: '', jam_mulai: '', jam_selesai: '', urutan: 99 })
      load()
    } catch (e: any) { showToast('Gagal: ' + e?.message, 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (slot: JadwalSlot) => {
    if (!confirm(`Hapus slot ${slot.hari} ${slot.jam_mulai}?`)) return
    try {
      await deleteJadwalSlot(slot.id)
      showToast('Slot dihapus')
      load()
    } catch (e: any) { showToast('Gagal hapus: ' + e?.message, 'error') }
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
  const grouped = slots.reduce<Record<string, JadwalSlot[]>>((acc, s) => {
    acc[s.kolam] = acc[s.kolam] ? [...acc[s.kolam], s] : [s]
    return acc
  }, {})

  const tersediaCount = slots.filter(s => s.status === 'tersedia').length
  const penuhCount = slots.filter(s => s.status === 'penuh').length

  return (
    <div className="max-w-[720px] mx-auto">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-blue-light border border-blue/20 rounded-md px-3 py-2 text-center">
          <div className="text-[18px] font-bold text-blue">{slots.length}</div>
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

      {/* Info */}
      <div className="bg-yellow/10 border border-yellow/20 rounded-lg px-4 py-3 mb-4 text-[12px] text-text-muted">
        <i className="ti ti-info-circle text-yellow mr-1.5" />
        Klik tombol status untuk toggle <strong>Tersedia ↔ Penuh</strong>. Jadwal yang penuh akan tetap tampil di form pendaftaran tapi tidak bisa dipilih orang tua.
      </div>

      {/* Jadwal per kolam */}
      {loading ? (
        <div className="text-center py-12 text-text-muted text-sm">
          <i className="ti ti-loader-2 text-3xl block mb-2 animate-spin" />Memuat...
        </div>
      ) : (
        Object.entries(grouped).map(([kolam, kolamSlots]) => (
          <div key={kolam} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue flex-shrink-0" />
              <div className="text-[13px] font-bold text-text">{kolam}</div>
              <div className="text-[11px] text-text-muted">
                ({kolamSlots.filter(s=>s.status==='tersedia').length} tersedia · {kolamSlots.filter(s=>s.status==='penuh').length} penuh)
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {kolamSlots.map((slot) => (
                <div key={slot.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all shadow-sm ${
                  slot.status === 'penuh'
                    ? 'bg-red/5 border-red/20'
                    : 'bg-bg border-border'
                }`}>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-text">{slot.hari}</div>
                    <div className="text-[12px] text-text-muted">{slot.jam_mulai} – {slot.jam_selesai}</div>
                  </div>
                  {/* Toggle status */}
                  <button
                    onClick={() => toggleStatus(slot)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                      slot.status === 'tersedia'
                        ? 'bg-green/10 border-green/30 text-green hover:bg-green hover:text-white'
                        : 'bg-red/10 border-red/30 text-red hover:bg-red hover:text-white'
                    }`}
                  >
                    <i className={`ti ${slot.status === 'tersedia' ? 'ti-circle-check' : 'ti-circle-x'} text-sm`} />
                    {slot.status === 'tersedia' ? 'Tersedia' : 'Penuh'}
                  </button>
                  <button onClick={() => handleDelete(slot)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red/10 text-text-muted hover:text-red transition-all">
                    <i className="ti ti-trash text-sm" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Tombol tambah slot */}
      <button onClick={() => setShowAdd(true)}
        className="w-full border-2 border-dashed border-border text-text-muted text-[13px] py-3 rounded-lg hover:border-blue hover:text-blue transition-all mb-6 flex items-center justify-center gap-2">
        <i className="ti ti-plus text-base" />Tambah Slot Jadwal
      </button>

      {/* Generate link section */}
      <div className="bg-bg border border-border rounded-lg p-4 shadow-sm">
        <div className="text-[14px] font-semibold text-text mb-1">Generate Link Pendaftaran</div>
        <div className="text-[12px] text-text-muted mb-4">
          Link ini akan menampilkan semua jadwal di atas. Jadwal yang berstatus <strong className="text-red">Penuh</strong> tidak bisa dipilih orang tua.
        </div>

        {/* Preview jadwal di link */}
        <div className="bg-bg-2 rounded-md p-3 mb-4 text-[12px]">
          <div className="font-semibold text-text-muted mb-2 uppercase tracking-wide text-[10px]">Preview yang akan muncul di form</div>
          <div className="flex flex-col gap-1">
            {slots.map(s => (
              <div key={s.id} className={`flex items-center gap-2 py-1 ${s.status === 'penuh' ? 'opacity-40' : ''}`}>
                <i className={`ti ${s.status === 'tersedia' ? 'ti-circle-check text-green' : 'ti-circle-x text-red'} text-sm`} />
                <span className="text-text">{s.kolam} · {s.hari} {s.jam_mulai}–{s.jam_selesai}</span>
                {s.status === 'penuh' && <span className="text-red text-[10px] font-semibold">(Penuh)</span>}
              </div>
            ))}
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
                const msg = `Halo! Berikut link pendaftaran les renang SwimTrack:\n\n${generatedLink}\n\nSilakan pilih jadwal yang tersedia 🏊`
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
              }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] text-white text-[13px] font-semibold py-2 rounded-md hover:bg-[#1ab254] transition-all">
                <i className="ti ti-brand-whatsapp text-base" />Share WA
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal tambah slot */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah Slot Jadwal">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] text-text-muted block mb-1.5">Kolam</label>
            <div className="flex gap-2 flex-wrap">
              {KOLAM_LIST.map(k => (
                <button key={k} onClick={() => setForm({...form, kolam: k})}
                  className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${form.kolam === k ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] text-text-muted block mb-1.5">Hari</label>
            <div className="grid grid-cols-4 gap-1.5">
              {HARI_LIST.map(h => (
                <button key={h} onClick={() => setForm({...form, hari: h})}
                  className={`py-1.5 rounded-md border text-[12px] font-medium transition-all ${form.hari === h ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                  {h.slice(0,3)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-text-muted block mb-1.5">Jam mulai</label>
              <select value={form.jam_mulai} onChange={e => setForm({...form, jam_mulai: e.target.value})}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text">
                <option value="">Pilih jam</option>
                {JAM_LIST.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] text-text-muted block mb-1.5">Jam selesai</label>
              <select value={form.jam_selesai} onChange={e => setForm({...form, jam_selesai: e.target.value})}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text">
                <option value="">Pilih jam</option>
                {JAM_LIST.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving}
            className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-sm font-semibold hover:bg-[#0C447C] disabled:opacity-50 transition-all">
            {saving ? 'Menyimpan...' : 'Tambah Slot'}
          </button>
        </div>
      </Modal>
    </div>
  )
}