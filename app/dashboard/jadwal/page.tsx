'use client'
import { useEffect, useState } from 'react'
import { getSesi, addSesiBatch, updateSesi, deleteSesi, Sesi } from '@/lib/supabase'
import { fmtTgl, fmtShort, jamSelesai, KOLAM_PRESETS } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'

export default function JadwalPage() {
  const [sesiList, setSesiList] = useState<Sesi[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [tgl, setTgl] = useState('')
  const [jam, setJam] = useState('07')
  const [menit, setMenit] = useState('00')
  const [durasi, setDurasi] = useState(60)
  const [kolam, setKolam] = useState('Kolam A')
  const [repeat, setRepeat] = useState(false)
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [repeatWeeks, setRepeatWeeks] = useState(4)

  const JAMS = ['05','06','07','08','09','10','11','12','13','14','15','16','17']
  const MENIT = ['00','15','30','45']
  const HARI = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']
  const [kolamCustom, setKolamCustom] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setSesiList(await getSesi(200)) }
    catch (e: any) { showToast('Gagal load: ' + (e?.message || ''), 'error'); console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // Group by date
  const grouped = sesiList.reduce<Record<string, Sesi[]>>((acc, s) => {
    acc[s.tanggal] = acc[s.tanggal] ? [...acc[s.tanggal], s] : [s]
    return acc
  }, {})
  const sortedDates = Object.keys(grouped).sort().reverse()

  const openEdit = (s: Sesi) => {
    setEditingId(s.id)
    setTgl(s.tanggal)
    setJam(s.jam)
    setMenit(s.menit)
    setDurasi(s.durasi)
    setKolam(s.kolam)
    setRepeat(false)
    setShowAdd(true)
  }

  const resetForm = () => {
    setTgl(''); setJam('07'); setMenit('00'); setDurasi(60); setKolam('Kolam A')
    setRepeat(false); setRepeatDays([]); setRepeatWeeks(4)
    setEditingId(null)
  }

  const handleAdd = async () => {
    if (!tgl) { showToast('Pilih tanggal'); return }
    setSaving(true)
    try {
      if (editingId) {
        await updateSesi(editingId, { tanggal: tgl, jam, menit, durasi, kolam })
        showToast('Sesi diperbarui ✓', 'success')
        setShowAdd(false)
        resetForm()
        load()
        setSaving(false)
        return
      }
      if (!repeat) {
        await addSesiBatch([{ tanggal: tgl, jam, menit, durasi, kolam }])
      } else {
        const start = new Date(tgl + 'T00:00:00')
        const payloads: Omit<Sesi,'id'>[] = []
        for (let w = 0; w < repeatWeeks; w++) {
          repeatDays.forEach((d) => {
            const dt = new Date(start)
            dt.setDate(start.getDate() + ((d - start.getDay() + 7) % 7) + w * 7)
            payloads.push({ tanggal: dt.toISOString().split('T')[0], jam, menit, durasi, kolam })
          })
        }
        if (!payloads.length) { showToast('Pilih minimal 1 hari'); setSaving(false); return }
        await addSesiBatch(payloads)
      }
      showToast('Sesi berhasil ditambahkan ✓', 'success')
      setShowAdd(false)
      load()
    } catch (e: any) { showToast('Gagal tambah sesi: ' + (e?.message || ''), 'error'); console.error('addSesiBatch error:', e) }
    finally { setSaving(false) }
  }

  const handleDelete = async (s: Sesi) => {
    if (!confirm('Hapus sesi ini?')) return
    try {
      await deleteSesi(s.id)
      showToast('Sesi dihapus')
      load()
    } catch (e: any) { showToast('Gagal hapus: ' + (e?.message || ''), 'error'); console.error(e) }
  }

  const toggleDay = (d: number) =>
    setRepeatDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { resetForm(); setShowAdd(true) }}
          className="flex items-center gap-1.5 bg-[#185FA5] text-white px-3 py-2 rounded-md text-sm font-medium"
        >
          <i className="ti ti-plus text-base" />Tambah Sesi
        </button>
      </div>

      {loading && (
        <div className="text-center py-12 text-text-muted text-sm">
          <i className="ti ti-loader-2 text-3xl block mb-2 animate-spin" />Memuat...
        </div>
      )}

      {sortedDates.map((tglKey) => (
        <div key={tglKey} className="mb-4">
          <div className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-2 px-1">
            {fmtTgl(tglKey)}
          </div>
          <div className="flex flex-col gap-2">
            {grouped[tglKey].map((s) => (
              <div key={s.id} className="bg-bg border border-border rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 bg-blue-light rounded-md flex items-center justify-center flex-shrink-0">
                  <i className="ti ti-clock text-blue text-lg" />
                </div>
                <div className="flex-1">
                  <div className="text-[14px] font-semibold text-text">
                    {s.jam}:{s.menit} – {jamSelesai(s.jam, s.menit, s.durasi)}
                  </div>
                  <div className="text-[12px] text-text-muted">{s.kolam} · {s.durasi} menit</div>
                </div>
                <button onClick={() => openEdit(s)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue/10 text-text-muted hover:text-blue transition-all">
                  <i className="ti ti-edit text-base" />
                </button>
                <button onClick={() => handleDelete(s)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red/10 text-text-muted hover:text-red transition-all">
                  <i className="ti ti-trash text-base" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!loading && !sortedDates.length && (
        <div className="text-center py-12 text-text-muted">
          <i className="ti ti-calendar-off text-4xl block mb-2 opacity-40" />
          <p className="text-sm">Belum ada jadwal sesi</p>
        </div>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm() }} title={editingId ? "Edit Sesi" : "Tambah Sesi Baru"}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] text-text-muted block mb-1">Tanggal</label>
            <input type="date" value={tgl} onChange={(e) => setTgl(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
          </div>
          <div>
            <label className="text-[12px] text-text-muted block mb-1">Jam mulai</label>
            <div className="flex gap-2">
              <select className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-bg text-text"
                value={jam} onChange={(e) => setJam(e.target.value)}>
                {JAMS.map((j) => <option key={j} value={j}>{j}:xx</option>)}
              </select>
              <select className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-bg text-text"
                value={menit} onChange={(e) => setMenit(e.target.value)}>
                {MENIT.map((m) => <option key={m} value={m}>:{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[12px] text-text-muted block mb-1">Durasi</label>
            <div className="flex gap-2">
              {[30,45,60,90].map((d) => (
                <button key={d} onClick={() => setDurasi(d)}
                  className={`flex-1 py-2 rounded-md border text-[13px] font-medium transition-all ${durasi === d ? 'bg-blue-light border-blue text-blue' : 'border-border text-text-muted'}`}>
                  {d}m
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] text-text-muted block mb-1">Kolam</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {KOLAM_PRESETS.map((k) => (
                <button key={k} onClick={() => { setKolam(k); setKolamCustom(false) }}
                  className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${kolam === k && !kolamCustom ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                  {k}
                </button>
              ))}
              <button onClick={() => setKolamCustom(true)}
                className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${kolamCustom ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                + Custom
              </button>
            </div>
            {kolamCustom && (
              <input type="text" placeholder="Nama kolam custom"
                value={kolam}
                onChange={(e) => setKolam(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
            )}
          </div>

          {/* Repeat toggle — hanya untuk sesi baru */}
          {!editingId && (
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setRepeat(!repeat)}
              className={`w-10 h-5 rounded-full transition-all relative ${repeat ? 'bg-blue' : 'bg-border'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${repeat ? 'left-5' : 'left-0.5'}`} />
            </div>
            <span className="text-[13px] text-text">Ulangi mingguan</span>
          </label>

          )}

          {repeat && !editingId && (
            <>
              <div>
                <label className="text-[12px] text-text-muted block mb-1">Hari</label>
                <div className="flex gap-1.5 flex-wrap">
                  {HARI.map((h, i) => (
                    <button key={h} onClick={() => toggleDay(i)}
                      className={`w-9 h-9 rounded-full border text-[12px] font-medium transition-all ${repeatDays.includes(i) ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[12px] text-text-muted block mb-1">Selama (minggu)</label>
                <div className="flex gap-2">
                  {[4,8,12].map((w) => (
                    <button key={w} onClick={() => setRepeatWeeks(w)}
                      className={`flex-1 py-2 rounded-md border text-[13px] font-medium transition-all ${repeatWeeks === w ? 'bg-blue-light border-blue text-blue' : 'border-border text-text-muted'}`}>
                      {w}x
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <button onClick={handleAdd} disabled={saving}
            className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-sm font-semibold mt-1 hover:bg-[#0C447C] disabled:opacity-50 transition-all">
            {saving ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Tambah Sesi')}
          </button>
        </div>
      </Modal>
    </div>
  )
}