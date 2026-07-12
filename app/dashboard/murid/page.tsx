'use client'
import { useEffect, useMemo, useState } from 'react'
import { getMurid, addMurid, updateMurid, deleteMurid, getJadwalSlot, getPemilikSuggestions, getMuridJadwalByMurid, replaceMuridJadwal, getJadwalPenggantiByMurid, addJadwalPengganti, deleteJadwalPengganti, getHargaSetting, getPeriodeBerjalan, Murid, JadwalSlot, MuridJadwal, JadwalPengganti, PeriodeInfo } from '@/lib/supabase'
import { PAKET_LIST, KATEGORI_LIST, KOLAM_PRESETS, DEFAULT_HARGA_SETTING, HargaSetting, hitungHarga, fmtRupiah, formatRibuan, parseRibuan, PEMILIK_TETAP, fmtShort } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export default function MuridPage() {
  const [list, setList] = useState<Murid[]>([])
  const [periodeMap, setPeriodeMap] = useState<Record<string, PeriodeInfo>>({})  // murid_id → PeriodeInfo
  const [loadingPeriode, setLoadingPeriode] = useState(false)
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

  // Edit paket Adik Kakak = edit GROUP, bukan 1 murid. editingGroupIds terisi
  // kalau modal lagi dalam mode "edit group" — field nama & kategori per anak
  // dikelola terpisah lewat groupChildren (form.nama cuma dipakai buat header display).
  const [editingGroupIds, setEditingGroupIds] = useState<string[] | null>(null)
  const [groupChildren, setGroupChildren] = useState<{ id: string; nama: string; kategori: 'normal' | 'abk' }[]>([])

  // Mode TAMBAH Adik Kakak baru (bukan edit) — pakai newGroupChildren terpisah
  // supaya tidak confuse dengan editingGroupIds (yang punya real murid.id)
  const isAddingAdikKakak = !editingGroupIds && !editingId && form.paket === 'Adik Kakak'
  const [newGroupChildren, setNewGroupChildren] = useState<{ tempId: string; nama: string; kategori: 'normal' | 'abk' }[]>([
    { tempId: '1', nama: '', kategori: 'normal' },
    { tempId: '2', nama: '', kategori: 'normal' },
  ])

  const updateNewGroupChild = (tempId: string, updates: Partial<{ nama: string; kategori: 'normal' | 'abk' }>) => {
    setNewGroupChildren((prev) => prev.map((c) => c.tempId === tempId ? { ...c, ...updates } : c))
  }

  const addNewGroupChild = () => {
    if (newGroupChildren.length >= 5) return
    setNewGroupChildren((prev) => [...prev, { tempId: Date.now().toString(), nama: '', kategori: 'normal' }])
  }

  const removeNewGroupChild = (tempId: string) => {
    if (newGroupChildren.length <= 2) return
    setNewGroupChildren((prev) => prev.filter((c) => c.tempId !== tempId))
  }

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
  // penggantiMurids array (bukan 1 murid) — buat paket Adik Kakak, perubahan
  // jadwal berlaku sekaligus ke SEMUA anak dalam grup itu.
  const [showPengganti, setShowPengganti] = useState(false)
  const [penggantiMurids, setPenggantiMurids] = useState<Murid[]>([])
  const [penggantiSlotsMurid, setPenggantiSlotsMurid] = useState<MuridJadwal[]>([])
  const [penggantiHistory, setPenggantiHistory] = useState<JadwalPengganti[]>([])
  const [pgSlotAsalKey, setPgSlotAsalKey] = useState('')
  const [pgTanggalAsal, setPgTanggalAsal] = useState('')
  const [pgTanggalBaru, setPgTanggalBaru] = useState('')
  const [pgSlotBaruKey, setPgSlotBaruKey] = useState('')
  const [pgKeterangan, setPgKeterangan] = useState('')
  const [pgSaving, setPgSaving] = useState(false)

  const slotKey = (hari: string, jam_mulai: string, kolam: string | null) => `${hari}|${jam_mulai}|${kolam ?? ''}`

  // Kunci unik 1 entri pengganti berdasarkan kombinasi tanggal+jam+kolam — dipakai
  // buat dedupe riwayat gabungan & buat nemuin pasangan record pas mau dihapus.
  const penggantiKey = (p: Pick<JadwalPengganti, 'tanggal_asal' | 'tanggal_baru' | 'jam' | 'kolam'>) =>
    `${p.tanggal_asal}|${p.tanggal_baru}|${p.jam}|${p.kolam ?? ''}`

  // Ambil ulang slot jadwal + riwayat pengganti gabungan buat sekumpulan murid
  // (1 anak kalau solo, 2 anak kalau paket Adik Kakak). Riwayat dari semua anak
  // digabung & di-dedupe — karena entri pengganti selalu ditambahkan bareng ke
  // semua anak sekaligus, jadi cukup ditampilkan 1x per kombinasi tanggal/jam.
  const loadPenggantiData = async (members: Murid[]) => {
    const first = members[0]
    const [slots, historiesPerMember] = await Promise.all([
      getMuridJadwalByMurid(first.id),
      Promise.all(members.map((m) => getJadwalPenggantiByMurid(m.id))),
    ])
    setPenggantiSlotsMurid(slots)
    const seen = new Set<string>()
    const merged: JadwalPengganti[] = []
    historiesPerMember.flat().forEach((p) => {
      const key = penggantiKey(p)
      if (seen.has(key)) return
      seen.add(key)
      merged.push(p)
    })
    merged.sort((a, b) => b.tanggal_baru.localeCompare(a.tanggal_baru))
    setPenggantiHistory(merged)
  }

  const openPengganti = async (members: Murid[]) => {
    setPenggantiMurids(members)
    setShowPengganti(true)
    setPgSlotAsalKey(''); setPgTanggalAsal(''); setPgTanggalBaru(''); setPgSlotBaruKey(''); setPgKeterangan('')
    try {
      await loadPenggantiData(members)
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
    if (penggantiMurids.length === 0) return
    const slotAsal = penggantiSlotsMurid.find((s) => slotKey(s.hari, s.jam_mulai, s.kolam) === pgSlotAsalKey)
    if (!slotAsal) { showToast('Pilih jadwal asal yang mau diganti'); return }
    if (!pgTanggalAsal) { showToast('Isi tanggal yang mau di-skip'); return }
    if (!pgTanggalBaru) { showToast('Isi tanggal penggantinya'); return }
    const slotBaru = slotBaruOptions.find((s) => slotKey(s.hari, s.jam_mulai, s.kolam) === pgSlotBaruKey)
    if (!slotBaru) { showToast('Pilih jam pengganti dulu'); return }
    setPgSaving(true)
    try {
      // Berlaku buat SEMUA anak di grup ini sekaligus (paket Adik Kakak = 1 aksi utk 2 anak)
      for (const m of penggantiMurids) {
        await addJadwalPengganti({
          murid_id: m.id,
          tanggal_asal: pgTanggalAsal,
          tanggal_baru: pgTanggalBaru,
          jam: slotBaru.jam_mulai,
          kolam: slotBaru.kolam,
          keterangan: pgKeterangan.trim() || null,
        })
      }
      showToast('Jadwal pengganti disimpan ✓', 'success')
      await loadPenggantiData(penggantiMurids)
      setPgTanggalAsal(''); setPgTanggalBaru(''); setPgSlotBaruKey(''); setPgKeterangan('')
    } catch (e: any) {
      showToast('Gagal simpan: ' + e?.message, 'error')
    } finally {
      setPgSaving(false)
    }
  }

  const handleDeletePengganti = async (p: JadwalPengganti) => {
    const confirmMsg = penggantiMurids.length > 1
      ? 'Batalkan jadwal pengganti ini untuk KEDUA anak? Mereka balik ke jadwal asalnya di tanggal itu.'
      : 'Batalkan jadwal pengganti ini? Murid balik ke jadwal asalnya di tanggal itu.'
    if (!confirm(confirmMsg)) return
    try {
      const targetKey = penggantiKey(p)
      // Cari & hapus entri yang match di SEMUA anak grup ini (bukan cuma 1 record) —
      // karena setiap anak punya row jadwal_pengganti sendiri-sendiri di database.
      const historiesPerMember = await Promise.all(penggantiMurids.map((m) => getJadwalPenggantiByMurid(m.id)))
      const idsToDelete = historiesPerMember.flat().filter((x) => penggantiKey(x) === targetKey).map((x) => x.id)
      await Promise.all(idsToDelete.map((id) => deleteJadwalPengganti(id)))
      setPenggantiHistory((prev) => prev.filter((x) => penggantiKey(x) !== targetKey))
      showToast('Jadwal pengganti dibatalkan', 'success')
    } catch (e: any) {
      showToast('Gagal batalkan: ' + e?.message, 'error')
    }
  }

  const updateForm = (updates: Partial<typeof form>) => {
    setForm(prev => {
      const next = { ...prev, ...updates }
      // Mode edit group: harga = total keluarga yang dikelola manual, jangan ditimpa
      // otomatis pakai rumus harga 1 anak.
      if (!editingGroupIds) {
        next.harga = hitungHarga(hargaSetting, next.paket, next.kategori, next.jumlah_sesi)
      }
      return next
    })
    if (updates.jumlah_sesi) {
      const maxBaru = updates.jumlah_sesi === 8 ? 2 : 1
      setJadwalPilihan((prev) => prev.slice(0, maxBaru))
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const murid = await getMurid()
      setList(murid)
      loadPeriodeAll(murid)
    }
    catch (e: any) { showToast('Gagal load murid: ' + e?.message, 'error') }
    finally { setLoading(false) }
  }

  // Load masa berlaku semua murid paralel di background — tidak block render utama.
  // Untuk Adik Kakak: 1x query per kelompok, hasilnya di-share ke semua anggota.
  const loadPeriodeAll = async (murid: Murid[]) => {
    setLoadingPeriode(true)
    try {
      const seen = new Set<string>()
      const tasks: { ids: string[]; rep: Murid }[] = []
      murid.forEach((m) => {
        const key = m.kelompok_adik_kakak || m.id
        if (seen.has(key)) return
        seen.add(key)
        const members = m.kelompok_adik_kakak
          ? murid.filter((x) => x.kelompok_adik_kakak === key)
          : [m]
        tasks.push({ ids: members.map((x) => x.id), rep: members[0] })
      })
      const results = await Promise.allSettled(
        tasks.map((t) => getPeriodeBerjalan(
          t.rep.id,
          t.rep.paket,
          t.rep.jumlah_sesi ?? undefined,
          t.ids.filter((id) => id !== t.rep.id)  // extra ids = anggota lain di group
        ))
      )
      const map: Record<string, PeriodeInfo> = {}
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          tasks[i].ids.forEach((id) => { map[id] = r.value })
        }
      })
      setPeriodeMap(map)
    } catch { /* non-critical */ }
    finally { setLoadingPeriode(false) }
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

  // Gabungkan murid Adik Kakak jadi 1 "kartu keluarga" berdasarkan kelompok_adik_kakak
  // (= id registration asalnya). Ini murni tampilan — data Student di database TETAP
  // terpisah per anak (absensi, edit, hapus, semua tetap per anak seperti biasa).
  type MuridGroup = { key: string; members: Murid[] }
  const groupedFiltered = useMemo<MuridGroup[]>(() => {
    const byGroup: Record<string, Murid[]> = {}
    const solo: MuridGroup[] = []
    for (const m of filtered) {
      if (m.kelompok_adik_kakak) {
        (byGroup[m.kelompok_adik_kakak] ??= []).push(m)
      } else {
        solo.push({ key: m.id, members: [m] })
      }
    }
    const groups: MuridGroup[] = Object.entries(byGroup).map(([key, members]) => ({ key, members }))
    return [...groups, ...solo]
  }, [filtered])

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
    setEditingGroupIds(null)
    setGroupChildren([])
    setNewGroupChildren([
      { tempId: '1', nama: '', kategori: 'normal' },
      { tempId: '2', nama: '', kategori: 'normal' },
    ])
  }

  const openEdit = async (m: Murid) => {
    setEditingId(m.id)
    setEditingGroupIds(null)
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

  // Edit paket Adik Kakak sebagai 1 GROUP — 1 form buat jadwal/harga/WA/pemilik
  // yang dibagikan bersama, plus daftar nama+kategori per anak di dalamnya.
  const openEditGroup = async (members: Murid[]) => {
    setEditingId(null)
    setEditingGroupIds(members.map((m) => m.id))
    setGroupChildren(members.map((m) => ({ id: m.id, nama: m.nama, kategori: m.kategori })))
    const first = members[0]
    const pemilikMurid = first.pemilik || 'Ilham'
    setPakaiCustomPemilik(!PEMILIK_TETAP.includes(pemilikMurid))
    const totalHarga = members.reduce(
      (sum, m) => sum + (m.harga ?? hitungHarga(hargaSetting, m.paket, m.kategori, m.jumlah_sesi ?? 4)), 0
    )
    setForm({
      nama: members.map((m) => m.nama).join(' & '),
      paket: first.paket, wa_ortu: first.wa_ortu ?? '',
      kategori: first.kategori, jumlah_sesi: (first.jumlah_sesi as 4|8) ?? 4,
      jadwal_hari: first.jadwal_hari ?? '', jadwal_jam: first.jadwal_jam ?? '',
      jadwal_kolam: first.jadwal_kolam ?? KOLAM_PRESETS[0],
      harga: totalHarga,
      pemilik: pemilikMurid,
    })
    setShowAdd(true)
    try {
      const slots = await getMuridJadwalByMurid(first.id)
      setJadwalPilihan(slots.map((s) => ({ hari: s.hari, jam_mulai: s.jam_mulai, kolam: s.kolam ?? '' })))
    } catch {
      setJadwalPilihan([])
    }
  }

  const updateGroupChild = (id: string, updates: Partial<{ nama: string; kategori: 'normal' | 'abk' }>) => {
    setGroupChildren((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  const handleSave = async () => {
    if (jadwalPilihan.length === 0) { showToast('Pilih minimal 1 jadwal'); return }
    if (jadwalPilihan.length !== maxJadwal) { showToast(`Paket ${form.jumlah_sesi}x/bulan wajib pilih ${maxJadwal} jadwal`); return }
    if (pakaiCustomPemilik && !form.pemilik.trim()) { showToast('Isi dulu nama pemiliknya'); return }

    const jadwalHari = jadwalPilihan.map((s) => s.hari).join(', ')
    const jadwalJam = jadwalPilihan.map((s) => s.jam_mulai).join(', ')
    const jadwalKolam = jadwalPilihan.map((s) => s.kolam).join(', ')

    // ── Mode edit GROUP (paket Adik Kakak) — 1 form, update semua anak sekaligus ──
    if (editingGroupIds) {
      if (groupChildren.some((c) => !c.nama.trim())) { showToast('Nama semua anak harus diisi'); return }
      setSaving(true)
      try {
        const hargaPerAnak = Math.round(form.harga / groupChildren.length)
        for (const child of groupChildren) {
          await updateMurid(child.id, {
            nama: child.nama.trim(),
            paket: form.paket,
            wa_ortu: form.wa_ortu,
            kategori: child.kategori,
            jadwal_hari: jadwalHari, jadwal_jam: jadwalJam, jadwal_kolam: jadwalKolam,
            harga: hargaPerAnak,
            jumlah_sesi: form.jumlah_sesi,
            pemilik: form.pemilik,
          })
          await replaceMuridJadwal(child.id, jadwalPilihan)
        }
        showToast('Paket Adik Kakak diperbarui ✓', 'success')
        setShowAdd(false); resetForm(); load()
      } catch (e: any) {
        showToast('Gagal: ' + e?.message, 'error'); console.error(e)
      } finally { setSaving(false) }
      return
    }

    // ── Mode TAMBAH Adik Kakak baru ──
    if (isAddingAdikKakak) {
      if (newGroupChildren.some((c) => !c.nama.trim())) { showToast('Nama semua anak harus diisi'); return }
      setSaving(true)
      try {
        const hargaPerAnak = Math.round(form.harga / newGroupChildren.length)
        // Buat semua anak sekaligus, kumpulkan id mereka
        const muridIds: string[] = []
        for (const child of newGroupChildren) {
          const payload = {
            nama: child.nama.trim(),
            paket: form.paket,
            wa_ortu: form.wa_ortu,
            kategori: child.kategori,
            jadwal_hari: jadwalHari, jadwal_jam: jadwalJam, jadwal_kolam: jadwalKolam,
            harga: hargaPerAnak,
            jumlah_sesi: form.jumlah_sesi,
            pemilik: form.pemilik,
          }
          const newMurid = await addMurid(payload, jadwalPilihan)
          muridIds.push(newMurid.id)
        }
        // Set kelompok_adik_kakak ke id murid pertama (jadi semua anggota group punya link yg sama)
        const groupKey = muridIds[0]
        await Promise.all(muridIds.map((id) =>
          updateMurid(id, { kelompok_adik_kakak: groupKey })
        ))
        showToast(`Paket Adik Kakak ${newGroupChildren.map((c) => c.nama).join(' & ')} ditambahkan ✓`, 'success')
        setShowAdd(false); resetForm(); load()
      } catch (e: any) {
        showToast('Gagal: ' + e?.message, 'error'); console.error(e)
      } finally { setSaving(false) }
      return
    }

    // ── Mode solo (murid biasa / tambah baru) ──
    if (!form.nama.trim()) { showToast('Nama harus diisi'); return }
    setSaving(true)
    try {
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

  // Hapus SATU PAKET Adik Kakak sekaligus — kedua anak terhapus bareng, bukan satu-satu.
  const handleDeleteGroup = async (members: Murid[]) => {
    const namaGabungan = members.map((m) => m.nama).join(' & ')
    if (!confirm(`Hapus paket Adik Kakak "${namaGabungan}"? Kedua anak akan terhapus sekaligus.`)) return
    try {
      await Promise.all(members.map((m) => deleteMurid(m.id)))
      showToast(`${namaGabungan} dihapus`)
      load()
    } catch (e: any) {
      showToast('Gagal hapus: ' + e?.message, 'error')
    }
  }

  // ── PeriodeBadge — info sisa hari masa berlaku paket ─────────────────────
  const PeriodeBadge = ({ muridId }: { muridId: string }) => {
    const info = periodeMap[muridId]
    if (!info && loadingPeriode) return <div className="text-[10px] text-text-muted animate-pulse mt-0.5">memuat...</div>
    if (!info) return null

    if (info.isExpired) {
      return (
        <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-red bg-red/10 px-2 py-0.5 rounded-full w-fit">
          <i className="ti ti-clock-x text-[10px]" />Masa berlaku habis
        </div>
      )
    }

    const sisa = info.sisaHari
    let color = 'text-green bg-green/10'
    if (sisa <= 3)  color = 'text-red bg-red/10'
    else if (sisa <= 7)  color = 'text-orange-500 bg-orange-50'
    else if (sisa <= 14) color = 'text-yellow bg-yellow/10'

    const label = sisa <= 3 ? `Hangus dalam ${sisa} hari` : `Sisa ${sisa} hari`

    return (
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${color}`}>
          <i className="ti ti-calendar-clock text-[10px]" />{label}
        </div>
        <span className="text-[10px] text-text-muted">
          {info.jumlahHadir}/{info.jumlahTarget} hadir
          {info.jumlahSakit > 0 && <span className="ml-1 text-purple-500">+{info.jumlahSakit * 7}hr (sakit)</span>}
        </span>
      </div>
    )
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
        {groupedFiltered.map((g) => {
          if (g.members.length === 1) {
            const m = g.members[0]
            return (
              <div key={g.key} className="bg-bg border border-border rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm">
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
                  <PeriodeBadge muridId={m.id} />
                </div>
                <div className="flex items-center gap-1.5">
                  {m.wa_ortu && (
                    <a href={`https://wa.me/62${m.wa_ortu.replace(/^0/, '')}`} target="_blank"
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-[#E6F1FB] text-blue hover:bg-blue hover:text-white transition-all">
                      <i className="ti ti-brand-whatsapp text-base" />
                    </a>
                  )}
                  <button onClick={() => openPengganti([m])}
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
            )
          }

          // ── Kartu Keluarga (Adik Kakak) — 1 ENTITAS: semua aksi (WA, Ganti Jadwal,
          // Edit, Hapus) berlaku buat seluruh paket sekaligus, bukan per anak. Data
          // Student tetap 2 record di database (buat absensi & identitas per anak).
          const namaGabungan = g.members.map((m) => m.nama).join(' & ')
          const totalHarga = g.members.reduce((sum, m) => sum + (m.harga ?? hitungHarga(hargaSetting, m.paket, m.kategori, m.jumlah_sesi ?? 4)), 0)
          const first = g.members[0]
          return (
            <div key={g.key} className="bg-bg border border-border rounded-lg px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3 mb-2.5">
                <Avatar nama={namaGabungan} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-[14px] font-semibold text-text truncate">{namaGabungan}</div>
                    <span className="bg-blue-light text-blue text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {g.members.length} anak
                    </span>
                  </div>
                  <div className="text-[12px] text-text-muted">{first.paket} · {first.jumlah_sesi ?? 4}x/bulan</div>
                  <div className="text-[12px] font-semibold text-blue mt-0.5">{fmtRupiah(totalHarga)}/bulan</div>
                  {first.jadwal_hari && (
                    <div className="text-[11px] text-blue/70 mt-0.5 flex items-center gap-1">
                      <i className="ti ti-calendar-time text-[11px]" />
                      {first.jadwal_hari} {first.jadwal_jam} · {first.jadwal_kolam}
                    </div>
                  )}
                  {/* PeriodeBadge 1x untuk whole group — pakai first.id karena semua anggota share info yang sama */}
                  <PeriodeBadge muridId={first.id} />
                </div>
                {/* Aksi GROUP — 1 tombol berlaku buat seluruh paket, bukan per anak */}
                <div className="flex items-center gap-1.5">
                  {first.wa_ortu && (
                    <a href={`https://wa.me/62${first.wa_ortu.replace(/^0/, '')}`} target="_blank"
                      title="WhatsApp orang tua"
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-[#E6F1FB] text-blue hover:bg-blue hover:text-white transition-all">
                      <i className="ti ti-brand-whatsapp text-base" />
                    </a>
                  )}
                  <button onClick={() => openPengganti(g.members)}
                    title="Ganti Jadwal Minggu Ini — berlaku utk semua anak"
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-yellow/10 text-text-muted hover:text-yellow transition-all">
                    <i className="ti ti-calendar-repeat text-base" />
                  </button>
                  <button onClick={() => openEditGroup(g.members)}
                    title="Edit paket (1 form utk semua anak)"
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue/10 text-text-muted hover:text-blue transition-all">
                    <i className="ti ti-edit text-base" />
                  </button>
                  <button onClick={() => handleDeleteGroup(g.members)}
                    title="Hapus paket (kedua anak sekaligus)"
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red/10 text-text-muted hover:text-red transition-all">
                    <i className="ti ti-trash text-base" />
                  </button>
                </div>
              </div>

              {/* Daftar anak — display-only, bukan tempat aksi (aksi ada di atas, level group) */}
              <div className="border-t border-border pt-2 flex flex-wrap gap-1.5">
                {g.members.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1 bg-bg-2 text-text text-[11px] font-medium px-2 py-1 rounded-md">
                    <i className="ti ti-user text-[10px] text-text-muted" />
                    {m.nama}
                    {m.kategori === 'abk' && <span className="text-yellow font-semibold">· ABK</span>}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <i className="ti ti-users text-4xl block mb-2 opacity-40" />
          <p className="text-sm">{search || filterHari ? 'Murid tidak ditemukan' : 'Belum ada murid aktif'}</p>
        </div>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm() }}
        title={editingGroupIds ? 'Edit Paket Adik Kakak' : isAddingAdikKakak ? 'Tambah Paket Adik Kakak' : editingId ? 'Edit Murid' : 'Tambah Murid Baru'}>
        <div className="flex flex-col gap-3">

          {/* ── Section nama: berbeda tergantung mode ── */}
          {editingGroupIds ? (
            // Edit group existing
            <div className="bg-blue-light/40 border border-blue/10 rounded-lg p-3">
              <div className="text-[12px] font-semibold text-blue mb-2">Nama & kategori tiap anak</div>
              <div className="flex flex-col gap-2">
                {groupChildren.map((c, idx) => (
                  <div key={c.id} className="flex gap-2 items-center">
                    <input type="text" placeholder={`Nama anak ${idx + 1}`} value={c.nama}
                      onChange={(e) => updateGroupChild(c.id, { nama: e.target.value })}
                      className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
                    <div className="flex gap-1 flex-shrink-0">
                      {(['normal', 'abk'] as const).map((k) => (
                        <button key={k} onClick={() => updateGroupChild(c.id, { kategori: k })}
                          className={`px-2.5 py-2 rounded-md border text-[11px] font-medium transition-all ${c.kategori === k
                            ? k === 'abk' ? 'bg-yellow/10 border-yellow text-yellow' : 'bg-blue-light border-blue text-blue'
                            : 'border-border text-text-muted'}`}>
                          {k === 'abk' ? 'ABK' : 'Normal'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-blue/70 mt-2">
                Jadwal, harga, WA, dan pemilik di bawah berlaku sama buat semua anak di paket ini.
              </div>
            </div>
          ) : isAddingAdikKakak ? (
            // Tambah group baru
            <div className="bg-blue-light/40 border border-blue/10 rounded-lg p-3">
              <div className="text-[12px] font-semibold text-blue mb-2">Nama & kategori tiap anak</div>
              <div className="flex flex-col gap-2">
                {newGroupChildren.map((c, idx) => (
                  <div key={c.tempId} className="flex gap-2 items-center">
                    <input type="text" placeholder={`Nama anak ${idx + 1}`} value={c.nama}
                      onChange={(e) => updateNewGroupChild(c.tempId, { nama: e.target.value })}
                      className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
                    <div className="flex gap-1 flex-shrink-0">
                      {(['normal', 'abk'] as const).map((k) => (
                        <button key={k} onClick={() => updateNewGroupChild(c.tempId, { kategori: k })}
                          className={`px-2.5 py-2 rounded-md border text-[11px] font-medium transition-all ${c.kategori === k
                            ? k === 'abk' ? 'bg-yellow/10 border-yellow text-yellow' : 'bg-blue-light border-blue text-blue'
                            : 'border-border text-text-muted'}`}>
                          {k === 'abk' ? 'ABK' : 'Normal'}
                        </button>
                      ))}
                    </div>
                    {newGroupChildren.length > 2 && (
                      <button onClick={() => removeNewGroupChild(c.tempId)}
                        className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-red/10 text-text-muted hover:text-red transition-all">
                        <i className="ti ti-x text-sm" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {newGroupChildren.length < 5 && (
                <button onClick={addNewGroupChild}
                  className="mt-2 flex items-center gap-1.5 text-[11px] text-blue hover:text-blue/80 font-medium transition-all">
                  <i className="ti ti-plus text-[11px]" />Tambah anak
                </button>
              )}
              <div className="text-[11px] text-blue/70 mt-2">
                Jadwal, harga, WA, dan pemilik di bawah berlaku sama buat semua anak di paket ini.
              </div>
            </div>
          ) : (
            // Solo murid biasa
            <div>
              <label className="text-[12px] text-text-muted block mb-1">Nama murid</label>
              <input type="text" placeholder="Nama lengkap" value={form.nama}
                onChange={(e) => updateForm({ nama: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
            </div>
          )}

          <div>
            <label className="text-[12px] text-text-muted block mb-1">No. WA orang tua</label>
            <input type="tel" placeholder="08xxxxxxxxxx" value={form.wa_ortu}
              onChange={(e) => updateForm({ wa_ortu: e.target.value })}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg text-text" />
          </div>

          {editingGroupIds ? (
            <div>
              <label className="text-[12px] text-text-muted block mb-1">Paket</label>
              <div className="border border-border rounded-md px-3 py-2 text-[13px] text-text bg-bg-2">
                {form.paket} <span className="text-text-muted text-[11px]">(tipe paket gak bisa diubah dari sini)</span>
              </div>
            </div>
          ) : (
          <div>
            <label className="text-[12px] text-text-muted block mb-1.5">Paket</label>
            <div className="flex gap-2">
              {(['Semi Privat', 'Eksklusif', 'Adik Kakak'] as const).map((p) => (
                <button key={p} onClick={() => updateForm({ paket: p })}
                  className={`flex-1 py-2 rounded-md border text-[12px] font-medium transition-all ${form.paket === p ? 'bg-blue-light border-blue text-blue' : 'border-border text-text-muted'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          )}

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

          {!editingGroupIds && !isAddingAdikKakak && (
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
          )}

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
              <div className="text-[11px] text-text-muted">
                {(editingGroupIds || isAddingAdikKakak)
                  ? `Harga total/bulan (${editingGroupIds ? groupChildren.length : newGroupChildren.length} anak)`
                  : 'Harga/bulan'}
              </div>
              <div className="text-[10px] text-blue/60">
                {editingGroupIds ? `${form.paket} · ${form.jumlah_sesi}x` : `${form.paket} · ${form.jumlah_sesi}x · ${form.kategori === 'abk' ? 'ABK' : 'Normal'}`}
              </div>
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
            <div className="text-[10px] text-blue/50 mt-1">
              {(editingGroupIds || isAddingAdikKakak)
                ? `Harga total keluarga — dibagi rata jadi Rp ${Math.round(form.harga / Math.max(1, editingGroupIds ? groupChildren.length : newGroupChildren.length)).toLocaleString('id-ID')}/anak saat disimpan.`
                : 'Harga otomatis dari paket. Bisa diubah manual jika ada harga khusus.'}
            </div>
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
            {saving ? 'Menyimpan...' : (editingGroupIds ? 'Simpan Perubahan Paket' : isAddingAdikKakak ? 'Tambah Paket Adik Kakak' : editingId ? 'Simpan Perubahan' : 'Tambah Murid')}
          </button>
        </div>
      </Modal>

      <Modal open={showPengganti} onClose={() => setShowPengganti(false)}
        title={`Ganti Jadwal Minggu Ini${penggantiMurids.length ? ` — ${penggantiMurids.map((m) => m.nama).join(' & ')}` : ''}`}>
        <div className="flex flex-col gap-3">
          <div className="text-[12px] text-text-muted -mt-1">
            {penggantiMurids.length > 1
              ? 'Jadwal tetap kedua anak gak berubah. Ini cuma buat 1x pengecualian yang berlaku ke keduanya — minggu depan otomatis balik ke jadwal aslinya.'
              : 'Jadwal tetap murid gak berubah. Ini cuma buat 1x pengecualian — minggu depan otomatis balik ke jadwal aslinya.'}
          </div>

          {penggantiSlotsMurid.length === 0 ? (
            <div className="text-center py-4 text-text-muted text-[12px]">
              Belum ada jadwal tetap. Atur dulu jadwalnya lewat tombol Edit.
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