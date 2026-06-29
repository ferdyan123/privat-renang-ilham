'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PAKET_LIST, PAKET_HARGA } from '@/lib/utils'
import { ToastProvider, showToast } from '@/components/ui/Toast'

const JADWAL_HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const JADWAL_JAM  = ['07:00', '08:00', '09:00', '10:00', '15:00', '16:00']
const NOREK = { bank: 'BCA', nomor: '1234567890', atas_nama: 'SwimTrack Les Renang' }
const STEP_LABELS = ['Data Murid', 'Paket & Jadwal', 'Pembayaran']

export default function DaftarPublikPage() {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    nama_murid: '', usia: '', nama_ortu: '', wa_ortu: '',
    paket: PAKET_LIST[0], jadwal_hari: '', jadwal_jam: '', catatan: '',
  })
  const [buktiFile, setBuktiFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const up = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const stepValid = () => {
    if (step === 0) return form.nama_murid.trim() && form.usia && form.nama_ortu.trim() && form.wa_ortu.trim()
    if (step === 1) return form.jadwal_hari && form.jadwal_jam
    return true
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { showToast('Ukuran file max 5MB', 'error'); return }
    setBuktiFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const submit = async () => {
    setSaving(true)
    try {
      let bukti_tf_url: string | null = null

      if (buktiFile) {
        const ext = buktiFile.name.split('.').pop()
        const path = `bukti/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('bukti-tf').upload(path, buktiFile)
        if (upErr) throw upErr
        const { data } = supabase.storage.from('bukti-tf').getPublicUrl(path)
        bukti_tf_url = data.publicUrl
      }

      const { error } = await supabase.from('pending_members').insert({
        ...form,
        usia: parseInt(form.usia),
        bukti_tf_url,
        status: 'menunggu',
      })
      if (error) throw error
      setDone(true)
    } catch (e: any) {
      showToast(e?.message || 'Gagal mendaftar', 'error')
    } finally { setSaving(false) }
  }

  if (done) return (
    <div className="min-h-screen bg-bg-2 flex items-center justify-center p-4">
      <div className="bg-bg rounded-xl p-8 text-center max-w-sm w-full shadow-sm border border-border">
        <div className="w-16 h-16 bg-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ti ti-check text-4xl text-green" />
        </div>
        <div className="text-[18px] font-bold text-text mb-2">Pendaftaran Terkirim!</div>
        <div className="text-[14px] text-text-muted mb-1">Halo, <strong>{form.nama_ortu}</strong></div>
        <div className="text-[13px] text-text-muted">
          Pendaftaran <strong>{form.nama_murid}</strong> sudah kami terima. Admin akan menghubungi Anda melalui WhatsApp untuk konfirmasi.
        </div>
        <div className="mt-6 bg-bg-2 rounded-md p-3 text-left text-[12px] text-text-muted">
          <div className="font-semibold text-text mb-1">Ringkasan</div>
          <div>Paket: {form.paket}</div>
          <div>Jadwal: {form.jadwal_hari} · {form.jadwal_jam}</div>
        </div>
      </div>
      <ToastProvider />
    </div>
  )

  return (
    <div className="min-h-screen bg-bg-2">
      {/* Header */}
      <div className="bg-[#185FA5] px-5 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
            <i className="ti ti-ripple text-white text-xl" />
          </div>
          <div>
            <div className="text-white text-[15px] font-semibold">SwimTrack</div>
            <div className="text-white/70 text-[12px]">Pendaftaran Les Renang</div>
          </div>
        </div>
        {/* Stepper */}
        <div className="flex items-center gap-0">
          {STEP_LABELS.map((l, i) => (
            <div key={l} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${i <= step ? 'bg-white text-blue' : 'bg-white/20 text-white/60'}`}>
                  {i < step ? <i className="ti ti-check text-sm" /> : i + 1}
                </div>
                <div className={`text-[10px] mt-1 whitespace-nowrap ${i <= step ? 'text-white' : 'text-white/50'}`}>{l}</div>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 mx-1 transition-all ${i < step ? 'bg-white' : 'bg-white/20'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[500px] mx-auto px-4 py-5">

        {/* STEP 0: Data Murid */}
        {step === 0 && (
          <div className="flex flex-col gap-3">
            <div className="text-[15px] font-semibold text-text mb-1">Data Murid</div>
            {[
              { label: 'Nama lengkap murid', key: 'nama_murid', type: 'text', placeholder: 'Nama anak' },
              { label: 'Usia (tahun)', key: 'usia', type: 'number', placeholder: 'Contoh: 8' },
              { label: 'Nama orang tua / wali', key: 'nama_ortu', type: 'text', placeholder: 'Nama lengkap' },
              { label: 'No. WhatsApp orang tua', key: 'wa_ortu', type: 'tel', placeholder: '08xxxxxxxxxx' },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-[12px] text-text-muted block mb-1">{f.label}</label>
                <input type={f.type} placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => up(f.key, e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2.5 text-sm bg-bg text-text" />
              </div>
            ))}
          </div>
        )}

        {/* STEP 1: Paket & Jadwal */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="text-[15px] font-semibold text-text mb-1">Pilih Paket & Jadwal</div>
            <div>
              <label className="text-[12px] text-text-muted block mb-2">Paket</label>
              <div className="flex flex-col gap-2">
                {PAKET_LIST.map((p) => (
                  <button key={p} onClick={() => up('paket', p)}
                    className={`text-left px-4 py-3 rounded-lg border transition-all ${form.paket === p ? 'border-blue bg-blue-light' : 'border-border bg-bg'}`}>
                    <div className="text-[13px] font-semibold text-text">{p}</div>
                    <div className="text-[12px] text-text-muted">
                      Rp {(PAKET_HARGA[p] ?? 0).toLocaleString('id-ID')}/bulan
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[12px] text-text-muted block mb-2">Hari latihan</label>
              <div className="grid grid-cols-3 gap-2">
                {JADWAL_HARI.map((h) => (
                  <button key={h} onClick={() => up('jadwal_hari', h)}
                    className={`py-2 rounded-md border text-[13px] font-medium transition-all ${form.jadwal_hari === h ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[12px] text-text-muted block mb-2">Jam</label>
              <div className="grid grid-cols-3 gap-2">
                {JADWAL_JAM.map((j) => (
                  <button key={j} onClick={() => up('jadwal_jam', j)}
                    className={`py-2 rounded-md border text-[13px] font-medium transition-all ${form.jadwal_jam === j ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                    {j}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[12px] text-text-muted block mb-1">Catatan (opsional)</label>
              <textarea placeholder="Kondisi khusus, alergi, dll." value={form.catatan}
                onChange={(e) => up('catatan', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2.5 text-sm bg-bg text-text resize-none" rows={3} />
            </div>
          </div>
        )}

        {/* STEP 2: Pembayaran */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="text-[15px] font-semibold text-text mb-1">Pembayaran</div>

            {/* Ringkasan */}
            <div className="bg-blue-light border border-blue/20 rounded-lg p-4">
              <div className="text-[13px] font-semibold text-blue mb-2">Ringkasan Pendaftaran</div>
              <div className="flex flex-col gap-1 text-[13px]">
                <div className="flex justify-between"><span className="text-text-muted">Murid</span><span className="font-medium text-text">{form.nama_murid}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Paket</span><span className="font-medium text-text">{form.paket}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Jadwal</span><span className="font-medium text-text">{form.jadwal_hari} · {form.jadwal_jam}</span></div>
                <div className="flex justify-between border-t border-blue/20 mt-1 pt-1">
                  <span className="font-semibold text-text">Total</span>
                  <span className="font-bold text-blue">Rp {(PAKET_HARGA[form.paket] ?? 0).toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* Nomor rekening */}
            <div className="bg-bg border border-border rounded-lg p-4">
              <div className="text-[13px] font-semibold text-text mb-3">Transfer ke rekening</div>
              <div className="flex flex-col gap-1.5 text-[13px]">
                <div className="flex justify-between"><span className="text-text-muted">Bank</span><span className="font-semibold text-text">{NOREK.bank}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Nomor rekening</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text tracking-wider">{NOREK.nomor}</span>
                    <button onClick={() => { navigator.clipboard.writeText(NOREK.nomor); showToast('Nomor disalin ✓', 'success') }}
                      className="text-blue"><i className="ti ti-copy text-sm" /></button>
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-text-muted">Atas nama</span><span className="font-medium text-text">{NOREK.atas_nama}</span></div>
              </div>
            </div>

            {/* Upload bukti */}
            <div>
              <label className="text-[12px] text-text-muted block mb-1">Upload bukti transfer</label>
              <label className={`block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${preview ? 'border-green' : 'border-border hover:border-blue'}`}>
                <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="preview" className="max-h-40 mx-auto rounded-md object-contain" />
                ) : (
                  <>
                    <i className="ti ti-upload text-2xl text-text-muted block mb-1" />
                    <div className="text-[13px] text-text-muted">Tap untuk upload foto</div>
                    <div className="text-[11px] text-text-muted">JPG, PNG — max 5MB</div>
                  </>
                )}
              </label>
              {preview && (
                <button onClick={() => { setBuktiFile(null); setPreview(null) }}
                  className="text-[12px] text-red mt-1">Hapus foto</button>
              )}
            </div>
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex gap-2 mt-6">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}
              className="flex-1 border border-border text-text text-[14px] font-medium py-3 rounded-md hover:bg-bg-2 transition-all">
              Kembali
            </button>
          )}
          {step < 2 ? (
            <button onClick={() => stepValid() ? setStep(step + 1) : showToast('Lengkapi semua field')}
              className={`flex-1 text-white text-[14px] font-semibold py-3 rounded-md transition-all ${stepValid() ? 'bg-[#185FA5] hover:bg-[#0C447C]' : 'bg-[#185FA5]/50'}`}>
              Lanjut
            </button>
          ) : (
            <button onClick={submit} disabled={saving}
              className="flex-1 bg-[#185FA5] text-white text-[14px] font-semibold py-3 rounded-md hover:bg-[#0C447C] disabled:opacity-50 transition-all">
              {saving ? 'Mengirim...' : '✓ Kirim Pendaftaran'}
            </button>
          )}
        </div>
      </div>
      <ToastProvider />
    </div>
  )
}
