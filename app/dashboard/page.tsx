'use client'
import { useEffect, useState, useRef } from 'react'
import { getSesiByTanggal, getMurid, getAbsensi, upsertAbsensiBatch, addSesi, getMuridSiapTagih, getSlotDariJadwal, getAllMuridJadwal, getAllJadwalPengganti, Sesi, Murid, Absensi, MuridJadwal, JadwalPengganti } from '@/lib/supabase'
import { sendLocalNotif } from '@/components/ui/NotificationSetup'
import { fmtTgl, todayStr, KOLAM_PRESETS, jamSelesai } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'

export default function HariIniPage() {
  const today = todayStr()
  const HARI_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
  const [selectedDate, setSelectedDate] = useState(today)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const [sesiList, setSesiList] = useState<Sesi[]>([])
  const [muridList, setMuridList] = useState<Murid[]>([])
  const [muridJadwalList, setMuridJadwalList] = useState<(MuridJadwal & { murid_nama: string; murid_aktif: boolean })[]>([])
  const [penggantiList, setPenggantiList] = useState<JadwalPengganti[]>([])
  const [absenMap, setAbsenMap] = useState<Record<string, Record<string, Absensi['status']>>>({})
  const [loading, setLoading] = useState(true)
  const [showTambah, setShowTambah] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingSesi, setSavingSesi] = useState<string | null>(null)
  const [siapTagihList, setSiapTagihList] = useState<{murid: Murid; jumlahHadir: number; jumlahTarget: number}[]>([])

  const [jam, setJam] = useState('07')
  const [menit, setMenit] = useState('00')
  const [durasi, setDurasi] = useState(60)
  const [kolam, setKolam] = useState('Kolam A')
  const [kolamCustom, setKolamCustom] = useState(false)

  const JAMS = ['05','06','07','08','09','10','11','12','13','14','15','16','17']
  const MENIT = ['00','15','30','45']

  const load = async () => {
    setLoading(true)
    try {
      const [sesiReal, murid, muridJadwal, pengganti] = await Promise.all([getSesiByTanggal(selectedDate), getMurid(), getAllMuridJadwal(), getAllJadwalPengganti()])
      let sesi = [...sesiReal]

      // Kalau ada pola jadwal mingguan (dari sesi yang pernah dibuat sebelumnya) yang
      // cocok sama hari ini tapi belum ada sesi ASLI di tanggal spesifik ini, tampilkan
      // sebagai "sesi virtual" — nanti baru dibikin beneran pas absensinya disimpan.
      try {
        const slots = await getSlotDariJadwal()
        const hariIni = HARI_ID[new Date(selectedDate + 'T00:00:00').getDay()]
        const slotHariIni = slots.filter((sl) => sl.hari === hariIni)
        slotHariIni.forEach((sl) => {
          const [jam, menit] = sl.jam_mulai.split(':')
          const sudahAda = sesi.some((s) => s.jam === jam && s.menit === menit && s.kolam === sl.kolam)
          if (!sudahAda) {
            const [jm, mm] = sl.jam_mulai.split(':').map(Number)
            const [js, ms] = sl.jam_selesai.split(':').map(Number)
            const durasi = (js * 60 + ms) - (jm * 60 + mm)
            sesi.push({
              id: `virtual::${sl.hari}::${sl.jam_mulai}::${sl.kolam}`,
              tanggal: selectedDate,
              jam, menit,
              durasi: durasi > 0 ? durasi : 60,
              kolam: sl.kolam,
            })
          }
        })
        sesi.sort((a, b) => `${a.jam}${a.menit}`.localeCompare(`${b.jam}${b.menit}`))
      } catch { /* kalau gagal ambil pola jadwal, tetap tampilkan sesi asli aja */ }

      setSesiList(sesi)
      setMuridList(murid)
      setMuridJadwalList(muridJadwal)
      setPenggantiList(pengganti)
      const map: Record<string, Record<string, Absensi['status']>> = {}
      await Promise.all(sesi.filter((s) => !s.id.startsWith('virtual::')).map(async (s) => {
        const abs = await getAbsensi(s.id)
        map[s.id] = {}
        abs.forEach((a) => { map[s.id][a.murid_id] = a.status })
      }))
      setAbsenMap(map)
    } catch (e: any) {
      showToast('Gagal load: ' + (e?.message || ''), 'error')
      console.error(e)
    }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
  }, [selectedDate])

  useEffect(() => {
    // Cek siap tagih saat halaman dibuka (nggak perlu diulang tiap ganti tanggal)
    getMuridSiapTagih().then(setSiapTagihList).catch(() => {})
  }, [])

  // Set status langsung dari klik tombol spesifik (bukan toggle berputar)
  const setStatus = (sesiId: string, muridId: string, status: Absensi['status']) => {
    setAbsenMap((prev) => ({
      ...prev,
      [sesiId]: { ...prev[sesiId], [muridId]: status }
    }))
  }

  const saveAbsen = async (sesiId: string) => {
    setSavingSesi(sesiId)
    try {
      const sesi = sesiList.find((s) => s.id === sesiId)
      if (!sesi) return
      const relevantMurid = muridUntukSesi(sesi)

      // Kalau ini sesi virtual (belum pernah dibuat beneran di tanggal ini),
      // bikin dulu sesi aslinya sebelum nyimpen absensi.
      let realSesiId = sesiId
      if (sesiId.startsWith('virtual::')) {
        const newSesi = await addSesi({
          tanggal: sesi.tanggal,
          jam: sesi.jam,
          menit: sesi.menit,
          durasi: sesi.durasi,
          kolam: sesi.kolam,
        })
        realSesiId = newSesi.id
      }

      const records = relevantMurid.map((m) => ({
        sesi_id: realSesiId,
        murid_id: m.id,
        status: absenMap[sesiId]?.[m.id] ?? 'alpha',
      }))
      await upsertAbsensiBatch(records)
      showToast('Absensi disimpan ✓', 'success')
      load()
      // Cek otomatis murid yang sudah siap tagih
      getMuridSiapTagih().then((list) => {
        setSiapTagihList(list)
        if (list.length > 0) {
          const names = list.map(x => x.murid.nama).join(', ')
          sendLocalNotif(
            `${list.length} murid siap ditagih! 💰`,
            `${names} sudah hadir ${list[0].jumlahHadir}x — waktunya generate tagihan.`,
            '/dashboard/kirim'
          )
        }
      }).catch(() => {})
    } catch (e: any) {
      showToast('Gagal simpan: ' + (e?.message || ''), 'error')
      console.error(e)
    }
    finally { setSavingSesi(null) }
  }

  const tambahSesi = async () => {
    setSaving(true)
    try {
      await addSesi({ tanggal: selectedDate, jam, menit, durasi, kolam })
      showToast('Sesi ditambahkan ✓', 'success')
      setShowTambah(false)
      load()
    } catch (e: any) {
      showToast('Gagal tambah sesi: ' + (e?.message || ''), 'error')
      console.error('addSesi error:', e)
    }
    finally { setSaving(false) }
  }

  const hadirCount = (sesiId: string, murids: Murid[] = muridList) =>
    murids.filter((m) => absenMap[sesiId]?.[m.id] === 'hadir').length

  // Cuma murid yang punya SALAH SATU jadwal (hari+jam+kolam) cocok sama sesi ini.
  // Murid dengan 2 jadwal (misal paket 8x/bulan) otomatis nongol di 2 sesi berbeda.
  // Ditambah: kalau ada jadwal pengganti (kelas makeup 1x), nama dia dipindah
  // dari sesi asal ke sesi baru KHUSUS di tanggal itu — minggu depan balik normal.
  const muridUntukSesi = (s: Sesi) => {
    const hari = HARI_ID[new Date(s.tanggal + 'T00:00:00').getDay()]
    const jamMulai = `${s.jam}:${s.menit}`

    // Murid yang lagi "cuti" dari sesi ini di tanggal ini (udah pindah ke tanggal lain)
    const idsPindahKeluar = new Set(
      penggantiList.filter((p) => p.tanggal_asal === s.tanggal).map((p) => p.murid_id)
    )

    const muridIds = new Set(
      muridJadwalList
        .filter((mj) => mj.hari === hari && mj.jam_mulai === jamMulai && (mj.kolam ?? '') === s.kolam)
        .map((mj) => mj.murid_id)
        .filter((id) => !idsPindahKeluar.has(id))
    )

    // Murid yang pindah MASUK ke sesi ini (makeup di tanggal ini)
    penggantiList
      .filter((p) => p.tanggal_baru === s.tanggal && p.jam === jamMulai && (p.kolam ?? '') === s.kolam)
      .forEach((p) => muridIds.add(p.murid_id))

    return muridList.filter((m) => muridIds.has(m.id))
  }

  // Konfigurasi 3 tombol status
  const STATUS_BTNS: { key: Absensi['status']; label: string; icon: string }[] = [
    { key: 'hadir', label: 'Hadir', icon: 'ti-check' },
    { key: 'izin',  label: 'Izin',  icon: 'ti-clock-pause' },
    { key: 'alpha', label: 'Alpha', icon: 'ti-x' },
  ]

  const btnActiveClass = (status: Absensi['status'], current: Absensi['status'] | undefined) => {
    const isActive = current === status
    if (status === 'hadir') return isActive ? 'bg-blue text-white border-blue' : 'border-border text-text-muted hover:border-blue/40'
    if (status === 'izin')  return isActive ? 'bg-yellow text-white border-yellow' : 'border-border text-text-muted hover:border-yellow/40'
    return isActive ? 'bg-red text-white border-red' : 'border-border text-text-muted hover:border-red/40'
  }

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Header tanggal — bisa diklik buat pilih tanggal lain */}
      <div className="bg-[#185FA5] text-white rounded-lg p-4 mb-4 flex items-start justify-between">
        <div className="relative">
          <div className="text-[13px] opacity-80 mb-0.5">
            {selectedDate === today ? 'Hari ini' : 'Tanggal dipilih'}
          </div>
          <button
            onClick={() => {
              const el = dateInputRef.current
              if (!el) return
              if (typeof (el as any).showPicker === 'function') (el as any).showPicker()
              else el.click()
            }}
            className="text-[17px] font-semibold flex items-center gap-1.5 hover:opacity-80 transition-all"
          >
            {fmtTgl(selectedDate)}
            <i className="ti ti-chevron-down text-[15px]" />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="absolute inset-0 w-full opacity-0 pointer-events-none"
            tabIndex={-1}
          />
          <div className="text-[13px] opacity-80 mt-1 flex items-center gap-2">
            {sesiList.length} sesi · {muridList.length} murid aktif
            {selectedDate !== today && (
              <button onClick={() => setSelectedDate(today)} className="underline hover:opacity-80">
                Kembali ke hari ini
              </button>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowTambah(true)}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-[13px] px-3 py-2 rounded-md font-medium transition-all flex-shrink-0"
        >
          <i className="ti ti-plus text-base" />Tambah Sesi
        </button>
      </div>

      {/* Notifikasi otomatis — murid siap tagih */}
      {siapTagihList.length > 0 && (
        <div className="bg-green/5 border border-green/20 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <i className="ti ti-bell text-green text-base" />
            <span className="text-[13px] font-semibold text-green">
              {siapTagihList.length} murid siap ditagih!
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {siapTagihList.map(({ murid, jumlahHadir, jumlahTarget }) => (
              <div key={murid.id} className="flex items-center justify-between bg-white rounded-md px-3 py-2">
                <div className="text-[12px] font-medium text-text">{murid.nama}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-green font-semibold">{jumlahHadir}/{jumlahTarget}x hadir</span>
                  <a href={`/dashboard/kirim?murid=${murid.id}`}
                    className="text-[11px] bg-green text-white px-2 py-0.5 rounded-full hover:bg-green/80 transition-all">
                    Tagih →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-text-muted text-sm">
          <i className="ti ti-loader-2 text-3xl block mb-2 animate-spin" />Memuat data...
        </div>
      )}

      {!loading && sesiList.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <i className="ti ti-calendar-off text-4xl block mb-2 opacity-40" />
          <p className="text-sm">Belum ada sesi di tanggal ini</p>
          <button onClick={() => setShowTambah(true)} className="mt-3 text-[#185FA5] text-sm font-medium">+ Tambah sesi</button>
        </div>
      )}

      {/* Sesi cards */}
      {sesiList.map((s) => {
        const muridSesi = muridUntukSesi(s)
        const hadir = hadirCount(s.id, muridSesi)
        const pct = muridSesi.length ? Math.round(hadir / muridSesi.length * 100) : 0
        return (
          <div key={s.id} className="bg-bg border border-border rounded-lg mb-3 overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <div>
                <div className="text-[14px] font-semibold text-text flex items-center gap-1.5">
                  {s.jam}:{s.menit} – {jamSelesai(s.jam, s.menit, s.durasi)}
                  {s.id.startsWith('virtual::') && (
                    <span className="text-[9px] font-medium bg-yellow/10 text-yellow px-1.5 py-0.5 rounded-full">Belum disimpan</span>
                  )}
                </div>
                <div className="text-[12px] text-text-muted">{s.kolam} · {s.durasi} menit</div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="text-[13px] text-text-muted">{hadir}/{muridSesi.length}</div>
                <div className="w-10 h-10 relative">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E6F1FB" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#185FA5" strokeWidth="3"
                      strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset="0" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-blue">{pct}%</div>
                </div>
              </div>
            </div>

            {/* List murid dengan 3 tombol status — cuma murid yang jadwalnya cocok sesi ini */}
            <div className="p-3 flex flex-col gap-2">
              {muridSesi.length === 0 && (
                <div className="text-center py-3 text-text-muted text-[12px]">Belum ada murid dengan jadwal tetap di sesi ini</div>
              )}
              {muridSesi.map((m) => {
                const st = absenMap[s.id]?.[m.id]
                return (
                  <div key={m.id} className="flex items-center gap-2.5 px-2 py-1.5">
                    <Avatar nama={m.nama} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-text truncate flex items-center gap-1.5">
                        {m.nama}
                        {m.kategori === 'abk' && <span className="text-[9px] bg-yellow/10 text-yellow px-1 py-0.5 rounded-full flex-shrink-0">ABK</span>}
                      </div>
                    </div>
                    {/* 3 tombol status — H / I / A */}
                    <div className="flex gap-1 flex-shrink-0">
                      {STATUS_BTNS.map((btn) => (
                        <button
                          key={btn.key}
                          onClick={() => setStatus(s.id, m.id, btn.key)}
                          title={btn.label}
                          className={`w-8 h-8 rounded-md border flex items-center justify-center transition-all ${btnActiveClass(btn.key, st)}`}
                        >
                          <i className={`ti ${btn.icon} text-[15px]`} />
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="px-4 pb-4">
              <button onClick={() => saveAbsen(s.id)} disabled={savingSesi === s.id}
                className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-[14px] font-semibold hover:bg-[#0C447C] transition-all disabled:opacity-50">
                {savingSesi === s.id ? (
                  <><i className="ti ti-loader-2 animate-spin mr-1.5" />Menyimpan...</>
                ) : (
                  <><i className="ti ti-device-floppy mr-1.5" />Simpan Absensi</>
                )}
              </button>
            </div>
          </div>
        )
      })}

      {/* Modal tambah sesi */}
      <Modal open={showTambah} onClose={() => setShowTambah(false)} title={selectedDate === today ? 'Tambah Sesi Hari Ini' : `Tambah Sesi — ${fmtTgl(selectedDate)}`}>
        <div className="flex flex-col gap-3">
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
            <label className="text-[12px] text-text-muted block mb-1">Durasi (menit)</label>
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
              <input type="text" placeholder="Nama kolam (contoh: Kolam Olimpik)"
                value={kolam}
                onChange={(e) => setKolam(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
            )}
          </div>
          <button onClick={tambahSesi} disabled={saving}
            className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-[14px] font-semibold mt-1 hover:bg-[#0C447C] transition-all disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Tambah Sesi'}
          </button>
        </div>
      </Modal>
    </div>
  )
}