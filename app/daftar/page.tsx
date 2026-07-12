'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, getJadwalSlot, JadwalSlot, adaPromoAktif, validasiPromo, pakaiPromo, PromoInfo, getHargaSetting } from '@/lib/supabase'
import { DEFAULT_HARGA_SETTING, HargaSetting, hitungHarga, hitungHargaAdikKakak, ADIK_KAKAK_MIN, ADIK_KAKAK_MAX, POTONGAN_ADIK_KAKAK, PERATURAN_SESI, fmtRupiah, getRekeningByPemilik } from '@/lib/utils'
import { ToastProvider, showToast } from '@/components/ui/Toast'

const KELAS_LIST = [
  { id: 'semi_privat', label: 'Semi Privat', desc: 'Belajar bersama dengan maks 4 anak' },
  { id: 'eksklusif', label: 'Eksklusif', desc: 'Sesi khusus 1-on-1 dengan instruktur' },
  { id: 'adik_kakak', label: 'Adik Kakak', desc: '2-5 bersaudara sekaligus, hemat per anak' },
]

// Hari & jam diambil dari jadwal_slot Supabase
const STEP_LABELS = ['Biodata', 'Kelas & Jadwal', 'Pembayaran']

// Tata letak ilustrasi — abstrak, tengah maju mendekati form
const ILUSTRASI = [
  // Kiri atas — agak jauh
  { src: '/ilustrasi/swim4.png', style: { top: '8%',   left: '2%',   width: 100, opacity: 0.28, transform: 'rotate(-12deg)' } },
  // Kiri tengah — maju ke dalam mendekati form
  { src: '/ilustrasi/swim1.png', style: { top: '38%',  left: '8%',   width: 140, opacity: 0.33, transform: 'rotate(5deg)' } },
  // Kiri bawah — agak masuk
  { src: '/ilustrasi/swim3.png', style: { bottom: '5%',left: '4%',   width: 115, opacity: 0.30, transform: 'rotate(-8deg)' } },
  // Kanan atas — agak jauh + naik
  { src: '/ilustrasi/swim6.png', style: { top: '6%',   right: '3%',  width: 95,  opacity: 0.26, transform: 'rotate(14deg)' } },
  // Kanan tengah — maju ke dalam mendekati form
  { src: '/ilustrasi/swim5.png', style: { top: '40%',  right: '7%',  width: 125, opacity: 0.33, transform: 'rotate(-7deg)' } },
  // Kanan bawah — agak masuk + besar
  { src: '/ilustrasi/swim2.png', style: { bottom: '3%',right: '2%',  width: 155, opacity: 0.36, transform: 'rotate(4deg)' } },
]

export default function DaftarPublikPage() {
  return (
    <Suspense fallback={null}>
      <DaftarPublikPageContent />
    </Suspense>
  )
}

function DaftarPublikPageContent() {
  const searchParams = useSearchParams()
  // Pemilik rekening tujuan — dibawa dari link yang di-generate di halaman Slot.
  // Default 'Ilham' kalau link lama/tanpa param.
  const pemilik = searchParams.get('pemilik') || 'Ilham'
  const REKENING = getRekeningByPemilik(pemilik)

  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [jadwalSlots, setJadwalSlots] = useState<JadwalSlot[]>([])
  const [buktiFile, setBuktiFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [hargaSetting, setHargaSetting] = useState<HargaSetting>(DEFAULT_HARGA_SETTING)

  // Paket Adik Kakak — anak pertama pakai form.nama_murid/form.usia (Step Biodata),
  // anak ke-2 dst diisi di sini (dinamis, 1-4 anak tambahan → total 2-5 anak).
  const [jumlahAnakAdikKakak, setJumlahAnakAdikKakak] = useState(2)
  const [anakTambahan, setAnakTambahan] = useState<{ nama: string; usia: string }[]>([{ nama: '', usia: '' }])

  // Kode referral
  const [showPromoBox, setShowPromoBox] = useState(false)
  const [kodePromoInput, setKodePromoInput] = useState('')
  const [promoValid, setPromoValid] = useState<PromoInfo | null>(null)
  const [promoChecking, setPromoChecking] = useState(false)
  const [promoError, setPromoError] = useState('')

  const [form, setForm] = useState({
    nama_murid: '', usia: '', jenis_kelamin: '', kategori: '',
    paket: '', jumlah_sesi: '4', jadwal_hari: '', jadwal_jam: '', catatan: '',
    nama_ortu: '', wa_ortu: '',
  })

  // Bisa pilih lebih dari 1 jadwal. Jumlah slot yang WAJIB dipilih mengikuti paket:
  // 4x/bulan = 1x seminggu → pilih 1 jadwal. 8x/bulan = 2x seminggu → pilih 2 jadwal.
  const [jadwalPilihan, setJadwalPilihan] = useState<JadwalSlot[]>([])
  const maxJadwal = form.jumlah_sesi === '8' ? 2 : 1

  const toggleJadwal = (s: JadwalSlot) => {
    setJadwalPilihan((prev) => {
      const exists = prev.some((p) => p.hari === s.hari && p.jam_mulai === s.jam_mulai && p.kolam === s.kolam)
      if (exists) return prev.filter((p) => !(p.hari === s.hari && p.jam_mulai === s.jam_mulai && p.kolam === s.kolam))
      if (prev.length >= maxJadwal) {
        showToast(`Paket ${form.jumlah_sesi}x/bulan cuma bisa pilih ${maxJadwal} jadwal`, 'error')
        return prev
      }
      return [...prev, s]
    })
  }

  // Ganti jumlah sesi → potong pilihan jadwal kalau melebihi kuota slot paket baru
  const pilihJumlahSesi = (n: string) => {
    up('jumlah_sesi', n)
    const maxBaru = n === '8' ? 2 : 1
    setJadwalPilihan((prev) => prev.slice(0, maxBaru))
  }

  // Gabungkan pilihan jadwal jadi string "Senin, Rabu" / "16:00, 16:00" buat disimpan ke kolom lama
  const jadwalHariGabungan = jadwalPilihan.map((s) => s.hari).join(', ')
  const jadwalJamGabungan = jadwalPilihan.map((s) => s.jam_mulai).join(', ')
  const jadwalRingkas = jadwalPilihan.map((s) => `${s.hari} ${s.jam_mulai} (${s.kolam})`).join(', ')

  // Ganti jumlah anak adik kakak → resize array input nama/usia anak tambahan
  const ubahJumlahAnak = (n: number) => {
    const jumlah = Math.min(ADIK_KAKAK_MAX, Math.max(ADIK_KAKAK_MIN, n))
    setJumlahAnakAdikKakak(jumlah)
    setAnakTambahan((prev) => {
      const target = jumlah - 1
      if (prev.length === target) return prev
      if (prev.length < target) return [...prev, ...Array(target - prev.length).fill({ nama: '', usia: '' })]
      return prev.slice(0, target)
    })
  }

  const upAnakTambahan = (idx: number, field: 'nama' | 'usia', val: string) => {
    setAnakTambahan((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: val } : a)))
  }

  const up = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    getJadwalSlot().then(setJadwalSlots).catch(() => {})
    adaPromoAktif().then(setShowPromoBox).catch(() => {})
    getHargaSetting().then(setHargaSetting).catch(() => {})
  }, [])

  // Hitung harga berdasarkan pilihan
  const hargaSekarang = form.paket === 'Adik Kakak'
    ? (form.kategori ? hitungHargaAdikKakak(hargaSetting, form.kategori, jumlahAnakAdikKakak, parseInt(form.jumlah_sesi)) : 0)
    : (form.paket && form.kategori ? hitungHarga(hargaSetting, form.paket, form.kategori, parseInt(form.jumlah_sesi)) : 0)

  const diskonAktif = promoValid ? Math.min(promoValid.diskon_nominal, hargaSekarang) : 0
  const totalSetelahDiskon = Math.max(0, hargaSekarang - diskonAktif)

  const cekKodePromo = async () => {
    if (!kodePromoInput.trim()) return
    setPromoChecking(true)
    setPromoError('')
    try {
      const hasil = await validasiPromo(kodePromoInput)
      if (!hasil) {
        setPromoValid(null)
        setPromoError('Kode tidak valid atau sudah habis')
      } else {
        setPromoValid(hasil)
        showToast(`Kode ${hasil.kode} berhasil dipakai ✓`, 'success')
      }
    } catch (e: any) {
      setPromoError('Gagal cek kode: ' + e?.message)
    } finally { setPromoChecking(false) }
  }

  const stepValid = () => {
    if (step === 0) return form.nama_murid.trim() && form.usia && form.jenis_kelamin && form.kategori && form.nama_ortu.trim() && form.wa_ortu.trim()
    if (step === 1) {
      if (!form.paket || !form.jumlah_sesi || jadwalPilihan.length !== maxJadwal) return false
      if (form.paket === 'Adik Kakak') {
        return anakTambahan.every((a) => a.nama.trim() && a.usia)
      }
      return true
    }
    return true
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { showToast('Max 5MB', 'error'); return }
    setBuktiFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const submit = async () => {
    setSaving(true)
    try {
      let bukti_tf_url: string | null = null
      if (buktiFile) {
        const ext = buktiFile.name.split('.').pop()
        const path = `pendaftaran/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('bukti-tf').upload(path, buktiFile)
        if (upErr) throw upErr
        const { data } = supabase.storage.from('bukti-tf').getPublicUrl(path)
        bukti_tf_url = data.publicUrl
      }
      const isAdikKakak = form.paket === 'Adik Kakak'
      const anakList = isAdikKakak
        ? [{ nama: form.nama_murid, usia: parseInt(form.usia) }, ...anakTambahan.map((a) => ({ nama: a.nama, usia: parseInt(a.usia) }))]
        : null

      // PENTING: paket Adik Kakak SELALU 1 row registration (1 group), walaupun isinya
      // beberapa anak. Jangan insert satu row per anak — itu yang bikin Halaman Daftar
      // tampil ganda & ACC dua kali jadi murid duplicate. Pemisahan jadi beberapa Student
      // baru terjadi nanti saat ACC (lihat dashboard/daftar → handleAcc).
      const namaGabungan = isAdikKakak && anakList ? anakList.map((a) => a.nama).join(' & ') : form.nama_murid

      const { error } = await supabase.from('pending_members').insert({
        nama_murid: namaGabungan,
        usia: parseInt(form.usia),
        nama_ortu: form.nama_ortu,
        wa_ortu: form.wa_ortu,
        paket: form.paket + (form.kategori === 'abk' ? ' +ABK' : '') + ' ' + form.jumlah_sesi + 'x' + (isAdikKakak ? ` (${jumlahAnakAdikKakak} anak)` : ''),
        jadwal_hari: jadwalHariGabungan,
        jadwal_jam: jadwalJamGabungan,
        jadwal_kolam: jadwalPilihan.map((s) => s.kolam).join(', '),
        bukti_tf_url,
        catatan: `JK: ${form.jenis_kelamin} | Kategori: ${form.kategori} | Sesi: ${form.jumlah_sesi}x | Jadwal: ${jadwalRingkas} | Harga: ${fmtRupiah(hargaSekarang)}${promoValid ? ` | Promo: ${promoValid.kode} (-${fmtRupiah(diskonAktif)})` : ''}${form.catatan ? ' | ' + form.catatan : ''}`,
        jumlah_sesi: parseInt(form.jumlah_sesi),
        harga: totalSetelahDiskon, // total keluarga — pembagian per anak dilakukan saat ACC
        kode_promo: promoValid?.kode ?? null,
        diskon: diskonAktif,
        anak_list: anakList,
        jumlah_anak: isAdikKakak ? jumlahAnakAdikKakak : 1,
        status: 'menunggu',
        pemilik,
      })
      if (error) throw error

      // Tandai kode promo sudah kepakai (kuota abis → otomatis nonaktif)
      if (promoValid) {
        try { await pakaiPromo(promoValid.id, promoValid.terpakai, promoValid.kuota) } catch {}
      }

      setDone(true)
    } catch (e: any) {
      showToast(e?.message || 'Gagal mendaftar', 'error')
    } finally { setSaving(false) }
  }

  // ── Halaman sukses ──────────────────────────────────────────
  if (done) return (
    <div className="min-h-screen bg-[#E6F4FB] flex items-center justify-center p-4 relative overflow-hidden">
      {ILUSTRASI.slice(0,3).map((il, i) => (
        <img key={i} src={il.src} alt="" className="absolute pointer-events-none select-none"
          style={{ ...il.style as any, position: 'fixed' }} />
      ))}
      <div className="relative z-10 bg-white rounded-2xl p-8 text-center max-w-md w-full shadow-md">
        <div className="text-5xl mb-3">🎉</div>
        <div className="text-[20px] font-bold text-gray-800 mb-2">Pendaftaran Berhasil!</div>
        <div className="text-[14px] text-gray-500 mb-4">
          Halo <strong>{form.nama_ortu}</strong>!<br/>
          Pendaftaran <strong>{form.paket === 'Adik Kakak' ? [form.nama_murid, ...anakTambahan.map(a=>a.nama)].filter(Boolean).join(', ') : form.nama_murid}</strong> sudah kami terima dengan baik.
        </div>
        <div className="bg-[#E6F4FB] rounded-xl p-4 text-left text-[13px] text-gray-600 mb-4 space-y-1">
          <div className="font-semibold text-[#185FA5] mb-1.5">Ringkasan Pendaftaran</div>
          <div>Kelas: <strong>{form.paket} ({form.jumlah_sesi}x/bulan)</strong></div>
          <div>Jadwal: <strong>{jadwalPilihan.map((s) => `${s.hari} ${s.jam_mulai}`).join(', ')}</strong></div>
          <div>Kategori: <strong>{form.kategori === 'abk' ? '⭐ ABK' : '🏊 Anak Normal'}</strong></div>
        </div>
        {/* Peraturan Sesi Privat — muncul setelah pendaftaran+bukti TF terkirim */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-left mb-4">
          <div className="text-[12px] font-bold text-gray-700 mb-2 flex items-center gap-1.5">
            <i className="ti ti-file-text text-sm" />Peraturan Sesi Privat
          </div>
          <ol className="text-[11px] text-gray-500 leading-relaxed list-decimal list-inside space-y-1">
            {PERATURAN_SESI.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
        </div>
        <div className="text-[12px] text-gray-400 leading-relaxed">
          Admin akan menghubungi melalui WhatsApp untuk konfirmasi.<br/>
          Kita siap bantu si kecil belajar renang dengan penuh semangat! 💦
        </div>
      </div>
      <ToastProvider />
    </div>
  )

  // ── Main form ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#E6F4FB] relative overflow-x-hidden">

      {/* Background ilustrasi — posisi fixed agar tetap saat scroll */}
      {ILUSTRASI.map((il, i) => (
        <img key={i} src={il.src} alt="" className="fixed pointer-events-none select-none"
          style={{ ...il.style as any }} />
      ))}

      {/* Header — sama ukuran dengan kartu kehadiran */}
      <div className="relative bg-[#185FA5] overflow-hidden" style={{height:90}}>
        {/* Gelombang */}
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 30" preserveAspectRatio="none" style={{height:22}}>
          <path fill="rgba(255,255,255,0.15)" d="M0,15 C60,25 120,5 180,15 C240,25 300,5 400,15 L400,30 L0,30 Z">
            <animate attributeName="d" dur="4s" repeatCount="indefinite"
              values="M0,15 C60,25 120,5 180,15 C240,25 300,5 400,15 L400,30 L0,30 Z;
                      M0,10 C70,22 130,3 200,13 C270,23 340,5 400,10 L400,30 L0,30 Z;
                      M0,15 C60,25 120,5 180,15 C240,25 300,5 400,15 L400,30 L0,30 Z"/>
          </path>
        </svg>
        {/* Logo + stepper dalam satu baris */}
        <div className="absolute inset-0 flex items-center px-5 gap-4">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img src="/logo-app.png" alt="Logo" className="w-8 h-8 rounded-lg flex-shrink-0 object-cover" />
            <div>
              <div className="text-white text-[13px] font-bold leading-tight">Privat Renang Ilham</div>
              <div className="text-white/60 text-[10px]">Pendaftaran Les Renang</div>
            </div>
          </div>
          {/* Stepper compact horizontal */}
          <div className="flex items-center flex-1 ml-2">
            {STEP_LABELS.map((l, i) => (
              <div key={l} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i <= step ? 'bg-white text-[#185FA5]' : 'bg-white/20 text-white/50'}`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <div className={`text-[8px] mt-0.5 whitespace-nowrap ${i <= step ? 'text-white' : 'text-white/40'}`}>{l}</div>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`flex-1 h-px mx-1 mb-3.5 ${i < step ? 'bg-white' : 'bg-white/20'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form card */}
      <div className="relative z-10 max-w-[500px] mx-auto px-4 py-5">
        <div className="bg-white rounded-2xl shadow-sm p-5">

          {/* STEP 0: Biodata */}
          {step === 0 && (
            <div className="flex flex-col gap-3.5">
              <div className="text-[14px] font-bold text-gray-800 flex items-center gap-2 pb-1 border-b border-gray-100">
                📝 Biodata Peserta
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Nama Lengkap</label>
                <input type="text" placeholder="Nama lengkap anak" value={form.nama_murid}
                  onChange={(e) => up('nama_murid', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] text-gray-800 focus:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5]/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Usia (tahun)</label>
                  <input type="number" placeholder="Contoh: 7" value={form.usia}
                    onChange={(e) => up('usia', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] text-gray-800 focus:outline-none focus:border-[#185FA5]" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Jenis Kelamin</label>
                  <div className="flex gap-1.5 mt-1">
                    {[{v:'Laki-laki',e:'👦',s:'L'},{v:'Perempuan',e:'👧',s:'P'}].map((jk) => (
                      <button key={jk.v} onClick={() => up('jenis_kelamin', jk.v)}
                        className={`flex-1 py-2 rounded-xl border text-[12px] font-semibold transition-all ${form.jenis_kelamin === jk.v ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-gray-200 text-gray-500'}`}>
                        {jk.e} {jk.s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Kategori</label>
                <div className="flex flex-col gap-2">
                  <button onClick={() => up('kategori', 'normal')}
                    className={`text-left px-3.5 py-3 rounded-xl border-2 transition-all ${form.kategori === 'normal' ? 'border-[#185FA5] bg-[#E6F4FB]' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🏊</span>
                      <div>
                        <div className="text-[13px] font-semibold text-gray-800">Anak Normal</div>
                        <div className="text-[11px] text-gray-400">Program renang reguler</div>
                      </div>
                      {form.kategori === 'normal' && <i className="ti ti-check text-[#185FA5] ml-auto" />}
                    </div>
                  </button>
                  <button onClick={() => up('kategori', 'abk')}
                    className={`text-left px-3.5 py-3 rounded-xl border-2 transition-all ${form.kategori === 'abk' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">⭐</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-[13px] font-semibold text-gray-800">Anak ABK</div>
                        </div>
                        <div className="text-[11px] text-gray-400">Autisme, ADHD, speech delay, dsb</div>
                      </div>
                      {form.kategori === 'abk' && <i className="ti ti-check text-yellow-500" />}
                    </div>
                  </button>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <div className="text-[14px] font-bold text-gray-800 mb-3">Data Orang Tua / Wali</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Nama Lengkap</label>
                    <input type="text" placeholder="Nama orang tua/wali" value={form.nama_ortu}
                      onChange={(e) => up('nama_ortu', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] text-gray-800 focus:outline-none focus:border-[#185FA5]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">No. WhatsApp</label>
                    <input type="tel" placeholder="08xxxxxxxxxx" value={form.wa_ortu}
                      onChange={(e) => up('wa_ortu', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] text-gray-800 focus:outline-none focus:border-[#185FA5]" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Kelas & Jadwal */}
          {step === 1 && (
            <div className="flex flex-col gap-3.5">
              <div className="text-[14px] font-bold text-gray-800 flex items-center gap-2 pb-1 border-b border-gray-100">
                🏫 Pilihan Kelas & Jadwal
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Pilihan Kelas</label>
                <div className="flex flex-col gap-2">
                  {KELAS_LIST.map((k) => (
                    <button key={k.id} onClick={() => up('paket', k.label)}
                      className={`text-left px-3.5 py-3 rounded-xl border-2 transition-all ${form.paket === k.label ? 'border-[#185FA5] bg-[#E6F4FB]' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold text-gray-800">{k.label}</div>
                          <div className="text-[11px] text-gray-400">{k.desc}</div>
                        </div>
                        {form.paket === k.label && <i className="ti ti-check text-[#185FA5]" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Jumlah sesi */}
              {form.paket && (
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Jumlah Sesi per Bulan</label>
                  <div className="flex gap-2">
                    {['4', '8'].map((n) => (
                      <button key={n} onClick={() => pilihJumlahSesi(n)}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-[13px] font-medium transition-all ${form.jumlah_sesi === n ? 'border-[#185FA5] bg-[#E6F4FB] text-[#185FA5]' : 'border-gray-100 bg-gray-50 text-gray-600'}`}>
                        <div className="font-bold">{n}x / bulan</div>
                        <div className="text-[10px] opacity-60">{n === '8' ? '2x seminggu · pilih 2 jadwal' : '1x seminggu · pilih 1 jadwal'}</div>
                        {form.kategori && form.paket && (
                          <div className="text-[11px] mt-0.5 opacity-70">
                            {form.paket === 'Adik Kakak'
                              ? fmtRupiah(hitungHargaAdikKakak(hargaSetting, form.kategori, jumlahAnakAdikKakak, parseInt(n)))
                              : fmtRupiah(hitungHarga(hargaSetting, form.paket, form.kategori, parseInt(n)))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Adik Kakak: jumlah anak + input nama & usia anak ke-2 dst */}
              {form.paket === 'Adik Kakak' && (
                <div className="bg-[#FFF8E8] border border-yellow-200 rounded-xl p-3.5">
                  <div className="text-[13px] font-bold text-gray-800 mb-1">👨‍👩‍👧‍👦 Jumlah Anak</div>
                  <div className="text-[11px] text-gray-500 mb-2.5">Min {ADIK_KAKAK_MIN}, maks {ADIK_KAKAK_MAX} anak. Dapat potongan Rp{POTONGAN_ADIK_KAKAK.toLocaleString('id-ID')}/anak.</div>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => ubahJumlahAnak(jumlahAnakAdikKakak - 1)} disabled={jumlahAnakAdikKakak <= ADIK_KAKAK_MIN}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30">
                      <i className="ti ti-minus text-sm" />
                    </button>
                    <div className="flex-1 text-center text-[15px] font-bold text-gray-800">{jumlahAnakAdikKakak} anak</div>
                    <button onClick={() => ubahJumlahAnak(jumlahAnakAdikKakak + 1)} disabled={jumlahAnakAdikKakak >= ADIK_KAKAK_MAX}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30">
                      <i className="ti ti-plus text-sm" />
                    </button>
                  </div>

                  <div className="text-[11px] font-semibold text-gray-500 mb-1.5">
                    Anak 1: <span className="text-gray-700">{form.nama_murid || '(diisi di Step Biodata)'}</span>, {form.usia || '?'} tahun
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {anakTambahan.map((a, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2">
                        <input placeholder={`Nama anak ${i + 2}`} value={a.nama}
                          onChange={(e) => upAnakTambahan(i, 'nama', e.target.value)}
                          className="col-span-2 border border-gray-200 rounded-lg px-2.5 py-2 text-[12.5px] text-gray-800 focus:outline-none focus:border-[#185FA5]" />
                        <input placeholder="Usia" type="number" value={a.usia}
                          onChange={(e) => upAnakTambahan(i, 'usia', e.target.value)}
                          className="border border-gray-200 rounded-lg px-2.5 py-2 text-[12.5px] text-gray-800 focus:outline-none focus:border-[#185FA5]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">
                  Hari & Jam yang Diinginkan
                </label>
                <div className="text-[11px] -mt-1 mb-2">
                  <span className={jadwalPilihan.length === maxJadwal ? 'text-[#185FA5] font-semibold' : 'text-gray-400'}>
                    {maxJadwal === 2
                      ? `Paket 8x/bulan = 2x seminggu, pilih tepat 2 jadwal (${jadwalPilihan.length}/2 dipilih)`
                      : `Pilih 1 jadwal (${jadwalPilihan.length}/1 dipilih)`}
                  </span>
                </div>
                {/* Group by kolam */}
                {(() => {
                  const grouped = jadwalSlots.reduce<Record<string, JadwalSlot[]>>((acc, s) => {
                    acc[s.kolam] = acc[s.kolam] ? [...acc[s.kolam], s] : [s]
                    return acc
                  }, {})
                  return Object.entries(grouped).map(([kolam, slots]) => (
                    <div key={kolam} className="mb-3">
                      <div className="text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#185FA5]" />{kolam}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {slots.map(s => {
                          const isSelected = jadwalPilihan.some((p) => p.hari === s.hari && p.jam_mulai === s.jam_mulai && p.kolam === s.kolam)
                          const isPenuh = s.status === 'penuh'
                          return (
                            <button key={`${s.hari}-${s.jam_mulai}-${s.kolam}`}
                              disabled={isPenuh}
                              onClick={() => {
                                if (isPenuh) return
                                toggleJadwal(s)
                              }}
                              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 text-left transition-all ${
                                isPenuh
                                  ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                  : isSelected
                                    ? 'border-[#185FA5] bg-[#E6F4FB]'
                                    : 'border-gray-100 bg-gray-50 hover:border-[#185FA5]/40'
                              }`}>
                              <div>
                                <div className="text-[12px] font-semibold text-gray-800">{s.hari}</div>
                                <div className="text-[11px] text-gray-400">{s.jam_mulai} – {s.jam_selesai}</div>
                              </div>
                              {isPenuh ? (
                                <span className="text-[10px] font-bold text-red-400 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                                  Kelas Penuh
                                </span>
                              ) : isSelected ? (
                                <div className="flex items-center gap-1.5">
                                  {s.kuota !== null && (
                                    <span className="text-[10px] text-gray-400">Sisa {s.kuota}</span>
                                  )}
                                  <i className="ti ti-check text-[#185FA5] text-base" />
                                </div>
                              ) : (
                                <div className="text-right">
                                  <span className="text-[10px] text-green-500 font-semibold block">Tersedia</span>
                                  {s.kuota !== null && (
                                    <span className="text-[9px] text-gray-400">Sisa {s.kuota} anak</span>
                                  )}
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))
                })()}
                {jadwalSlots.length === 0 && (
                  <div className="text-center py-4 text-gray-400 text-[12px]">
                    Jadwal belum tersedia. Hubungi admin.
                  </div>
                )}
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Catatan (opsional)</label>
                <textarea placeholder="Kondisi khusus, alergi, pertanyaan..." value={form.catatan}
                  onChange={(e) => up('catatan', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] text-gray-800 resize-none focus:outline-none focus:border-[#185FA5]" rows={2} />
              </div>
            </div>
          )}

          {/* STEP 2: Pembayaran */}
          {step === 2 && (
            <div className="flex flex-col gap-3.5">
              <div className="text-[14px] font-bold text-gray-800 flex items-center gap-2 pb-1 border-b border-gray-100">
                💳 Pembayaran
              </div>
              {/* Kode Referral — cuma muncul kalau ada kode promo aktif */}
              {showPromoBox && (
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                    Kode Referral <span className="normal-case text-gray-300">(opsional)</span>
                  </label>
                  {promoValid ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <i className="ti ti-circle-check text-green-500 text-base" />
                        <div>
                          <div className="text-[12px] font-bold text-green-700">{promoValid.kode}</div>
                          <div className="text-[11px] text-green-600">Potongan {fmtRupiah(diskonAktif)}</div>
                        </div>
                      </div>
                      <button onClick={() => { setPromoValid(null); setKodePromoInput(''); setPromoError('') }}
                        className="text-[11px] text-gray-400 font-medium">× Hapus</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          value={kodePromoInput}
                          onChange={(e) => { setKodePromoInput(e.target.value.toUpperCase()); setPromoError('') }}
                          placeholder="Contoh: IBU2026"
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] font-mono font-semibold tracking-wide text-gray-800 focus:outline-none focus:border-[#185FA5]"
                        />
                        <button onClick={cekKodePromo} disabled={promoChecking || !kodePromoInput.trim()}
                          className="px-4 rounded-xl bg-[#185FA5] text-white text-[12px] font-semibold disabled:opacity-40">
                          {promoChecking ? <i className="ti ti-loader-2 animate-spin text-base" /> : 'Pakai'}
                        </button>
                      </div>
                      {promoError && <div className="text-[11px] text-red-400 mt-1">{promoError}</div>}
                    </>
                  )}
                </div>
              )}
              {/* Ringkasan */}
              <div className="bg-[#E6F4FB] rounded-xl p-3.5">
                <div className="text-[11px] font-semibold text-[#185FA5] uppercase tracking-wide mb-2">Ringkasan</div>
                <div className="space-y-1 text-[12px]">
                  {[
                    ['Nama', form.paket === 'Adik Kakak'
                      ? [form.nama_murid, ...anakTambahan.map((a) => a.nama)].filter(Boolean).join(', ')
                      : form.nama_murid],
                    ['Kelas', form.paket === 'Adik Kakak' ? `Adik Kakak (${jumlahAnakAdikKakak} anak)` : form.paket],
                    ['Sesi', form.jumlah_sesi + 'x/bulan'],
                    ['Kategori', form.kategori === 'abk' ? '⭐ ABK' : '🏊 Anak Normal'],
                    ['Jadwal', jadwalPilihan.map((s) => `${s.hari} ${s.jam_mulai}`).join(', ')],
                    ...(promoValid ? [
                      ['Subtotal', hargaSekarang > 0 ? fmtRupiah(hargaSekarang) : '-'],
                      ['Diskon', `- ${fmtRupiah(diskonAktif)}`],
                    ] : []),
                    ['Total Biaya', totalSetelahDiskon > 0 ? fmtRupiah(totalSetelahDiskon) : (hargaSekarang > 0 ? fmtRupiah(hargaSekarang) : '-')],
                  ].map(([k,v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-400">{k}</span>
                      <strong className={`text-right max-w-[200px] ${k === 'Total Biaya' ? 'text-[#185FA5]' : k === 'Diskon' ? 'text-green-600' : 'text-gray-800'}`}>{v}</strong>
                    </div>
                  ))}
                </div>
              </div>
              {/* Rekening */}
              <div>
                <div className="text-[12px] font-semibold text-gray-700 mb-2">Silakan transfer ke:</div>
                <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm space-y-2">
                  {[['Nama Rekening', REKENING.nama],['Bank', REKENING.bank]].map(([k,v]) => (
                    <div key={k} className="flex justify-between text-[12px]">
                      <span className="text-gray-400">{k}</span>
                      <strong className="text-gray-800">{v}</strong>
                    </div>
                  ))}
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-gray-400">No. Rekening</span>
                    <div className="flex items-center gap-2">
                      <strong className="font-mono text-[14px] text-gray-800">{REKENING.nomor}</strong>
                      <button onClick={() => { navigator.clipboard.writeText(REKENING.nomor); showToast('Disalin ✓','success') }}
                        className="text-[11px] bg-[#E6F4FB] text-[#185FA5] px-2 py-0.5 rounded-lg font-medium">Salin</button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Upload */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                  Upload Bukti Transfer <span className="normal-case text-gray-300">(opsional)</span>
                </label>
                <label className={`block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${preview ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-[#185FA5]'}`}>
                  <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="preview" className="max-h-36 mx-auto rounded-lg object-contain" />
                  ) : (
                    <>
                      <i className="ti ti-upload text-xl text-gray-300 block mb-1" />
                      <div className="text-[12px] text-gray-400">Tap untuk pilih foto</div>
                    </>
                  )}
                </label>
                {preview && <button onClick={() => {setBuktiFile(null);setPreview(null)}} className="text-[11px] text-red-400 mt-1">× Hapus</button>}
              </div>
              {/* Penutup */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center text-[12px] text-gray-500 leading-relaxed">
                Setelah transfer, mohon kirim bukti pembayaran ya 🙏<br/>
                <span className="text-[#185FA5] font-semibold">Terima kasih!</span> Kita siap bantu si kecil belajar renang dengan pendekatan yang aman, nyaman, dan menyenangkan 💦
              </div>
            </div>
          )}

          {/* Navigasi */}
          <div className="flex gap-2 mt-5">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)}
                className="flex-1 border border-gray-200 text-gray-600 text-[13px] font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all">
                ← Kembali
              </button>
            )}
            {step < 2 ? (
              <button onClick={() => stepValid() ? setStep(step + 1) : showToast('Lengkapi semua field yang wajib diisi')}
                className={`flex-1 text-white text-[13px] font-semibold py-3 rounded-xl transition-all ${stepValid() ? 'bg-[#185FA5] hover:bg-[#0C447C]' : 'bg-[#185FA5]/40'}`}>
                Lanjut →
              </button>
            ) : (
              <button onClick={submit} disabled={saving}
                className="flex-1 bg-[#185FA5] text-white text-[13px] font-semibold py-3 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-all">
                {saving ? 'Mengirim...' : '✓ Kirim Pendaftaran'}
              </button>
            )}
          </div>
        </div>
      </div>
      <ToastProvider />
    </div>
  )
}