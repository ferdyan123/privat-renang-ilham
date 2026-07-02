'use client'
import { useEffect, useState } from 'react'
import { getMurid, getSesi, createTagihan, getSiklusBerjalan, Murid, Sesi } from '@/lib/supabase'
import { fmtShort, fmtRupiah } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import Avatar from '@/components/ui/Avatar'

// ── Info pembayaran — edit di sini ──────────────────────────
const REKENING = {
  nama: 'Muhammad Nurilham Aulia Rahman',
  bank: 'Sea Bank',
  nomor: '901452432623',
}
// ────────────────────────────────────────────────────────────

interface SiklusInfo {
  sesiHadir: string[]
  jumlahTarget: number
  siapTagih: boolean
  siklusBerikutnya: number
  sesiDetail: Sesi[]
}

export default function KirimPage() {
  const [muridList, setMuridList] = useState<Murid[]>([])
  const [selectedMurid, setSelectedMurid] = useState('')
  const [siklus, setSiklus] = useState<SiklusInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')

  useEffect(() => {
    getMurid().then(setMuridList).catch(() => showToast('Gagal load murid', 'error'))
  }, [])

  const checkSiklus = async (mid: string) => {
    setSelectedMurid(mid)
    setSiklus(null)
    setGeneratedLink('')
    if (!mid) return
    setLoading(true)
    try {
      const murid = muridList.find((m) => m.id === mid)!
      const info = await getSiklusBerjalan(mid, murid.paket)
      const sesiAll = await getSesi(500)
      const sesiDetail = sesiAll
        .filter((s) => info.sesiHadir.includes(s.id))
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      setSiklus({ ...info, sesiDetail })
    } catch (e: any) {
      showToast('Gagal cek siklus: ' + e?.message, 'error')
    } finally { setLoading(false) }
  }

  const generateTagihan = async () => {
    if (!siklus || !selectedMurid) return
    setGenerating(true)
    try {
      const sesiUntukTagihan = siklus.sesiHadir.slice(0, siklus.jumlahTarget)
      const tagihan = await createTagihan({
        murid_id: selectedMurid,
        siklus: siklus.siklusBerikutnya,
        sesi_ids: sesiUntukTagihan,
        jumlah_hadir: sesiUntukTagihan.length,
        status: 'belum_bayar',
        bukti_tf_url: null,
        total_harga: murid.harga ?? 0,
      })
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      setGeneratedLink(`${appUrl}/kartu?tagihan=${tagihan.id}`)
      showToast('Tagihan berhasil dibuat ✓', 'success')
    } catch (e: any) {
      showToast('Gagal buat tagihan: ' + e?.message, 'error')
      console.error(e)
    } finally { setGenerating(false) }
  }

  const murid = muridList.find((m) => m.id === selectedMurid)

  // Format jadwal dari sesi: ambil sesi pertama sebagai referensi jadwal tetap
  const jadwalLabel = siklus?.sesiDetail[0]
    ? `${new Date(siklus.sesiDetail[0].tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long' })} ${siklus.sesiDetail[0].jam}:${siklus.sesiDetail[0].menit} - ${(() => { const t = parseInt(siklus.sesiDetail[0].jam)*60+parseInt(siklus.sesiDetail[0].menit)+60; return String(Math.floor(t/60)%24).padStart(2,'0')+':'+String(t%60).padStart(2,'0') })()} · ${siklus.sesiDetail[0].kolam}`
    : '—'

  const kirimWA = () => {
    if (!generatedLink || !murid || !siklus) return
    const harga = murid.harga ?? 0
    const msg =
`*Tagihan Les Renang - SwimTrack* 🏊

Halo orang tua dari *${murid.nama}* 👋

Berikut detail tagihan siklus #${siklus.siklusBerikutnya}:

👤 *Nama:* ${murid.nama}
📦 *Paket:* ${murid.paket} (${murid.jumlah_sesi ?? 4}x/bulan)
📅 *Jadwal:* ${jadwalLabel}
✅ *Kehadiran:* ${siklus.jumlahTarget}x hadir
💰 *Total tagihan:* ${harga > 0 ? fmtRupiah(harga) : 'sesuai paket'}

💳 *Pembayaran:*
Silakan transfer ke:
Nama Rekening: ${REKENING.nama}
Bank: ${REKENING.bank}
No. Rekening: ${REKENING.nomor}

📋 *Lihat detail & upload bukti bayar:*
${generatedLink}

_Terima kasih! 💙_`

    const wa = murid.wa_ortu ? '62' + murid.wa_ortu.replace(/^0/, '') : ''
    if (!wa) { showToast('Nomor WA orang tua tidak ada', 'error'); return }
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink)
      .then(() => showToast('Link disalin ✓', 'success'))
  }

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Hero animasi renang */}
      <div className="relative overflow-hidden rounded-xl mb-5 bg-[#E6F4FB]" style={{height:130}}>
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 50" preserveAspectRatio="none" style={{height:38}}>
          <path fill="#B8DEF0" fillOpacity="0.6"
            d="M0,25 C50,40 100,10 150,25 C200,40 250,10 300,25 C350,40 380,15 400,25 L400,50 L0,50 Z">
            <animate attributeName="d" dur="4s" repeatCount="indefinite"
              values="M0,25 C50,40 100,10 150,25 C200,40 250,10 300,25 C350,40 380,15 400,25 L400,50 L0,50 Z;
                      M0,18 C60,35 110,8 160,22 C210,38 260,8 310,22 C355,38 385,12 400,18 L400,50 L0,50 Z;
                      M0,25 C50,40 100,10 150,25 C200,40 250,10 300,25 C350,40 380,15 400,25 L400,50 L0,50 Z"/>
          </path>
          <path fill="#91CCE8" fillOpacity="0.4"
            d="M0,35 C70,18 130,48 200,30 C270,12 330,45 400,30 L400,50 L0,50 Z">
            <animate attributeName="d" dur="6s" repeatCount="indefinite"
              values="M0,35 C70,18 130,48 200,30 C270,12 330,45 400,30 L400,50 L0,50 Z;
                      M0,28 C80,48 140,20 210,38 C280,20 340,48 400,35 L400,50 L0,50 Z;
                      M0,35 C70,18 130,48 200,30 C270,12 330,45 400,30 L400,50 L0,50 Z"/>
          </path>
        </svg>

        {/* Gelembung kecil */}
        {[[45,22,3,'3s'],[110,32,2.5,'4.2s'],[195,18,4,'3.8s'],[295,26,3,'5s'],[355,20,3.5,'4.5s']].map(([x,y,r,dur],i)=>(
          <div key={i} className="absolute rounded-full bg-[#185FA5]/20"
            style={{left:x,top:y,width:Number(r)*2.5,height:Number(r)*2.5,
              animation:`bubble${i} ${dur} ease-in-out infinite`}}/>
        ))}
        <style>{`
          @keyframes swimRight { 0%{left:-70px} 100%{left:calc(100% + 10px)} }
          @keyframes bubble0,@keyframes bubble1,@keyframes bubble2,
          @keyframes bubble3,@keyframes bubble4 { 0%,100%{transform:translateY(0);opacity:.3} 50%{transform:translateY(-12px);opacity:.1} }
        `}</style>

        {/* Swimmer SVG */}
        <div className="absolute" style={{bottom:32,left:0,animation:'swimRight 9s linear infinite'}}>
          <svg width="64" height="28" viewBox="0 0 64 28">
            <ellipse cx="32" cy="17" rx="13" ry="6" fill="#F9C784"/>
            <circle cx="47" cy="11" r="7" fill="#F9C784"/>
            <ellipse cx="47" cy="6" rx="7" ry="4" fill="#185FA5"/>
            <rect x="41" y="10" width="11" height="4" rx="2" fill="#0C447C" opacity="0.5"/>
            <ellipse cx="19" cy="14" rx="9" ry="3.5" fill="#F9C784" transform="rotate(-18 19 14)">
              <animateTransform attributeName="transform" type="rotate" values="-18 19 14;-32 19 14;-18 19 14" dur="0.85s" repeatCount="indefinite"/>
            </ellipse>
            <ellipse cx="19" cy="21" rx="9" ry="3.5" fill="#F9C784" transform="rotate(18 19 21)">
              <animateTransform attributeName="transform" type="rotate" values="18 19 21;32 19 21;18 19 21" dur="0.85s" repeatCount="indefinite" begin="0.42s"/>
            </ellipse>
            <ellipse cx="17" cy="17" rx="11" ry="2.5" fill="#185FA5" transform="rotate(-12 17 17)">
              <animateTransform attributeName="transform" type="rotate" values="-12 17 17;-26 17 17;-12 17 17" dur="0.65s" repeatCount="indefinite"/>
            </ellipse>
            <ellipse cx="17" cy="22" rx="11" ry="2.5" fill="#185FA5" transform="rotate(12 17 22)">
              <animateTransform attributeName="transform" type="rotate" values="12 17 22;26 17 22;12 17 22" dur="0.65s" repeatCount="indefinite" begin="0.32s"/>
            </ellipse>
            <ellipse cx="30" cy="17" rx="9" ry="4.5" fill="#185FA5" opacity="0.65"/>
          </svg>
        </div>

        <div className="absolute top-4 left-5">
          <div className="text-[16px] font-bold text-[#0C447C]">Kirim Tagihan</div>
          <div className="text-[12px] text-[#185FA5]/70">Generate & kirim ke WhatsApp orang tua</div>
        </div>
      </div>

      {/* Pilih murid */}
      <div className="bg-bg border border-border rounded-lg p-4 shadow-sm mb-4">
        <label className="text-[12px] text-text-muted block mb-2">Pilih murid</label>
        <div className="flex flex-col gap-2">
          {muridList.length === 0 && (
            <div className="text-center py-4 text-text-muted text-sm">Belum ada murid aktif</div>
          )}
          {muridList.map((m) => (
            <button key={m.id} onClick={() => checkSiklus(m.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${selectedMurid === m.id ? 'border-blue bg-blue-light' : 'border-border hover:border-blue/40'}`}>
              <Avatar nama={m.nama} size="sm" />
              <div className="flex-1 text-left">
                <div className="text-[13px] font-semibold text-text">{m.nama}</div>
                <div className="text-[11px] text-text-muted">{m.paket}</div>
              </div>
              {m.kategori === 'abk' && <span className="text-[10px] bg-yellow/10 text-yellow px-1.5 py-0.5 rounded-full">ABK</span>}
              {selectedMurid === m.id && <i className="ti ti-check text-blue" />}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-center py-8 text-text-muted text-sm">
          <i className="ti ti-loader-2 text-2xl block mb-2 animate-spin" />Mengecek siklus...
        </div>
      )}

      {siklus && murid && !loading && (
        <div className="bg-bg border border-border rounded-lg p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[14px] font-semibold text-text">Siklus #{siklus.siklusBerikutnya}</div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${siklus.siapTagih ? 'bg-green/10 text-green' : 'bg-yellow/10 text-yellow'}`}>
              {siklus.siapTagih ? '✓ Siap tagih' : `${siklus.sesiHadir.length}/${siklus.jumlahTarget} hadir`}
            </span>
          </div>

          {/* Info murid ringkas */}
          <div className="bg-bg-2 rounded-md px-3 py-2 mb-3 text-[12px] flex flex-wrap gap-x-4 gap-y-1">
            <div><span className="text-text-muted">Nama: </span><strong className="text-text">{murid.nama}</strong></div>
            <div><span className="text-text-muted">Paket: </span><strong className="text-text">{murid.paket} ({murid.jumlah_sesi ?? 4}x)</strong></div>
            <div><span className="text-text-muted">Jadwal: </span><strong className="text-text">{jadwalLabel}</strong></div>
            {(murid.harga ?? 0) > 0 && (
              <div><span className="text-text-muted">Tagihan: </span><strong className="text-blue">{fmtRupiah(murid.harga ?? 0)}</strong></div>
            )}
          </div>

          {/* Progress */}
          <div className="mb-3">
            <div className="flex justify-between text-[11px] text-text-muted mb-1">
              <span>Kehadiran siklus ini</span>
              <span>{Math.min(siklus.sesiHadir.length, siklus.jumlahTarget)}/{siklus.jumlahTarget}</span>
            </div>
            <div className="h-2.5 bg-bg-3 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${siklus.siapTagih ? 'bg-green' : 'bg-blue'}`}
                style={{ width: `${Math.min(siklus.sesiHadir.length / siklus.jumlahTarget * 100, 100)}%` }} />
            </div>
          </div>

          {/* List sesi hadir */}
          {siklus.sesiDetail.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-3">
              {siklus.sesiDetail.slice(0, siklus.jumlahTarget).map((s, i) => (
                <div key={s.id} className="flex items-center gap-2.5 bg-blue-light rounded-md px-3 py-2">
                  <span className="w-5 h-5 bg-blue rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                  <span className="text-[12px] font-medium text-text">{fmtShort(s.tanggal)}</span>
                  <span className="text-[11px] text-text-muted">{s.jam}:{s.menit}</span>
                  <span className="text-[11px] text-text-muted ml-auto">{s.kolam}</span>
                </div>
              ))}
            </div>
          )}

          {siklus.sesiHadir.length === 0 && (
            <div className="text-center py-4 text-text-muted text-[13px] mb-3">Belum ada kehadiran di siklus ini</div>
          )}

          {/* Info rekening */}
          <div className="bg-blue-light border border-blue/10 rounded-md px-3 py-2.5 mb-3 text-[12px]">
            <div className="font-semibold text-blue mb-1">💳 Info Pembayaran (dikirim ke WA)</div>
            <div className="text-text-muted space-y-0.5">
              <div>Nama: <strong className="text-text">{REKENING.nama}</strong></div>
              <div>Bank: <strong className="text-text">{REKENING.bank}</strong></div>
              <div>No. Rek: <strong className="text-text font-mono">{REKENING.nomor}</strong></div>
            </div>
          </div>

          {/* CTA */}
          {siklus.siapTagih ? (
            !generatedLink ? (
              <button onClick={generateTagihan} disabled={generating}
                className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-[14px] font-semibold hover:bg-[#0C447C] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                <i className="ti ti-file-invoice" />
                {generating ? 'Membuat tagihan...' : 'Buat & Generate Link Tagihan'}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="bg-bg-2 border border-border rounded-md px-3 py-2 text-[12px] text-blue break-all">{generatedLink}</div>
                <div className="flex gap-2">
                  <button onClick={copyLink}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-border text-text text-[13px] font-medium py-2 rounded-md hover:bg-bg-2 transition-all">
                    <i className="ti ti-copy" />Salin
                  </button>
                  <button onClick={kirimWA}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] text-white text-[13px] font-semibold py-2 rounded-md hover:bg-[#1ab254] transition-all">
                    <i className="ti ti-brand-whatsapp" />Kirim WA
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="text-center text-[12px] text-text-muted bg-bg-2 rounded-md py-3">
              Butuh <strong className="text-text">{siklus.jumlahTarget - siklus.sesiHadir.length}x hadir lagi</strong> untuk bisa tagih
            </div>
          )}
        </div>
      )}
    </div>
  )
}
