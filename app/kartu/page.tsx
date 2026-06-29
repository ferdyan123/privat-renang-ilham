'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fmtShort } from '@/lib/utils'

const REKENING = {
  nama: 'Muhammad Nurilham Aulia Rahman',
  bank: 'Sea Bank',
  nomor: '901452432623',
}

interface SesiDetail { tanggal: string; jam: string; menit: string; kolam: string }
interface TagihanData {
  id: string
  murid_id: string
  siklus: number
  jumlah_hadir: number
  status: string
  bukti_tf_url: string | null
  murid: { nama: string; paket: string; wa_ortu: string }
  sesi_detail: SesiDetail[]
}

function KartuContent() {
  const params = useSearchParams()
  const tagihanId = params.get('tagihan')

  const [data, setData] = useState<TagihanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    if (!tagihanId) { setError('Link tidak valid'); setLoading(false); return }
    try {
      const { data: tagihan, error: e } = await supabase
        .from('tagihan')
        .select('*, murid:murid_id(nama, paket, wa_ortu)')
        .eq('id', tagihanId)
        .single()
      if (e || !tagihan) throw new Error('Tagihan tidak ditemukan')

      const { data: sesiRows } = await supabase
        .from('sesi')
        .select('id, tanggal, jam, menit, kolam')
        .in('id', tagihan.sesi_ids ?? [])
      const sesi_detail = (sesiRows ?? []).sort((a: any, b: any) => a.tanggal.localeCompare(b.tanggal))

      setData({ ...tagihan, sesi_detail } as TagihanData)
      if (tagihan.status === 'menunggu_konfirmasi' || tagihan.status === 'lunas') setSubmitted(true)
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat data')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tagihanId])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { alert('File max 5MB'); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const submitBukti = async () => {
    if (!file || !tagihanId || !data) return
    setUploading(true)
    try {
      // 1. Upload ke Supabase Storage
      const ext = file.name.split('.').pop()
      const path = `tagihan/${tagihanId}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('bukti-tf')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('bukti-tf').getPublicUrl(path)
      const buktiUrl = urlData.publicUrl

      // 2. Update status tagihan
      const { error: updErr } = await supabase
        .from('tagihan')
        .update({ status: 'menunggu_konfirmasi', bukti_tf_url: buktiUrl })
        .eq('id', tagihanId)
      if (updErr) throw updErr

      // 3. Simpan ke tabel pembayaran
      const { error: payErr } = await supabase
        .from('pembayaran')
        .insert({
          tagihan_id: tagihanId,
          murid_id: data.murid_id,
          siklus: data.siklus,
          bukti_tf_url: buktiUrl,
          status: 'menunggu',
        })
      // Jika tabel belum ada, ignore error (tidak fatal)
      if (payErr) console.warn('pembayaran insert warn:', payErr.message)

      setSubmitted(true)
      showSuccessToast()
    } catch (e: any) {
      alert('Gagal upload: ' + e?.message)
    } finally { setUploading(false) }
  }

  const showSuccessToast = () => {} // handled by submitted state

  const copyNoRek = () => {
    navigator.clipboard.writeText(REKENING.nomor)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#E6F4FB] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#185FA5] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <div className="text-sm text-[#185FA5]">Memuat kartu...</div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#E6F4FB] flex items-center justify-center p-4">
      <div className="text-center bg-white border border-red/20 rounded-xl p-8 max-w-sm w-full">
        <i className="ti ti-alert-circle text-4xl text-red block mb-3" />
        <div className="text-[16px] font-semibold mb-1">Link tidak valid</div>
        <div className="text-[13px] text-gray-500">{error}</div>
      </div>
    </div>
  )

  if (!data) return null
  const sudahLunas = data.status === 'lunas'
  const menunggu = data.status === 'menunggu_konfirmasi'

  return (
    <div className="min-h-screen bg-[#E6F4FB] py-4 px-4">
      {/* Header animasi */}
      <div className="relative overflow-hidden rounded-xl mb-4 bg-[#185FA5]" style={{height:90}}>
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 35" preserveAspectRatio="none" style={{height:28}}>
          <path fill="rgba(255,255,255,0.15)" d="M0,18 C60,30 120,5 180,18 C240,30 300,5 400,18 L400,35 L0,35 Z">
            <animate attributeName="d" dur="4s" repeatCount="indefinite"
              values="M0,18 C60,30 120,5 180,18 C240,30 300,5 400,18 L400,35 L0,35 Z;
                      M0,12 C70,26 130,4 200,16 C270,28 340,6 400,12 L400,35 L0,35 Z;
                      M0,18 C60,30 120,5 180,18 C240,30 300,5 400,18 L400,35 L0,35 Z"/>
          </path>
        </svg>
        <div className="absolute inset-0 flex items-center px-5 gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ti ti-ripple text-white text-xl" />
          </div>
          <div>
            <div className="text-white text-[15px] font-bold">SwimTrack</div>
            <div className="text-white/70 text-[11px]">Kartu Kehadiran · Siklus #{data.siklus}</div>
          </div>
        </div>
      </div>

      <div className="max-w-[500px] mx-auto space-y-3">
        {/* Info murid + sesi */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Murid</div>
            <div className="text-[20px] font-bold text-gray-900">{data.murid.nama}</div>
            <div className="text-[13px] text-gray-500">{data.murid.paket}</div>
          </div>

          {/* List sesi hadir */}
          <div className="px-5 py-3">
            <div className="text-[12px] font-semibold text-gray-400 mb-2">
              Sesi yang ditagih ({data.jumlah_hadir}x hadir)
            </div>
            <div className="flex flex-col gap-1.5">
              {data.sesi_detail.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-[#E6F4FB] rounded-md px-3 py-2">
                  <span className="w-5 h-5 bg-[#185FA5] rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                  <span className="text-[12px] font-semibold text-gray-800">{fmtShort(s.tanggal)}</span>
                  <span className="text-[11px] text-gray-400">{s.jam}:{s.menit}</span>
                  <span className="text-[11px] text-gray-400 ml-auto">{s.kolam}</span>
                  <span className="text-[10px] font-bold text-[#1D9E75]">✓</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status badge */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-gray-400 mb-0.5">Status pembayaran</div>
              <div className={`text-[13px] font-semibold ${sudahLunas ? 'text-green-600' : menunggu ? 'text-yellow-600' : 'text-gray-700'}`}>
                {sudahLunas ? '✓ Lunas' : menunggu ? '⏳ Menunggu konfirmasi' : 'Belum dibayar'}
              </div>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${sudahLunas ? 'bg-green-50' : menunggu ? 'bg-yellow-50' : 'bg-gray-50'}`}>
              <i className={`ti text-xl ${sudahLunas ? 'ti-circle-check text-green-500' : menunggu ? 'ti-clock text-yellow-500' : 'ti-credit-card text-gray-400'}`} />
            </div>
          </div>
        </div>

        {/* Info rekening — tampil jika belum bayar */}
        {!submitted && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-[13px] font-bold text-[#185FA5] mb-3 flex items-center gap-2">
              <i className="ti ti-credit-card text-base" />Info Pembayaran
            </div>
            <div className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Nama Rekening</span>
                <span className="font-semibold text-gray-800 text-right max-w-[200px]">{REKENING.nama}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bank</span>
                <span className="font-semibold text-gray-800">{REKENING.bank}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">No. Rekening</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-800 text-[14px]">{REKENING.nomor}</span>
                  <button onClick={copyNoRek}
                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-[#E6F4FB] text-[#185FA5] hover:bg-blue-100'}`}>
                    <i className={`ti ${copied ? 'ti-check' : 'ti-copy'} text-xs`} />
                    {copied ? 'Disalin!' : 'Salin'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload bukti TF */}
        {!submitted && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-[14px] font-bold text-gray-800 mb-1">Upload Bukti Transfer</div>
            <div className="text-[12px] text-gray-400 mb-3">
              Setelah transfer, upload foto bukti untuk konfirmasi ke instruktur
            </div>

            <label className={`block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              preview ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-[#185FA5] hover:bg-[#E6F4FB]/50'
            }`}>
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
              ) : (
                <>
                  <div className="w-12 h-12 bg-[#E6F4FB] rounded-full flex items-center justify-center mx-auto mb-2">
                    <i className="ti ti-photo text-2xl text-[#185FA5]" />
                  </div>
                  <div className="text-[13px] font-medium text-gray-600">Tap untuk pilih foto</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">JPG, PNG · max 5MB</div>
                </>
              )}
            </label>

            {preview && (
              <button onClick={() => { setFile(null); setPreview(null) }}
                className="text-[12px] text-red-400 mt-1.5 block">
                × Hapus foto
              </button>
            )}

            {file && (
              <button onClick={submitBukti} disabled={uploading}
                className="w-full mt-3 bg-[#185FA5] text-white rounded-xl py-3 text-[14px] font-bold hover:bg-[#0C447C] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {uploading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Mengirim...</>
                ) : (
                  <><i className="ti ti-send text-base" />Kirim Bukti Pembayaran</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Success state */}
        {submitted && (
          <div className={`rounded-xl p-5 text-center border ${sudahLunas ? 'bg-green-50 border-green-100' : 'bg-yellow-50 border-yellow-100'}`}>
            <i className={`ti text-5xl block mb-3 ${sudahLunas ? 'ti-circle-check text-green-500' : 'ti-clock text-yellow-500'}`} />
            <div className="text-[16px] font-bold text-gray-800 mb-1">
              {sudahLunas ? 'Pembayaran Lunas! 🎉' : 'Bukti Terkirim! 🙌'}
            </div>
            <div className="text-[13px] text-gray-500">
              {sudahLunas
                ? 'Terima kasih! Pembayaran sudah dikonfirmasi instruktur.'
                : 'Bukti sudah diterima. Menunggu konfirmasi instruktur ya!'}
            </div>
            {menunggu && data.bukti_tf_url && (
              <a href={data.bukti_tf_url} target="_blank"
                className="inline-flex items-center gap-1.5 text-[12px] text-[#185FA5] mt-3 hover:underline">
                <i className="ti ti-photo text-sm" />Lihat bukti yang dikirim
              </a>
            )}
          </div>
        )}

        <div className="text-center text-[11px] text-gray-400 pb-4">
          SwimTrack · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}

export default function KartuPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#E6F4FB] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#185FA5] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <KartuContent />
    </Suspense>
  )
}