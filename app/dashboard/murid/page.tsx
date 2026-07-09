'use client'
import { useEffect, useState } from 'react'
import { getMurid, addMurid, updateMurid, deleteMurid, getJadwalSlot, getPemilikSuggestions, getMuridJadwalByMurid, replaceMuridJadwal, getJadwalPenggantiByMurid, addJadwalPengganti, deleteJadwalPengganti, getHargaSetting, Murid, JadwalSlot, MuridJadwal, JadwalPengganti } from '@/lib/supabase'
import { PAKET_LIST, KATEGORI_LIST, KOLAM_PRESETS, DEFAULT_HARGA_SETTING, HargaSetting, hitungHarga, fmtRupiah, formatRibuan, parseRibuan, PEMILIK_TETAP, fmtShort } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export default function MuridPage() {
  const [list, setList] = useState<Murid[]>([])
  const [search, setSearch] = useState('')
  const [filterHari, setFilterHari] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [jadwalSlots, setJadwalSlots] = useState<JadwalSlot[]>([])
  const [pemilikSuggestions, setPemilikSuggestions] = useState<string[]>([])
  const [pakaiCustomPemilik, setPakaiCustomPemilik] = useState(false)
  const [hargaSetting, setHargaSetting] = useState<HargaSetting>(DEFAULT_HARGA_SETTING)

  const [form, setForm] = useState({
    nama: '', paket: PAKET_LIST[0], wa_ortu: '',
    kategori: 'normal' as 'normal' | 'abk',
    jumlah_sesi: 4 as 4 | 8,
    jadwal_hari: '', jadwal_jam: '', jadwal_kolam: KOLAM_PRESETS[0],
    harga: DEFAULT_HARGA_SETTING.semi_privat_normal,
    pemilik: 'Ilham',
  })

  // Bisa pilih lebih dari 1 jadwal (misal paket 8x/bulan = 2x seminggu)
  const [jadwalPilihan, setJadwalPilihan] = useState<{ hari: string; jam_mulai: string; kolam: string }[]>([])
  const maxJadwal = form.jumlah_sesi === 8 ? 2 : 1

  const toggleJadwal = (s: JadwalSlot) => {
    setJadwalPilihan((prev) => {
      const exists = prev.some((p) => p.hari === s.hari && p.jam_mulai === s.jam_mulai && p.kolam === s.kolam)
      if (exists) return prev.filter((p) => !(p.hari === s.hari && p.jam_mulai === s.jam_mulai && p.kolam === s.kolam))
      if (prev.length >= maxJadwal) {
        showToast(`Paket ${form.jumlah_sesi}x/bulan cuma bisa pilih ${maxJadwal} jadwal`, 'error')
        return prev
      }
      return [...prev, { hari: s.hari, jam_mulai: s.jam_mulai, kolam: s.kolam }]
    })
  }

  // ── Ganti Jadwal Minggu Ini (kelas pengganti/makeup 1x) ───────────────────
  const [showPengganti, setShowPengganti] = useState(false)
  const [penggantiMurid, setPenggantiMurid] = useState<Murid | null>(null)
  const [penggantiSlotsMurid, setPenggantiSlotsMurid] = useState<MuridJadwal[]>([])
  const [penggantiHistory, setPenggantiHistory] = useState<JadwalPengganti[]>([])
  const [pgSlotAsalKey, setPgSlotAsalKey] = useState('')
  const [pgTanggalAsal, setPgTanggalAsal] = useState('')
  const [pgTanggalBaru, setPgTanggalBaru] = useState('')
  const [pgSlotBaruKey, setPgSlotBaruKey] = useState('')
  const [pgKeterangan, setPgKeterangan] = useState('')
  const [pgSaving, setPgSaving] = useState(false)

  const slotKey = (hari: string, jam_mulai: string, kolam: string | null) => `${hari}|${jam_mulai}|${kolam ?? ''}`

  const openPengganti = async (m: Murid) => {
    setPenggantiMurid(m)
    setShowPengganti(true)
    setPgSlotAsalKey(''); setPgTanggalAsal(''); setPgTanggalBaru(''); setPgSlotBaruKey(''); setPgKeterangan('')
    try {
      const [slots, history] = await Promise.all([getMuridJadwalByMurid(m.id), getJadwalPenggantiByMurid(m.id)])
      setPenggantiSlotsMurid(slots)
      setPenggantiHistory(history)
    } catch {
      setPenggantiSlotsMurid([]); setPenggantiHistory([])
    }
  }

  // Nama hari dari tanggal baru yang dipilih, buat nyaring pilihan jam pengganti
  const hariDariTanggalBaru = pgTanggalBaru
    ? new Date(pgTanggalBaru + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long' })
    : ''
  const slotBaruOptions = jadwalSlots.filter((s) => s.hari === hariDariTanggalBaru)

  const handleSavePengganti = async () => {
    if (!penggantiMurid) return
    const slotAsal = penggantiSlotsMurid.find((s) => slotKey(s.hari, s.jam_mulai, s.kolam) === pgSlotAsalKey)
    if (!slotAsal) { showToast('Pilih jadwal asal yang mau diganti'); return }
    if (!pgTanggalAsal) { showToast('Isi tanggal yang mau di-skip'); return }
    if (!pgTanggalBaru) { showToast('Isi tanggal penggantinya'); return }
    const slotBaru = slotBaruOptions.find((s) => slotKey(s.hari, s.jam_mulai, s.kolam) === pgSlotBaruKey)
    if (!slotBaru) { showToast('Pilih jam pengganti dulu'); return }
    setPgSaving(true)
    try {
      await addJadwalPengganti({
        murid_id: penggantiMurid.id,
        tanggal_asal: pgTanggalAsal,
        tanggal_baru: pgTanggalBaru,
        jam: slotBaru.jam_mulai,
        kolam: slotBaru.kolam,
        keterangan: pgKeterangan.trim() || null,
      })
      showToast('Jadwal pengganti disimpan ✓', 'success')
      const history = await getJadwalPenggantiByMurid(penggantiMurid.id)
      setPenggantiHistory(history)
      setPgTanggalAsal(''); setPgTanggalBaru(''); setPgSlotBaruKey(''); setPgKeterangan('')
    } catch (e: any) {
      showToast('Gagal simpan: ' + e?.message, 'error')
    } finally {
      setPgSaving(false)
    }
  }

  const handleDeletePengganti = async (p: JadwalPengganti) => {
    if (!confirm('Batalkan jadwal pengganti ini? Murid balik ke jadwal asalnya di tanggal itu.')) return
    try {
      await deleteJadwalPengganti(p.id)
      setPenggantiHistory((prev) => prev.filter((x) => x.id !== p.id))
      showToast('Jadwal pengganti dibatalkan', 'success')
    } catch (e: any) {
      showToast('Gagal batalkan: ' + e?.message, 'error')
    }
  }

  const updateForm = (updates: Partial<typeof form>) => {
    setForm(prev => {
      const next = { ...prev, ...updates }
      next.harga = hitungHarga(hargaSetting, next.paket, next.kategori, next.jumlah_sesi)
      return next
    })
    if (updates.jumlah_sesi) {
      const maxBaru = updates.jumlah_sesi === 8 ? 2 : 1
      setJadwalPilihan((prev) => prev.slice(0, maxBaru))
    }
  }

  const load = async () => {
    setLoading(true)
    try { setList(await getMurid()) }
    catch (e: any) { showToast('Gagal load murid: ' + e?.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    getJadwalSlot().then(setJadwalSlots).catch(() => {})
    getPemilikSuggestions().then(setPemilikSuggestions).catch(() => {})
    getHargaSetting().then(setHargaSetting).catch(() => {})
  }, [])

  const hariMurid = (m: Murid) => (m.jadwal_hari ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  const filtered = list.filter((m) =>
    m.nama.toLowerCase().includes(search.toLowerCase()) &&
    (!filterHari || hariMurid(m).includes(filterHari))
  )

  const hariCount = HARI_LIST.reduce<Record<string, number>>((acc, h) => {
    acc[h] = list.filter((m) => hariMurid(m).includes(h)).length
    return acc
  }, {})

  const resetForm = () => {
    setForm({ nama: '', paket: PAKET_LIST[0], wa_ortu: '', kategori: 'normal',
      jumlah_sesi: 4, jadwal_hari: '', jadwal_jam: '', jadwal_kolam: KOLAM_PRESETS[0],
      harga: hitungHarga(hargaSetting, PAKET_LIST[0], 'normal', 4), pemilik: 'Ilham' })
    setJadwalPilihan([])
    setPakaiCustomPemilik(false)
    setEditingId(null)
  }

  const openEdit = async (m: Murid) => {
    setEditingId(m.id)
    const pemilikMurid = m.pemilik || 'Ilham'
    setPakaiCustomPemilik(!PEMILIK_TETAP.includes(pemilikMurid))
    setForm({
      nama: m.nama, paket: m.paket, wa_ortu: m.wa_ortu ?? '',
      kategori: m.kategori, jumlah_sesi: (m.jumlah_sesi as 4|8) ?? 4,
      jadwal_hari: m.jadwal_hari ?? '', jadwal_jam: m.jadwal_jam ?? '',
      jadwal_kolam: m.jadwal_kolam ?? KOLAM_PRESETS[0],
      harga: m.harga ?? hitungHarga(hargaSetting, m.paket, m.kategori, m.jumlah_sesi ?? 4),
      pemilik: pemilikMurid,
    })
    setShowAdd(true)
    // Ambil jadwal detail (multi-slot) punya murid ini dari murid_jadwal
    try {
      const slots = await getMuridJadwalByMurid(m.id)
      setJadwalPilihan(slots.map((s) => ({ hari: s.hari, jam_mulai: s.jam_mulai, kolam: s.kolam ?? '' })))
    } catch {
      setJadwalPilihan([])
    }
  }

  const handleSave = async () => {
    if (!form.nama.trim()) { showToast('Nama harus diisi'); return }
    if (jadwalPilihan.length === 0) { showToast('Pilih minimal 1 jadwal'); return }
    if (jadwalPilihan.length !== maxJadwal) { showToast(`Paket ${form.jumlah_sesi}x/bulan wajib pilih ${maxJadwal} jadwal`); return }
    if (pakaiCustomPemilik && !form.pemilik.trim()) { showToast('Isi dulu nama pemiliknya'); return }
    setSaving(true)
    try {
      const jadwalHari = jadwalPilihan.map((s) => s.hari).join(', ')
      const jadwalJam = jadwalPilihan.map((s) => s.jam_mulai).join(', ')
      const jadwalKolam = jadwalPilihan.map((s) => s.kolam).join(', ')
      const payload = { ...form, jadwal_hari: jadwalHari, jadwal_jam: jadwalJam, jadwal_kolam: jadwalKolam }
      if (editingId) {
        await updateMurid(editingId, payload)
        await replaceMuridJadwal(editingId, jadwalPilihan)
        showToast('Murid diperbarui ✓', 'success')
      } else {
        await addMurid(payload, jadwalPilihan)
        showToast('Murid ditambahkan ✓', 'success')
      }
      setShowAdd(false); resetForm(); load()
    } catch (e: any) {
      showToast('Gagal: ' + e?.message, 'error'); console.error(e)
    } finally { setSaving(false) }
  }

  const handleDelete = async (m: Murid) => {
    if (!confirm(`Hapus ${m.nama}?`)) return
    try { await deleteMurid(m.id); showToast(`${m.nama} dihapus`); load() }
    catch (e: any) { showToast('Gagal hapus: ' + e?.message, 'error') }
  }

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-base" />
          <input className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm bg-bg text-text placeholder:text-text-muted"
            placeholder="Cari murid..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { resetForm(); setShowAdd(true) }}
          className="flex items-center gap-1.5 bg-[#185FA5] text-white px-3 py-2 rounded-md text-sm font-medium">
          <i className="ti ti-plus text-base" />Tambah
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-blue-light border border-blue/20 rounded-md px-3 py-2 text-center">
          <div className="text-[18px] font-bold text-blue">{list.length}</div>
          <div className="text-[11px] text-text-muted">Total aktif</div>
        </div>
        <div className="bg-bg border border-border rounded-md px-3 py-2 text-center">
          <div className="text-[18px] font-bold text-text">{list.filter(m=>m.kategori!=='abk').length}</div>
          <div className="text-[11px] text-text-muted">Normal</div>
        </div>
        <div className="bg-yellow/10 border border-yellow/20 rounded-md px-3 py-2 text-center">
          <div className="text-[18px] font-bold text-yellow">{list.filter(m=>m.kategori==='abk').length}</div>
          <div className="text-[11px] text-text-muted">ABK</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-[12px] text-text-muted mb-2">Filter hari</div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterHari('')}
            className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${!filterHari ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
            Semua
          </button>
          {HARI_LIST.map((h) => (
            <button key={h} onClick={() => setFilterHari(h)}
              className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${filterHari === h ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
              {h.slice(0,3)}{hariCount[h] > 0 ? ` (${hariCount[h]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-center py-12 text-text-muted text-sm"><i className="ti ti-loader-2 text-3xl block mb-2 animate-spin" />Memuat...</div>}

      <div className="flex flex-col gap-2">
        {filtered.map((m) => (
          <div key={m.id} className="bg-bg border border-border rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm">
            <Avatar nama={m.nama} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-[14px] font-semibold text-text truncate">{m.nama}</div>
                {m.kategori === 'abk' && <span className="bg-yellow/10 text-yellow text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">ABK</span>}
                {m.pemilik && m.pemilik !== 'Ilham' && (
                  <span className="bg-blue-light text-blue text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-0.5">
                    <i className="ti ti-building-bank text-[10px]" />{m.pemilik}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-text-muted">{m.paket} · {m.jumlah_sesi ?? 4}x/bulan</div>
              <div className="text-[12px] font-semibold text-blue mt-0.5">
                {fmtRupiah(m.harga ?? hitungHarga(hargaSetting, m.paket, m.kategori, m.jumlah_sesi ?? 4))}/bulan
              </div>
              {m.jadwal_hari && (
                <div className="text-[11px] text-blue/70 mt-0.5 flex items-center gap-1">
                  <i className="ti ti-calendar-time text-[11px]" />
                  {m.jadwal_hari} {m.jadwal_jam} · {m.jadwal_kolam}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {m.wa_ortu && (
                <a href={`https://wa.me/62${m.wa_ortu.replace(/^0/, '')}`} target="_blank"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#E6F1FB] text-blue hover:bg-blue hover:text-white transition-all">
                  <i className="ti ti-brand-whatsapp text-base" />
                </a>
              )}
              <button onClick={() => openPengganti(m)}
                title="Ganti Jadwal Minggu Ini"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-yellow/10 text-text-muted hover:text-yellow transition-all">
                <i className="ti ti-calendar-repeat text-base" />
              </button>
              <button onClick={() => openEdit(m)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue/10 text-text-muted hover:text-blue transition-all">
                <i className="ti ti-edit text-base" />
              </button>
              <button onClick={() => handleDelete(m)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red/10 text-text-muted hover:text-red transition-all">
                <i className="ti ti-trash text-base" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <i className="ti ti-users text-4xl block mb-2 opacity-40" />
          <p className="text-sm">{search || filterHari ? 'Murid tidak ditemukan' : 'Belum ada murid aktif'}</p>
        </div>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm() }} title={editingId ? 'Edit Murid' : 'Tambah Murid Baru'}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] text-text-muted block mb-1">Nama murid</label>
            <input type="text" placeholder="Nama lengkap" value={form.nama}
              onChange={(e) => updateForm({ nama: e.target.value })}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
          </div>
          <div>
            <label className="text-[12px] text-text-muted block mb-1">No. WA orang tua</label>
            <input type="tel" placeholder="08xxxxxxxxxx" value={form.wa_ortu}
              onChange={(e) => updateForm({ wa_ortu: e.target.value })}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
          </div>

          <div>
            <label className="text-[12px] text-text-muted block mb-1.5">Paket</label>
            <div className="flex gap-2">
              {PAKET_LIST.map((p) => (
                <button key={p} onClick={() => updateForm({ paket: p })}
                  className={`flex-1 py-2 rounded-md border text-[13px] font-medium transition-all ${form.paket === p ? 'bg-blue-light border-blue text-blue' : 'border-border text-text-muted'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] text-text-muted block mb-1.5">Jumlah sesi per bulan</label>
            <div className="flex gap-2">
              {([4, 8] as const).map((n) => (
                <button key={n} onClick={() => updateForm({ jumlah_sesi: n })}
                  className={`flex-1 py-2 rounded-md border text-[13px] font-medium transition-all ${form.jumlah_sesi === n ? 'bg-blue-light border-blue text-blue' : 'border-border text-text-muted'}`}>
                  {n}x/bulan
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] text-text-muted block mb-1.5">Kategori murid</label>
            <div className="grid grid-cols-2 gap-2">
              {KATEGORI_LIST.map((k) => (
                <button key={k.value} onClick={() => updateForm({ kategori: k.value as 'normal' | 'abk' })}
                  className={`py-2.5 px-3 rounded-md border text-[12px] font-medium text-left transition-all ${form.kategori === k.value
                    ? k.value === 'abk' ? 'bg-yellow/10 border-yellow text-yellow' : 'bg-blue-light border-blue text-blue'
                    : 'border-border text-text-muted'}`}>
                  <div className="font-semibold">{k.value === 'normal' ? '🏊 Normal' : '⭐ ABK'}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{k.value === 'normal' ? 'Anak reguler' : 'Berkebutuhan khusus'}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] text-text-muted block mb-1.5">Pemilik (rekening penagihan)</label>
            <div className="flex flex-wrap gap-2">
              {PEMILIK_TETAP.map((p) => (
                <button key={p} onClick={() => { setPakaiCustomPemilik(false); setForm(prev => ({ ...prev, pemilik: p })) }}
                  className={`px-3.5 py-1.5 rounded-md border text-[12px] font-medium transition-all ${!pakaiCustomPemilik && form.pemilik === p ? 'bg-blue-light border-blue text-blue' : 'border-border text-text-muted'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => { setPakaiCustomPemilik(true); setForm(prev => ({ ...prev, pemilik: PEMILIK_TETAP.includes(prev.pemilik) ? '' : prev.pemilik })) }}
                className={`px-3.5 py-1.5 rounded-md border text-[12px] font-medium transition-all ${pakaiCustomPemilik ? 'bg-blue-light border-blue text-blue' : 'border-border text-text-muted'}`}>
                <i className="ti ti-pencil text-[11px] mr-1" />Ketik sendiri
              </button>
            </div>
            {pakaiCustomPemilik && (
              <div className="mt-2">
                <input type="text" placeholder="Contoh: Ferdy" value={form.pemilik}
                  onChange={(e) => setForm(prev => ({ ...prev, pemilik: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
                {pemilikSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {pemilikSuggestions.map((s) => (
                      <button key={s} onClick={() => setForm(prev => ({ ...prev, pemilik: s }))}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-light text-blue border border-blue/20 hover:bg-blue/10">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-blue-light border border-blue/20 rounded-md px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] text-text-muted">Harga/bulan</div>
              <div className="text-[10px] text-blue/60">{form.paket} · {form.jumlah_sesi}x · {form.kategori === 'abk' ? 'ABK' : 'Normal'}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-blue flex-shrink-0">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatRibuan(form.harga)}
                onChange={(e) => setForm(prev => ({ ...prev, harga: parseRibuan(e.target.value) }))}
                className="flex-1 bg-white border border-blue/20 rounded-md px-3 py-1.5 text-[16px] font-bold text-blue focus:outline-none focus:border-blue"
                placeholder="0"
              />
            </div>
            <div className="text-[10px] text-blue/50 mt-1">Harga otomatis dari paket. Bisa diubah manual jika ada harga khusus.</div>
          </div>

          <div className="bg-blue-light/40 border border-blue/10 rounded-lg p-3">
            <div className="text-[12px] font-semibold text-blue mb-2 flex items-center gap-1.5">
              <i className="ti ti-calendar-time text-sm" />Jadwal Tetap Mingguan
            </div>

            <div className="text-[11px] mb-2">
              <span className={jadwalPilihan.length === maxJadwal ? 'text-blue font-semibold' : 'text-text-muted'}>
                {maxJadwal === 2
                  ? `Paket 8x/bulan = 2x seminggu, pilih tepat 2 jadwal (${jadwalPilihan.length}/2 dipilih)`
                  : `Pilih 1 jadwal (${jadwalPilihan.length}/1 dipilih)`}
              </span>
            </div>

            {jadwalPilihan.length > 0 && (
              <div className="text-[11px] text-blue mb-2">
                Dipilih: <strong>{jadwalPilihan.map((s) => `${s.hari} ${s.jam_mulai}${s.kolam ? ` (${s.kolam})` : ''}`).join(', ')}</strong>
              </div>
            )}

            {jadwalSlots.length > 0 ? (
              Object.entries(
                jadwalSlots.reduce<Record<string, JadwalSlot[]>>((acc, s) => {
                  acc[s.kolam] = acc[s.kolam] ? [...acc[s.kolam], s] : [s]
                  return acc
                }, {})
              ).map(([kolam, slots]) => (
                <div key={kolam} className="mb-3">
                  <div className="text-[11px] font-bold text-text-muted mb-1.5 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue" />{kolam}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {slots.map((s) => {
                      const isSelected = jadwalPilihan.some((p) => p.hari === s.hari && p.jam_mulai === s.jam_mulai && p.kolam === s.kolam)
                      return (
                        <button key={`${s.hari}-${s.jam_mulai}-${s.kolam}`}
                          onClick={() => toggleJadwal(s)}
                          className={`py-1.5 px-1 rounded-md border text-[11px] font-medium transition-all ${isSelected ? 'bg-blue text-white border-blue' : 'border-border text-text-muted'}`}>
                          {s.hari.slice(0,3)} · {s.jam_mulai}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-3 text-text-muted text-[12px]">
                Belum ada jadwal di menu <strong>Jadwal</strong>. Tambahkan sesi dulu di sana.
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-sm font-semibold mt-1 hover:bg-[#0C447C] disabled:opacity-50 transition-all">
            {saving ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Tambah Murid')}
          </button>
        </div>
      </Modal>

      <Modal open={showPengganti} onClose={() => setShowPengganti(false)} title={`Ganti Jadwal Minggu Ini${penggantiMurid ? ` — ${penggantiMurid.nama}` : ''}`}>
        <div className="flex flex-col gap-3">
          <div className="text-[12px] text-text-muted -mt-1">
            Jadwal tetap murid gak berubah. Ini cuma buat 1x pengecualian — minggu depan otomatis balik ke jadwal aslinya.
          </div>

          {penggantiSlotsMurid.length === 0 ? (
            <div className="text-center py-4 text-text-muted text-[12px]">
              Murid ini belum punya jadwal tetap. Atur dulu jadwalnya lewat tombol Edit.
            </div>
          ) : (
            <>
              <div>
                <label className="text-[12px] text-text-muted block mb-1">Jadwal asal yang mau di-skip</label>
                <select value={pgSlotAsalKey} onChange={(e) => setPgSlotAsalKey(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text">
                  <option value="">— Pilih jadwal —</option>
                  {penggantiSlotsMurid.map((s) => (
                    <option key={slotKey(s.hari, s.jam_mulai, s.kolam)} value={slotKey(s.hari, s.jam_mulai, s.kolam)}>
                      {s.hari} {s.jam_mulai}{s.kolam ? ` (${s.kolam})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[12px] text-text-muted block mb-1">Tanggal spesifik yang di-skip</label>
                <input type="date" value={pgTanggalAsal} onChange={(e) => setPgTanggalAsal(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
              </div>

              <div className="border-t border-border my-1" />

              <div>
                <label className="text-[12px] text-text-muted block mb-1">Pindah ke tanggal</label>
                <input type="date" value={pgTanggalBaru}
                  onChange={(e) => { setPgTanggalBaru(e.target.value); setPgSlotBaruKey('') }}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
              </div>

              {pgTanggalBaru && (
                <div>
                  <label className="text-[12px] text-text-muted block mb-1">
                    Jam pengganti — hari {hariDariTanggalBaru}
                  </label>
                  {slotBaruOptions.length === 0 ? (
                    <div className="text-[12px] text-red">Gak ada kelas hari {hariDariTanggalBaru} di menu Jadwal.</div>
                  ) : (
                    <select value={pgSlotBaruKey} onChange={(e) => setPgSlotBaruKey(e.target.value)}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text">
                      <option value="">— Pilih jam —</option>
                      {slotBaruOptions.map((s) => (
                        <option key={slotKey(s.hari, s.jam_mulai, s.kolam)} value={slotKey(s.hari, s.jam_mulai, s.kolam)}>
                          {s.jam_mulai}{s.kolam ? ` (${s.kolam})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="text-[12px] text-text-muted block mb-1">Keterangan (opsional)</label>
                <input type="text" placeholder="misal: sakit, acara keluarga" value={pgKeterangan}
                  onChange={(e) => setPgKeterangan(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
              </div>

              <button onClick={handleSavePengganti} disabled={pgSaving}
                className="w-full bg-[#185FA5] text-white rounded-md py-2.5 text-sm font-semibold hover:bg-[#0C447C] disabled:opacity-50 transition-all">
                {pgSaving ? 'Menyimpan...' : 'Simpan Jadwal Pengganti'}
              </button>
            </>
          )}

          {penggantiHistory.length > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <div className="text-[12px] font-semibold text-text-muted">Riwayat pengganti</div>
              <div className="flex flex-col gap-1.5">
                {penggantiHistory.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-bg-alt rounded-md px-2.5 py-1.5 text-[11px]">
                    <div className="text-text">
                      {fmtShort(p.tanggal_asal)} <i className="ti ti-arrow-right text-[10px]" /> {fmtShort(p.tanggal_baru)} · {p.jam}{p.kolam ? ` (${p.kolam})` : ''}
                      {p.keterangan && <span className="text-text-muted"> — {p.keterangan}</span>}
                    </div>
                    <button onClick={() => handleDeletePengganti(p)} className="text-red hover:opacity-70 flex-shrink-0 ml-2">
                      <i className="ti ti-x text-sm" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}