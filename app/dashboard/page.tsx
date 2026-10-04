'use client'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getSesiByTanggal, getMurid, getAbsensi, upsertAbsensiBatch, addSesi, getMuridSiapTagih, getSlotDariJadwal, getAllMuridJadwal, getAllJadwalPengganti, Sesi, Murid, Absensi, MuridJadwal, JadwalPengganti } from '@/lib/supabase'
import { sendLocalNotif } from '@/components/ui/NotificationSetup'
import { fmtTgl, todayStr, KOLAM_PRESETS, jamSelesai } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'

// ─── Helper: sapaan berdasarkan jam saat ini (dipanggil on-click, bukan on-render) ───
function getSapaan(): string {
  const jam = new Date().getHours()
  if (jam < 11) return 'Selamat pagi'
  if (jam < 15) return 'Selamat siang'
  if (jam < 18) return 'Selamat sore'
  return 'Selamat malam'
}

// ─── Helper: format nomor WA (handle 08xx dan 628xx) ───
function formatWA(noWa: string): string {
  const clean = noWa.replace(/\D/g, '') // strip non-digit
  if (clean.startsWith('62')) return clean
  if (clean.startsWith('0')) return '62' + clean.slice(1)
  return '62' + clean
}

// ─── Helper: tanggal besok ───
function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// ─── Helper: nama hari dalam Bahasa Indonesia ───
const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function namaHari(dateStr: string): string {
  return HARI_ID[new Date(dateStr + 'T00:00:00').getDay()]
}

// ─── Helper: format tanggal lengkap (contoh: "28 September 2026") ───
function fmtTglLengkap(dateStr: string): string {
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`
}

// ─── Tipe data untuk tab Jadwal Besok ───
interface MuridBesok {
  murid: Murid
  jamSesi: string // format "07:00"
  kolam: string
}

export default function HariIniPage() {
  const today = todayStr()
  const tomorrow = tomorrowStr()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Tab aktif dari URL, default "hari-ini"
  const activeTab = searchParams.get('tab') === 'jadwal-besok' ? 'jadwal-besok' : 'hari-ini'

  const [selectedDate, setSelectedDate] = useState(today)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const [sesiList, setSesiList] = useState<Sesi[]>([])
  const [muridList, setMuridList] = useState<Murid[]>([])
  const [muridJadwalList, setMuridJadwalList] = useState<(MuridJadwal & { murid_nama: string; murid_aktif: boolean })[]>([])
  const [penggantiList, setPenggantiList] = useState<JadwalPengganti[]>([])
  const [absenMap, setAbsenMap] = useState<Record<string, Record<string, Absensi['status']>>>({})
  const [loading, setLoading] = useState(true)
  const [showTambah, setShowTambah] = useState(false)
  const [tagihBuka, setTagihBuka] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingSesi, setSavingSesi] = useState<string | null>(null)
  const [siapTagihList, setSiapTagihList] = useState<{murid: Murid; jumlahHadir: number; jumlahTarget: number}[]>([])

  // ─── State untuk Tab Jadwal Besok ───
  const [loadingBesok, setLoadingBesok] = useState(false)
  const [muridBesokList, setMuridBesokList] = useState<MuridBesok[]>([])
  const [besokLoaded, setBesokLoaded] = useState(false)

  const [jam, setJam] = useState('07')
  const [menit, setMenit] = useState('00')
  const [durasi, setDurasi] = useState(60)
  const [kolam, setKolam] = useState('Kolam A')
  const [kolamCustom, setKolamCustom] = useState(false)

  const JAMS = ['05','06','07','08','09','10','11','12','13','14','15','16','17']
  const MENIT = ['00','15','30','45']

  // ─── Load data utama (Tab Hari Ini) ───
  const load = async () => {
    setLoading(true)
    try {
      const [sesiReal, murid, muridJadwal, pengganti] = await Promise.all([
        getSesiByTanggal(selectedDate),
        getMurid(),
        getAllMuridJadwal(),
        getAllJadwalPengganti(),
      ])
      let sesi = [...sesiReal]

      try {
        const slots = await getSlotDariJadwal()
        const hariIni = HARI_ID[new Date(selectedDate + 'T00:00:00').getDay()]
        const slotHariIni = slots.filter((sl) => sl.hari === hariIni)
        slotHariIni.forEach((sl) => {
          const [j, m] = sl.jam_mulai.split(':')
          const sudahAda = sesi.some((s) => s.jam === j && s.menit === m && s.kolam === sl.kolam)
          if (!sudahAda) {
            const [jm, mm] = sl.jam_mulai.split(':').map(Number)
            const [js, ms] = sl.jam_selesai.split(':').map(Number)
            const dur = (js * 60 + ms) - (jm * 60 + mm)
            sesi.push({
              id: `virtual::${sl.hari}::${sl.jam_mulai}::${sl.kolam}`,
              tanggal: selectedDate,
              jam: j, menit: m,
              durasi: dur > 0 ? dur : 60,
              kolam: sl.kolam,
            })
          }
        })
        sesi.sort((a, b) => `${a.jam}${a.menit}`.localeCompare(`${b.jam}${b.menit}`))
      } catch { /* tetap tampilkan sesi asli */ }

      setSesiList(sesi)
      setMuridList(murid)
      setMuridJadwalList(muridJadwal)
      setPenggantiList(pengganti)

      const map: Record<string, Record<string, Absensi['status']>> = {}
      await Promise.all(
        sesi.filter((s) => !s.id.startsWith('virtual::')).map(async (s) => {
          const abs = await getAbsensi(s.id)
          map[s.id] = {}
          abs.forEach((a) => { map[s.id][a.murid_id] = a.status })
        })
      )
      setAbsenMap(map)
    } catch (e: any) {
      showToast('Gagal load: ' + (e?.message || ''), 'error')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ─── Load data Jadwal Besok ───
  const loadJadwalBesok = async () => {
    if (besokLoaded) return // sudah pernah load, skip
    setLoadingBesok(true)
    try {
      const [sesiReal, murid, muridJadwal, pengganti] = await Promise.all([
        getSesiByTanggal(tomorrow),
        getMurid(),
        getAllMuridJadwal(),
        getAllJadwalPengganti(),
      ])

      // Reuse logika muridUntukSesi untuk tanggal besok
      const hariB = HARI_ID[new Date(tomorrow + 'T00:00:00').getDay()]

      // Kumpulkan semua sesi besok (termasuk virtual dari jadwal template)
      let sesiB = [...sesiReal]
      try {
        const slots = await getSlotDariJadwal()
        const slotB = slots.filter((sl) => sl.hari === hariB)
        slotB.forEach((sl) => {
          const [j, m] = sl.jam_mulai.split(':')
          const sudahAda = sesiB.some((s) => s.jam === j && s.menit === m && s.kolam === sl.kolam)
          if (!sudahAda) {
            const [jm, mm] = sl.jam_mulai.split(':').map(Number)
            const [js, ms] = sl.jam_selesai.split(':').map(Number)
            const dur = (js * 60 + ms) - (jm * 60 + mm)
            sesiB.push({
              id: `virtual::${sl.hari}::${sl.jam_mulai}::${sl.kolam}`,
              tanggal: tomorrow,
              jam: j, menit: m,
              durasi: dur > 0 ? dur : 60,
              kolam: sl.kolam,
            })
          }
        })
        sesiB.sort((a, b) => `${a.jam}${a.menit}`.localeCompare(`${b.jam}${b.menit}`))
      } catch { /* tetap pakai sesi asli */ }

      // Untuk tiap sesi besok, cari murid yang terdaftar
      const result: MuridBesok[] = []
      const seenMuridIds = new Set<string>()

      sesiB.forEach((s) => {
        const jamMulai = `${s.jam}:${s.menit}`

        const idsPindahKeluar = new Set(
          pengganti.filter((p) => p.tanggal_asal === s.tanggal).map((p) => p.murid_id)
        )
        const muridIds = new Set(
          muridJadwal
            .filter((mj) => mj.hari === hariB && mj.jam_mulai === jamMulai && (mj.kolam ?? '') === s.kolam)
            .map((mj) => mj.murid_id)
            .filter((id) => !idsPindahKeluar.has(id))
        )
        pengganti
          .filter((p) => p.tanggal_baru === s.tanggal && p.jam === jamMulai && (p.kolam ?? '') === s.kolam)
          .forEach((p) => muridIds.add(p.murid_id))

        murid
          .filter((m) => muridIds.has(m.id) && !seenMuridIds.has(m.id))
          .forEach((m) => {
            seenMuridIds.add(m.id)
            result.push({ murid: m, jamSesi: `${s.jam}:${s.menit}`, kolam: s.kolam })
          })
      })

      setMuridBesokList(result)
      setBesokLoaded(true)
    } catch (e: any) {
      showToast('Gagal load jadwal besok: ' + (e?.message || ''), 'error')
      console.error(e)
    } finally {
      setLoadingBesok(false)
    }
  }

  useEffect(() => {
    load()
  }, [selectedDate])

  useEffect(() => {
    getMuridSiapTagih().then(setSiapTagihList).catch(() => {})
  }, [])

  // Load jadwal besok saat tab aktif
  useEffect(() => {
    if (activeTab === 'jadwal-besok') {
      loadJadwalBesok()
    }
  }, [activeTab])

  const saveAbsen = async (sesiId: string) => {
    setSavingSesi(sesiId)
    try {
      const sesi = sesiList.find((s) => s.id === sesiId)
      if (!sesi) return
      const relevantMurid = muridUntukSesi(sesi)

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
    } finally {
      setSavingSesi(null)
    }
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
    } finally {
      setSaving(false)
    }
  }

  const STATUS_BTNS: { key: Absensi['status']; label: string; icon: string }[] = [
    { key: 'hadir', label: 'Hadir',  icon: 'ti-check' },
    { key: 'sakit', label: 'Sakit',  icon: 'ti-heart-broken' },
    { key: 'izin',  label: 'Izin',   icon: 'ti-clock-pause' },
    { key: 'alpha', label: 'Alpha',  icon: 'ti-x' },
  ]

  const btnActiveClass = (status: Absensi['status'], current: Absensi['status'] | undefined) => {
    const isActive = current === status
    if (status === 'hadir') return isActive ? 'bg-blue text-white border-blue'             : 'border-border text-text-muted hover:border-blue/40'
    if (status === 'sakit') return isActive ? 'bg-purple-500 text-white border-purple-500' : 'border-border text-text-muted hover:border-purple-400/60'
    if (status === 'izin')  return isActive ? 'bg-yellow text-white border-yellow'         : 'border-border text-text-muted hover:border-yellow/40'
    return isActive ? 'bg-red text-white border-red' : 'border-border text-text-muted hover:border-red/40'
  }

  const muridUntukSesi = (s: Sesi) => {
    const hari = HARI_ID[new Date(s.tanggal + 'T00:00:00').getDay()]
    const jamMulai = `${s.jam}:${s.menit}`
    const idsPindahKeluar = new Set(
      penggantiList.filter((p) => p.tanggal_asal === s.tanggal).map((p) => p.murid_id)
    )
    const muridIds = new Set(
      muridJadwalList
        .filter((mj) => mj.hari === hari && mj.jam_mulai === jamMulai && (mj.kolam ?? '') === s.kolam)
        .map((mj) => mj.murid_id)
        .filter((id) => !idsPindahKeluar.has(id))
    )
    penggantiList
      .filter((p) => p.tanggal_baru === s.tanggal && p.jam === jamMulai && (p.kolam ?? '') === s.kolam)
      .forEach((p) => muridIds.add(p.murid_id))
    return muridList.filter((m) => muridIds.has(m.id))
  }

  type EntitasAbsensi = { key: string; members: Murid[] }

  const entitasUntukSesi = (s: Sesi): EntitasAbsensi[] => {
    const murids = muridUntukSesi(s)
    const seen = new Set<string>()
    const entitas: EntitasAbsensi[] = []
    murids.forEach((m) => {
      const key = m.kelompok_adik_kakak || m.id
      if (seen.has(key)) return
      seen.add(key)
      const members = m.kelompok_adik_kakak
        ? murids.filter((x) => x.kelompok_adik_kakak === key)
        : [m]
      entitas.push({ key, members })
    })
    return entitas
  }

  const groupStatus = (sesiId: string, members: Murid[]): Absensi['status'] | undefined => {
    const statuses = members.map((m) => absenMap[sesiId]?.[m.id])
    if (statuses.some((st) => st === 'hadir')) return 'hadir'
    if (statuses.some((st) => st === 'sakit')) return 'sakit'
    if (statuses.some((st) => st === 'izin')) return 'izin'
    if (statuses.some((st) => st === 'alpha')) return 'alpha'
    return undefined
  }

  const setEntitasStatus = (sesiId: string, members: Murid[], status: Absensi['status']) => {
    setAbsenMap((prev) => {
      const sesiMap = { ...prev[sesiId] }
      members.forEach((m) => { sesiMap[m.id] = status })
      return { ...prev, [sesiId]: sesiMap }
    })
  }

  const hadirCountEntitas = (entitas: EntitasAbsensi[], sesiId: string) =>
    entitas.filter((e) => groupStatus(sesiId, e.members) === 'hadir').length

  // ─── Handler kirim WA — getSapaan() dipanggil saat klik ───
  const handleKirimWA = (mb: MuridBesok) => {
    const sapaan = getSapaan() // dipanggil ON CLICK, bukan saat render
    const namaHariBesok = namaHari(tomorrow)
    const tglLengkap = fmtTglLengkap(tomorrow)
    const jamSesiDisplay = mb.jamSesi // sudah format "07:00"
    const nama = mb.murid.nama

    const pesan = `${sapaan} Bapak/Ibu orang tua ${nama}, kami ingin mengingatkan bahwa ${nama} memiliki jadwal latihan renang besok, ${namaHariBesok} ${tglLengkap} pukul ${jamSesiDisplay}. Mohon hadir tepat waktu. Terima kasih 🏊`
    const nomorWA = formatWA(mb.murid.wa_ortu)
    const url = `https://wa.me/${nomorWA}?text=${encodeURIComponent(pesan)}`
    window.open(url, '_blank')
  }

  // ─── Handler kirim WA Hari Ini — sapaan dihitung saat KLIK, bukan saat render ───
  const kirimWAHariIni = (namaMurid: string, noWA: string, jamSesi: string) => {
    const sapaan = getSapaan()
    const pesan = `${sapaan} Bapak/Ibu orang tua ${namaMurid}.\nMohon maaf mengganggu waktunya, ijin mengingatkan bahwa ${namaMurid} memiliki jadwal latihan renang hari ini pukul ${jamSesi}. Mohon hadir tepat waktu. Terima kasih 🙏🏻`
    const url = `https://wa.me/${formatWA(noWA)}?text=${encodeURIComponent(pesan)}`
    window.open(url, '_blank')
  }

  // ─── Tab navigation ───
  const setTab = (tab: 'hari-ini' | 'jadwal-besok') => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="max-w-[720px] mx-auto">

      {/* ─── Tab switcher ─── */}
      <div className="flex gap-1 mb-4 bg-bg border border-border rounded-lg p-1">
        <button
          onClick={() => setTab('hari-ini')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[13px] font-semibold transition-all ${
            activeTab === 'hari-ini'
              ? 'bg-[#185FA5] text-white shadow-sm'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <i className="ti ti-calendar-check text-base" />
          Hari Ini
        </button>
        <button
          onClick={() => setTab('jadwal-besok')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[13px] font-semibold transition-all ${
            activeTab === 'jadwal-besok'
              ? 'bg-[#185FA5] text-white shadow-sm'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <i className="ti ti-send text-base" />
          Jadwal Besok
        </button>
      </div>

      {/* ════════════════════════════════════
          TAB 1 — HARI INI (konten existing)
          ════════════════════════════════════ */}
      {activeTab === 'hari-ini' && (
        <>
          {/* Header tanggal */}
          <div className="bg-[#185FA5] text-white rounded-lg p-4 mb-4 flex items-start justify-between">
            <div className="relative">
              <div className="text-[13px] opacity-80 mb-0.5">
                {selectedDate === today ? 'Hari ini' : 'Tanggal dipilih'}
              </div>
              <div className="relative inline-flex items-center">
                <button
                  className="text-[15px] font-semibold flex items-center gap-1.5 hover:opacity-80 transition-all"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  {fmtTgl(selectedDate)}
                  <i className="ti ti-chevron-down text-[13px]" />
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  aria-label="Pilih tanggal"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    fontSize: '16px',
                    zIndex: 10,
                  }}
                />
              </div>
              <div className="text-[13px] opacity-80 mt-1 flex items-center gap-2">
                {sesiList.length} sesi · {muridList.length} murid aktif
                {selectedDate !== today && (
                  <button
                    onClick={() => setSelectedDate(today)}
                    className="underline hover:opacity-80 relative z-20"
                  >
                    Kembali ke hari ini
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowTambah(true)}
              aria-label="Tambah Sesi"
              className="flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-[13px] font-medium transition-all flex-shrink-0 w-8 h-8 rounded-full lg:w-auto lg:h-auto lg:px-3 lg:py-2 lg:rounded-md"
            >
              <i className="ti ti-plus text-base" /><span className="hidden lg:inline">Tambah Sesi</span>
            </button>
          </div>

          {/* ─── PERUBAHAN 3: Notifikasi murid siap tagih + scroll max-h ─── */}
          {siapTagihList.length > 0 && (
            <div className="bg-green/5 border border-green/20 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="ti ti-bell text-green text-base" />
                <span className="text-[13px] font-semibold text-green">
                  {siapTagihList.length} murid siap ditagih!
                </span>
                {siapTagihList.length > 2 && (
                  <button
                    onClick={() => setTagihBuka((v) => !v)}
                    className="ml-auto text-[11px] font-semibold text-green underline underline-offset-2"
                  >
                    {tagihBuka ? 'Ringkas' : `Lihat semua (${siapTagihList.length})`}
                  </button>
                )}
              </div>
              {/* ↓ Wrapper scroll — badge di atas tetap statis */}
              <div className="max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                <div className="flex flex-col gap-1.5">
                  {(tagihBuka ? siapTagihList : siapTagihList.slice(0, 2)).map(({ murid, jumlahHadir, jumlahTarget }) => (
                    <div key={murid.id} className="flex items-center justify-between bg-white rounded-md px-3 py-2">
                      <div className="text-[12px] font-medium text-text">{murid.nama}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-green font-semibold">{jumlahHadir}/{jumlahTarget}x hadir</span>
                        <a
                          href={`/dashboard/kirim?murid=${murid.id}`}
                          className="text-[11px] bg-green text-white px-2 py-0.5 rounded-full hover:bg-green/80 transition-all"
                        >
                          Tagih →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
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
              <button onClick={() => setShowTambah(true)} className="mt-3 text-[#185FA5] text-sm font-medium">
                + Tambah sesi
              </button>
            </div>
          )}

          {/* Sesi cards */}
          {sesiList.map((s) => {
            const entitas = entitasUntukSesi(s)
            const hadir = hadirCountEntitas(entitas, s.id)
            const pct = entitas.length ? Math.round(hadir / entitas.length * 100) : 0
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
                    <div className="text-[13px] text-text-muted">{hadir}/{entitas.length}</div>
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

                <div className="p-3 flex flex-col gap-2">
                  {entitas.length === 0 && (
                    <div className="text-center py-3 text-text-muted text-[12px]">
                      Belum ada murid dengan jadwal tetap di sesi ini
                    </div>
                  )}
                  {entitas.map((e) => {
                    const st = groupStatus(s.id, e.members)
                    const namaGabungan = e.members.map((m) => m.nama).join(' & ')
                    const adaAbk = e.members.some((m) => m.kategori === 'abk')
                    return (
                      <div key={e.key} className="flex flex-wrap items-center gap-x-2.5 gap-y-2 px-2 py-2 border-b border-border/60 last:border-b-0 lg:flex-nowrap lg:border-b-0 lg:py-1.5">
                        <Avatar nama={namaGabungan} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-text flex flex-wrap items-center gap-x-1.5 gap-y-0.5 lg:flex-nowrap lg:truncate">
                            {namaGabungan}
                            {adaAbk && <span className="text-[9px] bg-yellow/10 text-yellow px-1 py-0.5 rounded-full flex-shrink-0">ABK</span>}
                            {e.members.length > 1 && (
                              <span className="text-[9px] bg-blue-light text-blue px-1 py-0.5 rounded-full flex-shrink-0">Adik Kakak</span>
                            )}
                          </div>
                        </div>
                        {selectedDate === today && (() => {
            const noWA = e.members.find((mm) => mm.wa_ortu)?.wa_ortu
            if (!noWA) return null
            return (
              <button
                onClick={() => kirimWAHariIni(namaGabungan, noWA, `${s.jam}:${s.menit}`)}
                title="Ingatkan jadwal hari ini via WhatsApp"
                aria-label="Ingatkan jadwal hari ini via WhatsApp"
                className="w-9 h-9 lg:w-7 lg:h-8 lg:mr-1 flex items-center justify-center rounded-md text-[#25D366] hover:bg-[#25D366]/10 transition-all flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </button>
            )
          })()}
                        <div className="flex gap-1 w-full lg:w-auto lg:gap-1 lg:flex-shrink-0">
                          {STATUS_BTNS.map((btn) => (
                            <button
                              key={btn.key}
                              onClick={() => setEntitasStatus(s.id, e.members, btn.key)}
                              title={btn.label}
                              className={`flex-1 h-8 gap-1 lg:flex-none lg:w-8 lg:h-8 lg:gap-0 rounded-md border flex items-center justify-center transition-all ${btnActiveClass(btn.key, st)}`}
                            >
                              <i className={`ti ${btn.icon} text-[13px] lg:text-[15px]`} />
                              <span className="text-[10.5px] font-medium lg:hidden">{btn.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="px-4 pb-4">
                  <button
                    onClick={() => saveAbsen(s.id)}
                    disabled={savingSesi === s.id}
                    className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-[14px] font-semibold hover:bg-[#0C447C] transition-all disabled:opacity-50"
                  >
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
        </>
      )}

      {/* ════════════════════════════════════
          TAB 2 — JADWAL BESOK
          ════════════════════════════════════ */}
      {activeTab === 'jadwal-besok' && (
        <div>
          {/* Sub-header info tanggal besok */}
          <div className="bg-[#185FA5] text-white rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
            <i className="ti ti-calendar-event text-xl opacity-80" />
            <div>
              <div className="text-[13px] opacity-80">Jadwal latihan</div>
              <div className="text-[15px] font-semibold">
                {namaHari(tomorrow)}, {fmtTglLengkap(tomorrow)}
              </div>
            </div>
          </div>

          {/* Loading skeleton */}
          {loadingBesok && (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-bg border border-border rounded-lg px-4 py-3 flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-border flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 bg-border rounded w-32 mb-1.5" />
                    <div className="h-2.5 bg-border rounded w-20" />
                  </div>
                  <div className="w-24 h-8 bg-border rounded-md" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loadingBesok && muridBesokList.length === 0 && (
            <div className="text-center py-16 text-text-muted">
              <i className="ti ti-swimming text-5xl block mb-3 opacity-30" />
              <p className="text-sm font-medium">Tidak ada sesi latihan besok 🏊</p>
              <p className="text-[12px] mt-1 opacity-70">Jadwal kosong atau belum ada murid terdaftar</p>
            </div>
          )}

          {/* List murid */}
          {!loadingBesok && muridBesokList.length > 0 && (
            <>
              <div className="text-[12px] text-text-muted mb-2 px-1">
                {muridBesokList.length} murid terdaftar
              </div>
              <div className="flex flex-col gap-2">
                {muridBesokList.map((mb) => (
                  <div
                    key={mb.murid.id}
                    className="bg-bg border border-border rounded-lg px-4 py-3 flex items-center gap-3"
                  >
                    <Avatar nama={mb.murid.nama} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-text truncate">{mb.murid.nama}</div>
                      <div className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                        <i className="ti ti-clock text-[10px]" />
                        {mb.jamSesi}
                        <span className="opacity-40">·</span>
                        {mb.kolam}
                        {mb.murid.kategori === 'abk' && (
                          <span className="bg-yellow/10 text-yellow px-1 py-0.5 rounded-full text-[9px] font-medium">ABK</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleKirimWA(mb)}
                      className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-[12px] px-3 py-2 rounded-md font-semibold transition-all flex-shrink-0"
                    >
                      {/* WhatsApp icon SVG kecil */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Kirim WA
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal tambah sesi */}
      <Modal
        open={showTambah}
        onClose={() => setShowTambah(false)}
        title={selectedDate === today ? 'Tambah Sesi Hari Ini' : `Tambah Sesi — ${fmtTgl(selectedDate)}`}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] text-text-muted block mb-1">Jam mulai</label>
            <div className="flex gap-2">
              <select
                className="flex-1 border border-border rounded-md px-3 py-2 bg-bg text-text"
                style={{ fontSize: '16px' }}
                value={jam}
                onChange={(e) => setJam(e.target.value)}
              >
                {JAMS.map((j) => <option key={j} value={j}>{j}:xx</option>)}
              </select>
              <select
                className="flex-1 border border-border rounded-md px-3 py-2 bg-bg text-text"
                style={{ fontSize: '16px' }}
                value={menit}
                onChange={(e) => setMenit(e.target.value)}
              >
                {MENIT.map((m) => <option key={m} value={m}>:{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[12px] text-text-muted block mb-1">Durasi (menit)</label>
            <div className="flex gap-2">
              {[30, 45, 60, 90].map((d) => (
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
              <input
                type="text"
                placeholder="Nama kolam (contoh: Kolam Olimpik)"
                value={kolam}
                onChange={(e) => setKolam(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 bg-bg text-text"
                style={{ fontSize: '16px' }}
              />
            )}
          </div>
          <button
            onClick={tambahSesi}
            disabled={saving}
            className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-[14px] font-semibold mt-1 hover:bg-[#0C447C] transition-all disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Tambah Sesi'}
          </button>
        </div>
      </Modal>
    </div>
  )
}