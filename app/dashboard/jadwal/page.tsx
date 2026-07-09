'use client'
import { useEffect, useState } from 'react'
import {
  getSesi, getMurid, addSesiBatch, updateSesi, deleteSesi,
  getAllMuridJadwal, getAllJadwalPengganti,
  getJadwalTemplate, addJadwalTemplate, updateJadwalTemplate, deleteJadwalTemplate,
  Sesi, Murid, MuridJadwal, JadwalPengganti, JadwalTemplate,
} from '@/lib/supabase'
import { fmtTgl, jamSelesai, todayStr, KOLAM_PRESETS } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'

const HARI_ORDER = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu']
const JAMS = ['05','06','07','08','09','10','11','12','13','14','15','16','17']
const MENIT_LIST = ['00','15','30','45']
const HARI_BTN = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']

export default function JadwalPage() {
  const [tab, setTab] = useState<'tetap' | 'khusus'>('tetap')

  // ── Jadwal Tetap ─────────────────────────────────────────────
  const [templates, setTemplates] = useState<JadwalTemplate[]>([])
  const [loadingT, setLoadingT] = useState(true)
  const [showTambahT, setShowTambahT] = useState(false)
  const [editingT, setEditingT] = useState<JadwalTemplate | null>(null)
  const [savingT, setSavingT] = useState(false)
  const [formT, setFormT] = useState({
    hari: 'Senin', jam_mulai_h: '07', jam_mulai_m: '00', durasi: 60, kolam: KOLAM_PRESETS[0],
  })
  const [kolamCustomT, setKolamCustomT] = useState(false)

  // ── Sesi Khusus ──────────────────────────────────────────────
  const [sesiList, setSesiList] = useState<Sesi[]>([])
  const [muridList, setMuridList] = useState<Murid[]>([])
  const [muridJadwalList, setMuridJadwalList] = useState<(MuridJadwal & { murid_nama: string; murid_aktif: boolean })[]>([])
  const [penggantiList, setPenggantiList] = useState<JadwalPengganti[]>([])
  const [loadingS, setLoadingS] = useState(true)
  const [showTambahS, setShowTambahS] = useState(false)
  const [editingS, setEditingS] = useState<string | null>(null)
  const [savingS, setSavingS] = useState(false)
  const [tgl, setTgl] = useState('')
  const [jam, setJam] = useState('07')
  const [menit, setMenit] = useState('00')
  const [durasi, setDurasi] = useState(60)
  const [kolam, setKolam] = useState(KOLAM_PRESETS[0])
  const [kolamCustomS, setKolamCustomS] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [repeatWeeks, setRepeatWeeks] = useState(4)

  // ── Load ──────────────────────────────────────────────────────
  const loadTemplates = async () => {
    setLoadingT(true)
    try { setTemplates(await getJadwalTemplate()) }
    catch (e: any) { showToast('Gagal load jadwal tetap: ' + e?.message, 'error') }
    finally { setLoadingT(false) }
  }

  const loadSesi = async () => {
    setLoadingS(true)
    try {
      const [sesi, murid, mj, pg] = await Promise.all([
        getSesi(200), getMurid(), getAllMuridJadwal(), getAllJadwalPengganti(),
      ])
      setSesiList(sesi); setMuridList(murid); setMuridJadwalList(mj); setPenggantiList(pg)
    }
    catch (e: any) { showToast('Gagal load sesi: ' + e?.message, 'error') }
    finally { setLoadingS(false) }
  }

  useEffect(() => { loadTemplates(); loadSesi() }, [])

  // ── Helpers Jadwal Tetap ──────────────────────────────────────
  const hitungJamSelesai = (h: string, m: string, d: number) => {
    const total = parseInt(h) * 60 + parseInt(m) + d
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  const resetFormT = () => {
    setFormT({ hari: 'Senin', jam_mulai_h: '07', jam_mulai_m: '00', durasi: 60, kolam: KOLAM_PRESETS[0] })
    setKolamCustomT(false); setEditingT(null)
  }

  const openEditT = (t: JadwalTemplate) => {
    const [h, m] = t.jam_mulai.split(':')
    setFormT({ hari: t.hari, jam_mulai_h: h, jam_mulai_m: m, durasi: t.durasi, kolam: t.kolam })
    setKolamCustomT(!KOLAM_PRESETS.includes(t.kolam))
    setEditingT(t); setShowTambahT(true)
  }

  const handleSaveT = async () => {
    if (!formT.kolam.trim()) { showToast('Pilih kolam'); return }
    setSavingT(true)
    try {
      const jam_mulai = `${formT.jam_mulai_h}:${formT.jam_mulai_m}`
      const jam_selesai = hitungJamSelesai(formT.jam_mulai_h, formT.jam_mulai_m, formT.durasi)
      const payload = { hari: formT.hari, jam_mulai, jam_selesai, durasi: formT.durasi, kolam: formT.kolam }
      if (editingT) {
        await updateJadwalTemplate(editingT.id, payload)
        showToast('Jadwal tetap diperbarui ✓', 'success')
      } else {
        await addJadwalTemplate(payload)
        showToast('Jadwal tetap ditambahkan ✓', 'success')
      }
      setShowTambahT(false); resetFormT(); loadTemplates()
    } catch (e: any) { showToast('Gagal: ' + e?.message, 'error') }
    finally { setSavingT(false) }
  }

  const handleDeleteT = async (t: JadwalTemplate) => {
    if (!confirm(`Hapus jadwal ${t.hari} ${t.jam_mulai} ${t.kolam}?`)) return
    try { await deleteJadwalTemplate(t.id); showToast('Jadwal dihapus'); loadTemplates() }
    catch (e: any) { showToast('Gagal hapus: ' + e?.message, 'error') }
  }

  const templatesByKolam = templates.reduce<Record<string, JadwalTemplate[]>>((acc, t) => {
    acc[t.kolam] = acc[t.kolam] ? [...acc[t.kolam], t] : [t]; return acc
  }, {})

  // ── Helpers Sesi Khusus ───────────────────────────────────────
  const resetFormS = () => {
    setTgl(''); setJam('07'); setMenit('00'); setDurasi(60); setKolam(KOLAM_PRESETS[0])
    setRepeat(false); setRepeatDays([]); setRepeatWeeks(4); setEditingS(null); setKolamCustomS(false)
  }

  const openEditS = (s: Sesi) => {
    setEditingS(s.id); setTgl(s.tanggal); setJam(s.jam); setMenit(s.menit)
    setDurasi(s.durasi); setKolam(s.kolam); setRepeat(false)
    setKolamCustomS(!KOLAM_PRESETS.includes(s.kolam)); setShowTambahS(true)
  }

  const handleSaveS = async () => {
    if (!repeat && !tgl) { showToast('Pilih tanggal'); return }
    if (repeat && repeatDays.length === 0) { showToast('Pilih minimal 1 hari'); return }
    setSavingS(true)
    try {
      if (editingS) {
        await updateSesi(editingS, { tanggal: tgl, jam, menit, durasi, kolam })
        showToast('Sesi diperbarui ✓', 'success')
        setShowTambahS(false); resetFormS(); loadSesi(); return
      }
      if (!repeat) {
        await addSesiBatch([{ tanggal: tgl, jam, menit, durasi, kolam }])
      } else {
        const start = new Date((tgl || todayStr()) + 'T00:00:00')
        const payloads: Omit<Sesi, 'id'>[] = []
        for (let w = 0; w < repeatWeeks; w++) {
          repeatDays.forEach((d) => {
            const dt = new Date(start)
            dt.setDate(start.getDate() + ((d - start.getDay() + 7) % 7) + w * 7)
            payloads.push({ tanggal: dt.toISOString().split('T')[0], jam, menit, durasi, kolam })
          })
        }
        await addSesiBatch(payloads)
      }
      showToast('Sesi berhasil ditambahkan ✓', 'success')
      setShowTambahS(false); loadSesi()
    } catch (e: any) { showToast('Gagal: ' + e?.message, 'error') }
    finally { setSavingS(false) }
  }

  const handleDeleteS = async (s: Sesi) => {
    if (!confirm('Hapus sesi ini?')) return
    try { await deleteSesi(s.id); showToast('Sesi dihapus'); loadSesi() }
    catch (e: any) { showToast('Gagal hapus: ' + e?.message, 'error') }
  }

  const toggleDay = (d: number) =>
    setRepeatDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])

  const grouped = sesiList.reduce<Record<string, Sesi[]>>((acc, s) => {
    acc[s.tanggal] = acc[s.tanggal] ? [...acc[s.tanggal], s] : [s]; return acc
  }, {})
  const sortedDates = Object.keys(grouped).sort()

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="max-w-[720px] mx-auto">

      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 bg-bg border border-border rounded-xl p-1">
        {([
          ['tetap',  'Jadwal Tetap',  'ti-calendar-repeat'],
          ['khusus', 'Sesi Khusus',   'ti-calendar-event'],
        ] as const).map(([key, label, icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all ${tab === key ? 'bg-[#185FA5] text-white shadow' : 'text-text-muted hover:text-text'}`}>
            <i className={`ti ${icon} text-base`} />{label}
          </button>
        ))}
      </div>

      {/* ══ TAB: JADWAL TETAP ══ */}
      {tab === 'tetap' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-[12px] text-text-muted">Pola mingguan yang selalu berulang — tidak ada tanggal, berlaku selamanya.</p>
            <button onClick={() => { resetFormT(); setShowTambahT(true) }}
              className="flex items-center gap-1.5 bg-[#185FA5] text-white px-3 py-2 rounded-md text-sm font-medium flex-shrink-0 ml-3">
              <i className="ti ti-plus text-base" />Tambah
            </button>
          </div>

          {loadingT && (
            <div className="text-center py-12 text-text-muted text-sm">
              <i className="ti ti-loader-2 text-3xl block mb-2 animate-spin" />Memuat...
            </div>
          )}

          {!loadingT && Object.keys(templatesByKolam).length === 0 && (
            <div className="text-center py-12 text-text-muted">
              <i className="ti ti-calendar-off text-4xl block mb-2 opacity-40" />
              <p className="text-sm">Belum ada jadwal tetap</p>
            </div>
          )}

          {Object.keys(templatesByKolam).sort().map((kolamKey) => (
            <div key={kolamKey} className="mb-6">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                <i className="ti ti-building text-xs" />{kolamKey}
              </div>
              <div className="flex flex-col gap-2">
                {templatesByKolam[kolamKey]
                  .sort((a, b) => {
                    const hA = HARI_ORDER.indexOf(a.hari), hB = HARI_ORDER.indexOf(b.hari)
                    return hA !== hB ? hA - hB : a.jam_mulai.localeCompare(b.jam_mulai)
                  })
                  .map((t) => (
                    <div key={t.id} className="bg-bg border border-border rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm">
                      <div className="w-10 h-10 bg-blue-light rounded-md flex items-center justify-center flex-shrink-0">
                        <i className="ti ti-refresh text-blue text-lg" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[14px] font-semibold text-text">
                          {t.hari} · {t.jam_mulai} – {t.jam_selesai}
                        </div>
                        <div className="text-[12px] text-text-muted">{t.durasi} menit · tiap minggu</div>
                      </div>
                      <button onClick={() => openEditT(t)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue/10 text-text-muted hover:text-blue transition-all">
                        <i className="ti ti-edit text-base" />
                      </button>
                      <button onClick={() => handleDeleteT(t)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red/10 text-text-muted hover:text-red transition-all">
                        <i className="ti ti-trash text-base" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          <Modal open={showTambahT} onClose={() => { setShowTambahT(false); resetFormT() }}
            title={editingT ? 'Edit Jadwal Tetap' : 'Tambah Jadwal Tetap'}>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] text-text-muted block mb-1">Hari</label>
                <div className="flex flex-wrap gap-1.5">
                  {HARI_ORDER.map((h) => (
                    <button key={h} onClick={() => setFormT(f => ({ ...f, hari: h }))}
                      className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${formT.hari === h ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[12px] text-text-muted block mb-1">Jam mulai</label>
                <div className="flex gap-2">
                  <select className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-bg text-text"
                    value={formT.jam_mulai_h} onChange={(e) => setFormT(f => ({ ...f, jam_mulai_h: e.target.value }))}>
                    {JAMS.map((j) => <option key={j} value={j}>{j}:xx</option>)}
                  </select>
                  <select className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-bg text-text"
                    value={formT.jam_mulai_m} onChange={(e) => setFormT(f => ({ ...f, jam_mulai_m: e.target.value }))}>
                    {MENIT_LIST.map((m) => <option key={m} value={m}>:{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[12px] text-text-muted block mb-1">Durasi</label>
                <div className="flex gap-2 flex-wrap">
                  {[30,45,60,90,120,180].map((d) => (
                    <button key={d} onClick={() => setFormT(f => ({ ...f, durasi: d }))}
                      className={`flex-1 py-2 rounded-md border text-[13px] font-medium transition-all ${formT.durasi === d ? 'bg-blue-light border-blue text-blue' : 'border-border text-text-muted'}`}>
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[12px] text-text-muted block mb-1">Kolam</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {KOLAM_PRESETS.map((k) => (
                    <button key={k} onClick={() => { setFormT(f => ({ ...f, kolam: k })); setKolamCustomT(false) }}
                      className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${formT.kolam === k && !kolamCustomT ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                      {k}
                    </button>
                  ))}
                  <button onClick={() => setKolamCustomT(true)}
                    className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${kolamCustomT ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                    + Custom
                  </button>
                </div>
                {kolamCustomT && (
                  <input type="text" placeholder="Nama kolam"
                    value={formT.kolam} onChange={(e) => setFormT(f => ({ ...f, kolam: e.target.value }))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
                )}
              </div>
              <div className="text-[11px] text-blue bg-blue-light/50 rounded-md px-3 py-2">
                Preview: <strong>{formT.hari} {formT.jam_mulai_h}:{formT.jam_mulai_m} – {hitungJamSelesai(formT.jam_mulai_h, formT.jam_mulai_m, formT.durasi)}</strong> · {formT.kolam} · tiap minggu
              </div>
              <button onClick={handleSaveT} disabled={savingT}
                className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-sm font-semibold mt-1 hover:bg-[#0C447C] disabled:opacity-50 transition-all">
                {savingT ? 'Menyimpan...' : (editingT ? 'Simpan Perubahan' : 'Tambah Jadwal')}
              </button>
            </div>
          </Modal>
        </div>
      )}

      {/* ══ TAB: SESI KHUSUS ══ */}
      {tab === 'khusus' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-[12px] text-text-muted">Sesi 1x di tanggal tertentu — libur, pengganti, event, dll.</p>
            <button onClick={() => { resetFormS(); setShowTambahS(true) }}
              className="flex items-center gap-1.5 bg-[#185FA5] text-white px-3 py-2 rounded-md text-sm font-medium flex-shrink-0 ml-3">
              <i className="ti ti-plus text-base" />Tambah
            </button>
          </div>

          {loadingS && (
            <div className="text-center py-12 text-text-muted text-sm">
              <i className="ti ti-loader-2 text-3xl block mb-2 animate-spin" />Memuat...
            </div>
          )}

          {!loadingS && sortedDates.length === 0 && (
            <div className="text-center py-12 text-text-muted">
              <i className="ti ti-calendar-off text-4xl block mb-2 opacity-40" />
              <p className="text-sm">Belum ada sesi khusus</p>
            </div>
          )}

          {sortedDates.map((tglKey) => {
            const hariSesi = new Date(tglKey + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long' })
            const idsPindahKeluar = new Set(penggantiList.filter((p) => p.tanggal_asal === tglKey).map((p) => p.murid_id))
            const muridHariIni = muridJadwalList
              .filter((mj) => mj.murid_aktif && mj.hari.toLowerCase() === hariSesi.toLowerCase() && !idsPindahKeluar.has(mj.murid_id))
              .map((mj) => ({ mj: { id: mj.id, jam_mulai: mj.jam_mulai }, murid: muridList.find((m) => m.id === mj.murid_id) }))
              .filter((x): x is { mj: { id: string; jam_mulai: string }; murid: Murid } => !!x.murid)
              .concat(
                penggantiList
                  .filter((p) => p.tanggal_baru === tglKey)
                  .map((p) => ({ mj: { id: p.id, jam_mulai: p.jam }, murid: muridList.find((m) => m.id === p.murid_id) }))
                  .filter((x): x is { mj: { id: string; jam_mulai: string }; murid: Murid } => !!x.murid)
              )
            return (
              <div key={tglKey} className="mb-4">
                <div className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-2 px-1">
                  {fmtTgl(tglKey)}
                </div>
                <div className="flex flex-col gap-2">
                  {grouped[tglKey].map((s) => (
                    <div key={s.id} className="bg-bg border border-border rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm">
                      <div className="w-10 h-10 bg-blue-light rounded-md flex items-center justify-center flex-shrink-0">
                        <i className="ti ti-calendar-event text-blue text-lg" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[14px] font-semibold text-text">
                          {s.jam}:{s.menit} – {jamSelesai(s.jam, s.menit, s.durasi)}
                        </div>
                        <div className="text-[12px] text-text-muted">{s.kolam} · {s.durasi} menit</div>
                      </div>
                      <button onClick={() => openEditS(s)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue/10 text-text-muted hover:text-blue transition-all">
                        <i className="ti ti-edit text-base" />
                      </button>
                      <button onClick={() => handleDeleteS(s)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red/10 text-text-muted hover:text-red transition-all">
                        <i className="ti ti-trash text-base" />
                      </button>
                    </div>
                  ))}
                </div>
                {muridHariIni.length > 0 && (
                  <div className="mt-2 bg-blue-light/50 border border-blue/10 rounded-lg px-3 py-2">
                    <div className="text-[11px] font-semibold text-blue mb-1.5">
                      <i className="ti ti-users text-xs mr-1" />Murid terdaftar hari {hariSesi} ({muridHariIni.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {muridHariIni.map(({ mj, murid }) => (
                        <span key={mj.id} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${murid.kategori === 'abk' ? 'bg-yellow/10 text-yellow' : 'bg-blue-light text-blue'}`}>
                          {murid.nama}{mj.jam_mulai ? ` · ${mj.jam_mulai}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <Modal open={showTambahS} onClose={() => { setShowTambahS(false); resetFormS() }}
            title={editingS ? 'Edit Sesi Khusus' : 'Tambah Sesi Khusus'}>
            <div className="flex flex-col gap-3">
              {!repeat && (
                <div>
                  <label className="text-[12px] text-text-muted block mb-1">Tanggal</label>
                  <input type="date" value={tgl} onChange={(e) => setTgl(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
                </div>
              )}
              {repeat && (
                <div className="text-[11px] text-text-muted bg-border/30 rounded-md px-3 py-2 italic">
                  Tanggal otomatis mulai dari hari terdekat sesuai hari yang dipilih.
                </div>
              )}
              <div>
                <label className="text-[12px] text-text-muted block mb-1">Jam mulai</label>
                <div className="flex gap-2">
                  <select className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-bg text-text"
                    value={jam} onChange={(e) => setJam(e.target.value)}>
                    {JAMS.map((j) => <option key={j} value={j}>{j}:xx</option>)}
                  </select>
                  <select className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-bg text-text"
                    value={menit} onChange={(e) => setMenit(e.target.value)}>
                    {MENIT_LIST.map((m) => <option key={m} value={m}>:{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[12px] text-text-muted block mb-1">Durasi</label>
                <div className="flex gap-2 flex-wrap">
                  {[30,45,60,90,120,180].map((d) => (
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
                    <button key={k} onClick={() => { setKolam(k); setKolamCustomS(false) }}
                      className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${kolam === k && !kolamCustomS ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                      {k}
                    </button>
                  ))}
                  <button onClick={() => setKolamCustomS(true)}
                    className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${kolamCustomS ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                    + Custom
                  </button>
                </div>
                {kolamCustomS && (
                  <input type="text" placeholder="Nama kolam"
                    value={kolam} onChange={(e) => setKolam(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
                )}
              </div>
              {!editingS && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => { const n = !repeat; setRepeat(n); if (n) setTgl('') }}
                    className={`w-10 h-5 rounded-full transition-all relative ${repeat ? 'bg-blue' : 'bg-border'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${repeat ? 'left-5' : 'left-0.5'}`} />
                  </div>
                  <span className="text-[13px] text-text">Ulangi beberapa minggu</span>
                </label>
              )}
              {repeat && !editingS && (
                <>
                  <div>
                    <label className="text-[12px] text-text-muted block mb-1">Hari</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {HARI_BTN.map((h, i) => (
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
                      {[{ w: 4, l: '4x' }, { w: 8, l: '8x' }, { w: 12, l: '12x' }, { w: 52, l: 'Selalu' }].map(({ w, l }) => (
                        <button key={w} onClick={() => setRepeatWeeks(w)}
                          className={`flex-1 py-2 rounded-md border text-[13px] font-medium transition-all ${repeatWeeks === w ? 'bg-blue-light border-blue text-blue' : 'border-border text-text-muted'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                    {repeatWeeks === 52 && (
                      <p className="text-[11px] text-text-muted mt-1.5">Generate 52 minggu (~1 tahun) ke depan sekaligus.</p>
                    )}
                  </div>
                </>
              )}
              <button onClick={handleSaveS} disabled={savingS}
                className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-sm font-semibold mt-1 hover:bg-[#0C447C] disabled:opacity-50 transition-all">
                {savingS ? 'Menyimpan...' : (editingS ? 'Simpan Perubahan' : 'Tambah Sesi')}
              </button>
            </div>
          </Modal>
        </div>
      )}
    </div>
  )
}