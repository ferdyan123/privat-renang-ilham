'use client'
import { useEffect, useState } from 'react'
import { getSesiByTanggal, getMurid, getAbsensi, upsertAbsensiBatch, addSesi, getMuridSiapTagih, Sesi, Murid, Absensi } from '@/lib/supabase'
import { sendLocalNotif } from '@/components/ui/NotificationSetup'
import { fmtTgl, todayStr, KOLAM_PRESETS, jamSelesai } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'

export default function HariIniPage() {
  const today = todayStr()
  const [sesiList, setSesiList] = useState<Sesi[]>([])
  const [muridList, setMuridList] = useState<Murid[]>([])
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
      const [sesi, murid] = await Promise.all([getSesiByTanggal(today), getMurid()])
      setSesiList(sesi)
      setMuridList(murid)
      const map: Record<string, Record<string, Absensi['status']>> = {}
      await Promise.all(sesi.map(async (s) => {
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
    // Cek siap tagih saat halaman dibuka
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
      const records = muridList.map((m) => ({
        sesi_id: sesiId,
        murid_id: m.id,
        status: absenMap[sesiId]?.[m.id] ?? 'alpha',
      }))
      await upsertAbsensiBatch(records)
      showToast('Absensi disimpan ✓', 'success')
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
      await addSesi({ tanggal: today, jam, menit, durasi, kolam })
      showToast('Sesi ditambahkan ✓', 'success')
      setShowTambah(false)
      load()
    } catch (e: any) {
      showToast('Gagal tambah sesi: ' + (e?.message || ''), 'error')
      console.error('addSesi error:', e)
    }
    finally { setSaving(false) }
  }

  const hadirCount = (sesiId: string) =>
    muridList.filter((m) => absenMap[sesiId]?.[m.id] === 'hadir').length

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
      {/* Header hari ini */}
      <div className="bg-[#185FA5] text-white rounded-lg p-4 mb-4 flex items-start justify-between">
        <div>
          <div className="text-[13px] opacity-80 mb-0.5">Hari ini</div>
          <div className="text-[17px] font-semibold">{fmtTgl(today)}</div>
          <div className="text-[13px] opacity-80 mt-1">{sesiList.length} sesi · {muridList.length} murid aktif</div>
        </div>
        <button
          onClick={() => setShowTambah(true)}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-[13px] px-3 py-2 rounded-md font-medium transition-all"
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
                  <a href="/dashboard/kirim"
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
          <p className="text-sm">Belum ada sesi hari ini</p>
          <button onClick={() => setShowTambah(true)} className="mt-3 text-[#185FA5] text-sm font-medium">+ Tambah sesi</button>
        </div>
      )}

      {/* Sesi cards */}
      {sesiList.map((s) => {
        const hadir = hadirCount(s.id)
        const pct = muridList.length ? Math.round(hadir / muridList.length * 100) : 0
        return (
          <div key={s.id} className="bg-bg border border-border rounded-lg mb-3 overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <div>
                <div className="text-[14px] font-semibold text-text">{s.jam}:{s.menit} – {jamSelesai(s.jam, s.menit, s.durasi)}</div>
                <div className="text-[12px] text-text-muted">{s.kolam} · {s.durasi} menit</div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="text-[13px] text-text-muted">{hadir}/{muridList.length}</div>
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

            {/* List murid dengan 3 tombol status */}
            <div className="p-3 flex flex-col gap-2">
              {muridList.map((m) => {
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
      <Modal open={showTambah} onClose={() => setShowTambah(false)} title="Tambah Sesi Hari Ini">
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