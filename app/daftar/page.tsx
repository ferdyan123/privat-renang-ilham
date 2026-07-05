'use client'
import { useState, useEffect } from 'react'
import { supabase, getJadwalSlot, JadwalSlot } from '@/lib/supabase'
import { HARGA_BASE, hitungHarga, fmtRupiah } from '@/lib/utils'
import { ToastProvider, showToast } from '@/components/ui/Toast'

const REKENING = {
  nama: 'Muhammad Nurilham Aulia Rahman',
  bank: 'Sea Bank',
  nomor: '901452432623',
}

const KELAS_LIST = [
  { id: 'semi_privat', label: 'Semi Privat', desc: 'Belajar bersama 2-3 anak seusia' },
  { id: 'eksklusif', label: 'Eksklusif', desc: 'Sesi khusus 1-on-1 dengan instruktur' },
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
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [jadwalSlots, setJadwalSlots] = useState<JadwalSlot[]>([])
  const [buktiFile, setBuktiFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    nama_murid: '', usia: '', jenis_kelamin: '', kategori: '',
    paket: '', jumlah_sesi: '4', jadwal_hari: '', jadwal_jam: '', catatan: '',
    nama_ortu: '', wa_ortu: '',
  })

  const up = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    getJadwalSlot().then(setJadwalSlots).catch(() => {})
  }, [])

  // Hitung harga berdasarkan pilihan
  const hargaSekarang = form.paket && form.kategori
    ? hitungHarga(form.paket, form.kategori, parseInt(form.jumlah_sesi))
    : 0

  const stepValid = () => {
    if (step === 0) return form.nama_murid.trim() && form.usia && form.jenis_kelamin && form.kategori && form.nama_ortu.trim() && form.wa_ortu.trim()
    if (step === 1) return form.paket && form.jumlah_sesi && form.jadwal_hari && form.jadwal_jam
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
      const { error } = await supabase.from('pending_members').insert({
        nama_murid: form.nama_murid,
        usia: parseInt(form.usia),
        nama_ortu: form.nama_ortu,
        wa_ortu: form.wa_ortu,
        paket: form.paket + (form.kategori === 'abk' ? ' +ABK' : '') + ' ' + form.jumlah_sesi + 'x',
        jadwal_hari: form.jadwal_hari,
        jadwal_jam: form.jadwal_jam,
        bukti_tf_url,
        catatan: `JK: ${form.jenis_kelamin} | Kategori: ${form.kategori} | Sesi: ${form.jumlah_sesi}x | Harga: ${fmtRupiah(hargaSekarang)}${form.catatan ? ' | ' + form.catatan : ''}`,
        jumlah_sesi: parseInt(form.jumlah_sesi),
        harga: hargaSekarang,
        status: 'menunggu',
      })
      if (error) throw error
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
      <div className="relative z-10 bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-md">
        <div className="text-5xl mb-3">🎉</div>
        <div className="text-[20px] font-bold text-gray-800 mb-2">Pendaftaran Berhasil!</div>
        <div className="text-[14px] text-gray-500 mb-4">
          Halo <strong>{form.nama_ortu}</strong>!<br/>
          Pendaftaran <strong>{form.nama_murid}</strong> sudah kami terima dengan baik.
        </div>
        <div className="bg-[#E6F4FB] rounded-xl p-4 text-left text-[13px] text-gray-600 mb-4 space-y-1">
          <div className="font-semibold text-[#185FA5] mb-1.5">Ringkasan Pendaftaran</div>
          <div>Kelas: <strong>{form.paket} ({form.jumlah_sesi}x/bulan)</strong></div>
          <div>Jadwal: <strong>{form.jadwal_hari} · {form.jadwal_jam}</strong></div>
          <div>Kategori: <strong>{form.kategori === 'abk' ? '⭐ ABK' : '🏊 Anak Normal'}</strong></div>
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
                          <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">+Rp 50.000</span>
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
                      <button key={n} onClick={() => up('jumlah_sesi', n)}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-[13px] font-medium transition-all ${form.jumlah_sesi === n ? 'border-[#185FA5] bg-[#E6F4FB] text-[#185FA5]' : 'border-gray-100 bg-gray-50 text-gray-600'}`}>
                        <div className="font-bold">{n}x / bulan</div>
                        {form.kategori && form.paket && (
                          <div className="text-[11px] mt-0.5 opacity-70">
                            {fmtRupiah(hitungHarga(form.paket, form.kategori, parseInt(n)))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">
                  Hari & Jam yang Diinginkan
                </label>
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
                          const isSelected = form.jadwal_hari === s.hari && form.jadwal_jam === s.jam_mulai && form.catatan?.includes(s.kolam)
                          const isPenuh = s.status === 'penuh'
                          return (
                            <button key={`${s.hari}-${s.jam_mulai}-${s.kolam}`}
                              disabled={isPenuh}
                              onClick={() => {
                                if (isPenuh) return
                                up('jadwal_hari', s.hari)
                                up('jadwal_jam', s.jam_mulai)
                                // Simpan kolam di catatan sementara
                                setForm(f => ({ ...f, jadwal_hari: s.hari, jadwal_jam: s.jam_mulai, catatan: (f.catatan || '').replace(/Kolam:[^|]*/,'') + `Kolam: ${s.kolam} ` }))
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
                                <i className="ti ti-check text-[#185FA5] text-base" />
                              ) : (
                                <span className="text-[10px] text-green-500 font-semibold">Tersedia</span>
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
              {/* Ringkasan */}
              <div className="bg-[#E6F4FB] rounded-xl p-3.5">
                <div className="text-[11px] font-semibold text-[#185FA5] uppercase tracking-wide mb-2">Ringkasan</div>
                <div className="space-y-1 text-[12px]">
                  {[
                    ['Nama', form.nama_murid],
                    ['Kelas', form.paket],
                    ['Sesi', form.jumlah_sesi + 'x/bulan'],
                    ['Kategori', form.kategori === 'abk' ? '⭐ ABK' : '🏊 Anak Normal'],
                    ['Jadwal', `${form.jadwal_hari} · ${form.jadwal_jam}`],
                    ['Total Biaya', hargaSekarang > 0 ? fmtRupiah(hargaSekarang) : '-'],
                  ].map(([k,v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-400">{k}</span>
                      <strong className="text-gray-800 text-right max-w-[200px]">{v}</strong>
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