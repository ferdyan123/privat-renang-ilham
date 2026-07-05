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
    <div className="min-h-screen relative py-4 px-4 overflow-hidden" style={{background:'#E6F4FB'}}>
      {/* Ilustrasi background — anak-anak main air, dekorasi statis */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{opacity:0.5}}>
        <svg className="absolute" style={{left:'5%',top:'12%'}} width="80" height="80" viewBox="0 0 80 80">
          {/* Anak duduk di ban kuning */}
          <circle cx="40" cy="48" r="22" fill="#FFD93D"/>
          <circle cx="40" cy="48" r="22" fill="none" stroke="#F0B800" strokeWidth="2" strokeDasharray="8 5"/>
          <circle cx="40" cy="48" r="13" fill="#A8E1F5"/>
          <ellipse cx="40" cy="44" rx="9" ry="10" fill="#FBC990"/>
          <circle cx="40" cy="26" r="10" fill="#FBC990"/>
          <path d="M30,22 Q40,10 50,22 Q50,17 40,16 Q30,17 30,22 Z" fill="#6B4226"/>
          <ellipse cx="22" cy="40" rx="7" ry="3.5" fill="#FBC990" transform="rotate(-30 22 40)"/>
        </svg>

        <svg className="absolute" style={{right:'8%',top:'22%'}} width="64" height="64" viewBox="0 0 64 64">
          {/* Anak berenang gaya bebas, dilihat dari atas */}
          <ellipse cx="32" cy="32" rx="16" ry="9" fill="#7FD6E8" opacity="0.5"/>
          <ellipse cx="32" cy="30" rx="10" ry="6" fill="#FBC990"/>
          <circle cx="32" cy="18" r="7" fill="#FBC990"/>
          <ellipse cx="32" cy="14" rx="7" ry="4" fill="#FF6B81"/>
          <ellipse cx="18" cy="28" rx="7" ry="3" fill="#FBC990" transform="rotate(-20 18 28)"/>
          <ellipse cx="46" cy="28" rx="7" ry="3" fill="#FBC990" transform="rotate(20 46 28)"/>
        </svg>

        <svg className="absolute" style={{left:'10%',bottom:'15%'}} width="70" height="70" viewBox="0 0 70 70">
          {/* Anak dengan ban bebek */}
          <ellipse cx="35" cy="50" rx="24" ry="10" fill="#FFE17D"/>
          <ellipse cx="50" cy="42" rx="8" ry="7" fill="#FFE17D"/>
          <ellipse cx="55" cy="38" rx="3" ry="2.5" fill="#FF8A3D"/>
          <circle cx="53" cy="40" r="1.2" fill="#3A2A20"/>
          <ellipse cx="35" cy="42" rx="9" ry="9" fill="#FBC990"/>
          <circle cx="35" cy="26" r="9" fill="#FBC990"/>
          <path d="M26,22 Q35,12 44,22 L44,18 Q35,14 26,18 Z" fill="#3A2A20"/>
        </svg>

        <svg className="absolute" style={{right:'12%',bottom:'25%'}} width="56" height="56" viewBox="0 0 56 56">
          {/* Bola pantai */}
          <circle cx="28" cy="28" r="18" fill="#FF6B6B"/>
          <path d="M28,10 A18,18 0 0,1 28,46" fill="#FFD93D"/>
          <path d="M28,10 A18,18 0 0,0 28,46" fill="#4ECDC4" opacity="0.7"/>
          <circle cx="28" cy="28" r="18" fill="none" stroke="#fff" strokeWidth="1" opacity="0.4"/>
        </svg>

        <svg className="absolute" style={{left:'45%',top:'8%'}} width="48" height="48" viewBox="0 0 48 48" opacity="0.6">
          {/* Gelembung dekor */}
          <circle cx="24" cy="24" r="6" fill="none" stroke="#185FA5" strokeWidth="1.5"/>
          <circle cx="36" cy="14" r="3" fill="none" stroke="#185FA5" strokeWidth="1.5"/>
          <circle cx="10" cy="10" r="2" fill="none" stroke="#185FA5" strokeWidth="1.5"/>
        </svg>

        <svg className="absolute" style={{left:'48%',bottom:'10%'}} width="60" height="60" viewBox="0 0 60 60">
          {/* Ikan kecil lucu */}
          <ellipse cx="28" cy="30" rx="16" ry="10" fill="#5DD5E8"/>
          <path d="M44,30 L54,20 L54,40 Z" fill="#5DD5E8"/>
          <circle cx="20" cy="27" r="2" fill="#1A4D5C"/>
          <path d="M14,32 Q20,38 28,35" stroke="#1A4D5C" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="relative z-10">
      {/* Header animasi — anak renang + ban pelampung */}
      <div className="relative overflow-hidden rounded-xl mb-4 bg-[#185FA5]" style={{height:110}}>
        {/* Gelombang air */}
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 40" preserveAspectRatio="none" style={{height:32}}>
          <path fill="rgba(255,255,255,0.18)" d="M0,20 C60,33 120,7 180,20 C240,33 300,7 400,20 L400,40 L0,40 Z">
            <animate attributeName="d" dur="4s" repeatCount="indefinite"
              values="M0,20 C60,33 120,7 180,20 C240,33 300,7 400,20 L400,40 L0,40 Z;
                      M0,13 C70,28 130,5 200,17 C270,30 340,6 400,13 L400,40 L0,40 Z;
                      M0,20 C60,33 120,7 180,20 C240,33 300,7 400,20 L400,40 L0,40 Z"/>
          </path>
          <path fill="rgba(255,255,255,0.12)" d="M0,28 C70,14 130,36 200,22 C270,8 330,32 400,22 L400,40 L0,40 Z">
            <animate attributeName="d" dur="5.5s" repeatCount="indefinite"
              values="M0,28 C70,14 130,36 200,22 C270,8 330,32 400,22 L400,40 L0,40 Z;
                      M0,22 C80,36 140,12 210,28 C280,12 340,36 400,26 L400,40 L0,40 Z;
                      M0,28 C70,14 130,36 200,22 C270,8 330,32 400,22 L400,40 L0,40 Z"/>
          </path>
        </svg>

        {/* Gelembung kecil mengambang */}
        {[[30,55,3,'3.2s',0],[330,48,2.5,'4s',0.5],[370,60,3.5,'3.6s',1]].map(([x,y,r,dur,delay],i)=>(
          <div key={i} className="absolute rounded-full bg-white/25"
            style={{left:x as number,top:y as number,width:(r as number)*2.5,height:(r as number)*2.5,
              animation:`kartuBubble${i} ${dur} ease-in-out ${delay}s infinite`}}/>
        ))}

        {/* Anak main air dengan ban pelampung — mengayun di permukaan */}
        <div className="absolute" style={{right:18,bottom:8,animation:'floatBob 2.4s ease-in-out infinite'}}>
          <svg width="58" height="50" viewBox="0 0 58 50">
            {/* Riak air di bawah ban */}
            <ellipse cx="29" cy="42" rx="22" ry="4" fill="#FFFFFF" opacity="0.15">
              <animate attributeName="rx" values="22;26;22" dur="2.4s" repeatCount="indefinite"/>
            </ellipse>
            {/* Ban pelampung (donut) */}
            <circle cx="29" cy="34" r="16" fill="#FF8A5B"/>
            <circle cx="29" cy="34" r="16" fill="none" stroke="#E8643A" strokeWidth="1.5" strokeDasharray="6 4"/>
            <circle cx="29" cy="34" r="9.5" fill="#185FA5"/>
            {/* Badan anak duduk di tengah ban */}
            <ellipse cx="29" cy="32" rx="7" ry="8" fill="#F9C784"/>
            {/* Kepala */}
            <circle cx="29" cy="16" r="8" fill="#F9C784"/>
            {/* Rambut */}
            <path d="M21,13 Q29,4 37,13 Q37,9 29,8 Q21,9 21,13 Z" fill="#5C3D2E"/>
            {/* Wajah - senyum */}
            <circle cx="26" cy="16" r="1.2" fill="#3A2A20"/>
            <circle cx="32" cy="16" r="1.2" fill="#3A2A20"/>
            <path d="M25,20 Q29,23 33,20" stroke="#3A2A20" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
            {/* Tangan kiri melambai */}
            <ellipse cx="16" cy="28" rx="6" ry="3" fill="#F9C784" transform="rotate(-25 16 28)">
              <animateTransform attributeName="transform" type="rotate"
                values="-25 16 28;-50 16 28;-25 16 28" dur="1.1s" repeatCount="indefinite"/>
            </ellipse>
            {/* Tangan kanan di ban */}
            <ellipse cx="42" cy="32" rx="6" ry="3" fill="#F9C784" transform="rotate(20 42 32)"/>
          </svg>
        </div>

        {/* Splash kecil di sekitar ban */}
        <div className="absolute" style={{right:8,bottom:14,animation:'floatBob 2.4s ease-in-out infinite'}}>
          <svg width="16" height="16" viewBox="0 0 16 16" opacity="0.6">
            <circle cx="3" cy="10" r="1.4" fill="#fff">
              <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.8s" repeatCount="indefinite"/>
            </circle>
            <circle cx="13" cy="6" r="1" fill="#fff">
              <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.5s" repeatCount="indefinite" begin="0.4s"/>
            </circle>
          </svg>
        </div>

        <style>{`
          @keyframes floatBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
          @keyframes kartuBubble0,@keyframes kartuBubble1,@keyframes kartuBubble2 {
            0%,100%{transform:translateY(0);opacity:.25} 50%{transform:translateY(-10px);opacity:.05}
          }
        `}</style>

        <div className="absolute inset-0 flex items-center px-5 gap-3">
          <img src="/logo-app.png" alt="Logo" className="w-9 h-9 rounded-lg flex-shrink-0 object-cover" />
          <div>
            <div className="text-white text-[15px] font-bold">Privat Renang Ilham</div>
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
          Privat Renang Ilham · {new Date().getFullYear()}
        </div>
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