import { useState, useEffect } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle, Clock, UserX, LogOut, Pencil } from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs, updateDoc, doc, getDoc, writeBatch } from "firebase/firestore";

const jenisColor = {
  "Tidak Hadir": { bg: "#F8D7DA", color: "#842029" },
  "Scan Tidak Lengkap": { bg: "#E8D5F5", color: "#6B21A8" },
};

const jenisIcon = {
  "Tidak Hadir": <UserX size={12} />,
  "Scan Tidak Lengkap": <AlertTriangle size={12} />,
};

export default function Anomali() {
  const [anomaliData, setAnomaliData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("reguler");
  const [expandedKaryawan, setExpandedKaryawan] = useState(null);
  const [filterNama, setFilterNama] = useState("");
  const [selectedPeriode, setSelectedPeriode] = useState("");
  const [allPeriods, setAllPeriods] = useState([]);
  const [monthPrefix, setMonthPrefix] = useState("");
  const [filterJenis, setFilterJenis] = useState("semua");
  const [editData, setEditData] = useState(null);
  const [editForm, setEditForm] = useState({ keterangan: "", jamTambahan: "" });

  const fetchAnomali = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Config
      const configSnap = await getDoc(doc(db, "config", "global"));
      const configData = configSnap.exists() ? configSnap.data() : {};
      const activeP = configData.periodeAktif || "";
      const pList = (configData.periodeList || [])
        .map(p => typeof p === "string" ? p : p.name)
        .filter(Boolean);
      setAllPeriods(pList);

      const targetP = selectedPeriode || activeP;
      if (!selectedPeriode && activeP) setSelectedPeriode(activeP);

      let prefix = "";
      if (targetP) {
        const [bulan, tahun] = targetP.split(" ");
        const bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const bulanIndex = bulanIndo.indexOf(bulan) + 1;
        prefix = (bulanIndex > 0 && tahun) ? `${tahun}-${bulanIndex.toString().padStart(2, "0")}` : "";
        setMonthPrefix(prefix);
      }

      // 2. Fetch Anomali, Karyawan & Izin secara paralel
      const [snapshot, karyawanSnap, izinSnap] = await Promise.all([
        getDocs(collection(db, "anomali")),
        getDocs(collection(db, "karyawan")),
        getDocs(collection(db, "izin")),
      ]);

      const rawAnomali = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const karyawanData = karyawanSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const izinList = izinSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 3a. Migrasi data lama: status non-standar ("cuti", "izin", dll) → "dikonfirmasi"
      const STATUS_VALID = ["belum", "dikonfirmasi"];
      const migrasiMap = {};
      const toMigrasi = [];

      for (const a of rawAnomali) {
        if (STATUS_VALID.includes(a.status)) continue;
        // status lama (mis. "cuti") SELALU jadi keterangan (alasan konfirmasi)
        const keteranganBaru = a.status || a.keterangan;
        migrasiMap[a.id] = { status: "dikonfirmasi", keterangan: keteranganBaru };
        toMigrasi.push({ id: a.id, keterangan: keteranganBaru });
      }

      // 3b. Auto-validasi: cek anomali "belum" yang cocok dengan data izin
      const autoConfirmMap = { ...migrasiMap };
      const toUpdate = [...toMigrasi];

      for (const a of rawAnomali) {
        if (a.status !== "belum") continue;
        const normId = a.userId?.toString()?.replace(/^0+/, "");

        const matchingIzin = izinList.find(iz => {
          const sameUser = iz.userId?.toString()?.replace(/^0+/, "") === normId;
          if (!sameUser) return false;
          const mulai = iz.tglMulai || iz.tanggal;
          const selesai = iz.tglSelesai || mulai;
          return mulai && selesai && a.tanggal >= mulai && a.tanggal <= selesai;
        });

        if (matchingIzin) {
          const keterangan = matchingIzin.jenis || "Izin";
          autoConfirmMap[a.id] = { status: "dikonfirmasi", keterangan };
          toUpdate.push({ id: a.id, keterangan });
        }
      }

      // Batch update Firestore (migrasi + auto-validasi)
      if (toUpdate.length > 0) {
        const batch = writeBatch(db);
        toUpdate.forEach(({ id, keterangan }) => {
          batch.update(doc(db, "anomali", id), { status: "dikonfirmasi", keterangan });
        });
        await batch.commit();
      }

      // 4. Terapkan hasil auto-validasi ke data in-memory
      const updatedRaw = rawAnomali.map(a =>
        autoConfirmMap[a.id] ? { ...a, ...autoConfirmMap[a.id] } : a
      );

      const data = updatedRaw
        .map(a => {
          const k = karyawanData.find(emp => 
            emp.userId?.toString()?.trim()?.replace(/^0+/, "") === a.userId?.toString()?.trim()?.replace(/^0+/, "")
          );
          return { ...a, k };
        })
        .filter(a => 
          a.k && a.k.status !== "arsip" &&
          (a.jenis === "Tidak Hadir" || a.jenis === "Scan Tidak Lengkap") &&
          (prefix ? a.tanggal?.startsWith(prefix) : true)
        )
        .map(a => {
          const tipe = a.k.tipe || "tetap";
          const nama = a.k.nama || a.nama;
          const dept = a.k.dept || a.dept;
          delete a.k;
          return { ...a, tipe, nama, dept };
        });

      setAnomaliData(data);
    } catch (err) {
      console.error("Anomali Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnomali(); }, [selectedPeriode]);

  // Helper: konfirmasi SEMUA anomali dalam rentang izin multi-hari
  const autoKonfirmasiByIzin = async (userId, tanggal, keterangan) => {
    try {
      const normalizedUserId = userId?.toString()?.replace(/^0+/, "");

      // Ambil semua izin milik user ini
      const izinSnap = await getDocs(collection(db, "izin"));
      const izinList = izinSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Cari izin yang mencakup tanggal anomali ini
      const matchingIzin = izinList.find(iz => {
        const sameUser = iz.userId?.toString()?.replace(/^0+/, "") === normalizedUserId;
        if (!sameUser) return false;
        const mulai = iz.tglMulai || iz.tanggal;
        const selesai = iz.tglSelesai || mulai;
        return tanggal >= mulai && tanggal <= selesai;
      });

      // Hanya lanjut jika izin lebih dari 1 hari
      if (!matchingIzin || !matchingIzin.tglSelesai || matchingIzin.tglSelesai === matchingIzin.tglMulai) return;

      const tglMulai = matchingIzin.tglMulai;
      const tglSelesai = matchingIzin.tglSelesai;

      // Ambil semua anomali user ini dalam rentang tanggal tersebut yang belum dikonfirmasi
      const snapshot = await getDocs(collection(db, "anomali"));
      const anomalisInRange = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a =>
          a.userId?.toString()?.replace(/^0+/, "") === normalizedUserId &&
          a.tanggal >= tglMulai &&
          a.tanggal <= tglSelesai &&
          a.status === "belum"
        );

      if (anomalisInRange.length === 0) return;

      const batch = writeBatch(db);
      anomalisInRange.forEach(a => {
        batch.update(doc(db, "anomali", a.id), {
          status: "dikonfirmasi",
          keterangan: keterangan || matchingIzin.jenis || "",
        });
      });
      await batch.commit();
    } catch (err) {
      console.error("autoKonfirmasiByIzin error:", err);
    }
  };


  const handleKonfirmasi = async (id) => {
    const target = anomaliData.find(a => a.id === id);
    await updateDoc(doc(db, "anomali", id), { status: "dikonfirmasi" });
    // Auto-konfirmasi anomali lain dalam rentang izin multi-hari
    if (target) await autoKonfirmasiByIzin(target.userId, target.tanggal, target.keterangan);
    fetchAnomali();
  };

  const handleEdit = (a) => {
    setEditData(a);
    setEditForm({ keterangan: a.keterangan || "", jamTambahan: "" });
  };

  const handleSimpanEdit = async () => {
  if (!editData) return;

  const updateData = {
    keterangan: editForm.keterangan,
    status: "dikonfirmasi",
  };

  // Khusus Scan Tidak Lengkap dengan jam tambahan
  if (editData.jenis === "Scan Tidak Lengkap" && editForm.jamTambahan) {
    const hanyaMasuk = editData.keterangan.includes("scan masuk");
    updateData.keterangan = hanyaMasuk
      ? `Masuk: ${editData.keterangan.match(/\d{2}:\d{2}/)?.[0]} | Keluar: ${editForm.jamTambahan} (diisi manual)`
      : `Masuk: ${editForm.jamTambahan} (diisi manual) | Keluar: ${editData.keterangan.match(/\d{2}:\d{2}/)?.[0]}`;

    // Update data absensi di Firebase
    const absensiSnap = await getDocs(collection(db, "absensi"));
    const absensiDoc = absensiSnap.docs.find(d =>
      d.data().userId.toString() === editData.userId.toString() &&
      d.data().periode === editData.periode
    );

    if (absensiDoc) {
      const absensiData = absensiDoc.data();
      const updatedDailyData = absensiData.dailyData.map(day => {
        // Cocokkan tanggal — format "DD NamaHari" vs "YYYY-MM-DD"
        const tgl = editData.tanggal.split("-")[2]; // ambil DD dari "2026-02-16"
        if (!day.tanggal.startsWith(tgl)) return day;

        if (hanyaMasuk) {
          return { ...day, jamKeluarPagi: editForm.jamTambahan };
        } else {
          return { ...day, jamMasukPagi: editForm.jamTambahan };
        }
      });

      // Hitung ulang rekap
      let totalJamKerja = 0;
      let totalJamLembur = 0;
      let hariHadir = 0;
      let hariTidakHadir = 0;

      for (const day of updatedDailyData) {
        const adaAbsen = day.jamMasukPagi || day.jamKeluarPagi;
        if (adaAbsen) {
          hariHadir++;
          const [mH, mM] = (day.jamMasukPagi || "00:00").split(":").map(Number);
          const [kH, kM] = (day.jamKeluarPagi || "00:00").split(":").map(Number);
          const jam = ((kH * 60 + kM) - (mH * 60 + mM)) / 60;
          if (jam > 0) totalJamKerja += jam;

          if (day.jamMasukLembur && day.jamKeluarLembur) {
            const [lmH, lmM] = day.jamMasukLembur.split(":").map(Number);
            const [lkH, lkM] = day.jamKeluarLembur.split(":").map(Number);
            const jamLembur = ((lkH * 60 + lkM) - (lmH * 60 + lmM)) / 60;
            if (jamLembur > 0) totalJamLembur += jamLembur;
          }
        } else {
          hariTidakHadir++;
        }
      }

      await updateDoc(doc(db, "absensi", absensiDoc.id), {
        dailyData: updatedDailyData,
        rekap: {
          totalJamKerja: Math.round(totalJamKerja * 100) / 100,
          totalJamLembur: Math.round(totalJamLembur * 100) / 100,
          hariHadir,
          hariTidakHadir,
        }
      });
    }
  }

  await updateDoc(doc(db, "anomali", editData.id), updateData);

  // Auto-konfirmasi anomali lain dalam rentang izin multi-hari
  await autoKonfirmasiByIzin(editData.userId, editData.tanggal, editForm.keterangan);

  setEditData(null);
  fetchAnomali();
};

  // Filter by Tab
  const tabType = activeTab === "reguler" ? "tetap" : "freelance";
  let filteredData = anomaliData.filter(a => a.tipe === tabType);

  // Group anomali per karyawan
  const grouped = filteredData.reduce((acc, a) => {
    const key = a.userId;
    if (!acc[key]) {
      acc[key] = { userId: a.userId, nama: a.nama, dept: a.dept, anomalis: [] };
    }
    acc[key].anomalis.push(a);
    return acc;
  }, {});

  let groupedList = Object.values(grouped);
  if (filterNama) {
    groupedList = groupedList.filter(k =>
      k.nama?.toLowerCase().includes(filterNama.toLowerCase())
    );
  }
  
  if (filterJenis !== "semua") {
    groupedList = groupedList
      .map(k => ({ ...k, anomalis: k.anomalis.filter(a => a.jenis === filterJenis) }))
      .filter(k => k.anomalis.length > 0);
  }

  groupedList.sort((a, b) => {
    const idA = Number(a.userId) || 0;
    const idB = Number(b.userId) || 0;
    return idA - idB;
  });

  const totalBelum = filteredData.filter(a => a.status === "belum").length;
  const totalTidakHadir = filteredData.filter(a => a.jenis === "Tidak Hadir").length;
  const totalScanTidakLengkap = filteredData.filter(a => a.jenis === "Scan Tidak Lengkap").length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#6F4E37" }}>Pengecekan Anomali</h2>
          <p className="text-xs mt-1" style={{ color: "#A67B5B" }}>
            Periode: {selectedPeriode || "-"} · {activeTab === "reguler" ? "Reguler" : "Freelance"}
          </p>
        </div>
        <div className="flex gap-3">

          <input
            type="text"
            placeholder="Cari nama..."
            value={filterNama}
            onChange={e => setFilterNama(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none w-40"
            style={{ border: "1px solid #ECB176", color: "#6F4E37", backgroundColor: "white" }}
          />

          <select 
            value={selectedPeriode}
            onChange={(e) => setSelectedPeriode(e.target.value)}
            className="bg-white border border-[#ECB176] text-[#6F4E37] rounded-lg px-3 py-1.5 text-sm outline-none"
          >
            <option value="" disabled>Pilih Periode</option>
            {allPeriods.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: "reguler", label: "Karyawan Reguler" },
          { id: "freelance", label: "Pekerja Freelance" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: activeTab === tab.id ? "#6F4E37" : "white",
              color: activeTab === tab.id ? "#FED8B1" : "#A67B5B",
              border: "1px solid #ECB176"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Belum Dikonfirmasi", value: totalBelum, bg: "#6F4E37", color: "#FED8B1" },
          { label: "Tidak Hadir", value: totalTidakHadir, bg: "#F8D7DA", color: "#842029" },
          { label: "Scan Tidak Lengkap", value: totalScanTidakLengkap, bg: "#E8D5F5", color: "#6B21A8" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl p-4" style={{ backgroundColor: s.bg }}>
            <p className="text-xs font-medium" style={{ color: s.color, opacity: 0.8 }}>{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Jenis - Di bawah Stats */}
      <div className="flex justify-start">        <select
          value={filterJenis}
          onChange={e => setFilterJenis(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm outline-none border transition-all"
          style={{ border: "1px solid #ECB176", color: "#6F4E37", backgroundColor: "white" }}
        >
          <option value="semua">Semua Jenis</option>
          <option value="Tidak Hadir">Tidak Hadir</option>
          <option value="Scan Tidak Lengkap">Scan Tidak Lengkap</option>
        </select>
      </div>


      {/* Modal Edit */}
      {editData && (
  <div className="fixed inset-0 z-50 flex items-center justify-center"
    style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
      <h3 className="text-lg font-bold mb-1" style={{ color: "#6F4E37" }}>Edit Anomali</h3>
      <p className="text-xs mb-4" style={{ color: "#A67B5B" }}>
        {editData.nama} · {editData.tanggal} · {editData.jenis}
      </p>

      <div className="space-y-4">

        {/* Pilihan Jenis Izin */}
        <div>
          <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>
            Alasan (pilih salah satu)
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {["Izin", "Sakit", "Izin Terlambat", "Izin 2 Jam", "Cuti"].map(j => (
              <button
                key={j}
                onClick={() => setEditForm({ ...editForm, keterangan: j })}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  backgroundColor: editForm.keterangan === j ? "#6F4E37" : "#FED8B1",
                  color: editForm.keterangan === j ? "#FED8B1" : "#6F4E37",
                  border: "1px solid #ECB176"
                }}
              >
                {j}
              </button>
            ))}
            {/* Tombol clear pilihan */}
            {editForm.keterangan && (
              <button
                onClick={() => setEditForm({ ...editForm, keterangan: "" })}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: "#F8D7DA", color: "#842029", border: "1px solid #f5c6cb" }}
              >
                ✕ Kosongkan
              </button>
            )}
          </div>
        </div>

        {/* Input jam khusus Scan Tidak Lengkap */}
        {editData.jenis === "Scan Tidak Lengkap" && (
  <div>
    <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>
      {editData.keterangan.includes("scan masuk")
        ? "Input Jam Keluar (Manual)"
        : "Input Jam Masuk (Manual)"}
    </label>
    <div className="flex gap-2 mt-1">
      <input
        type="time"
        value={editForm.jamTambahan}
        onChange={e => setEditForm({ ...editForm, jamTambahan: e.target.value })}
        className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
        style={{ border: "1px solid #ECB176", color: "#6F4E37" }}
      />
      {/* Shortcut buttons */}
      {["08:00", "12:00", "16:00"].map(jam => (
        <button
          key={jam}
          onClick={() => setEditForm({ ...editForm, jamTambahan: jam })}
          className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: editForm.jamTambahan === jam ? "#6F4E37" : "#FED8B1",
            color: editForm.jamTambahan === jam ? "#FED8B1" : "#6F4E37",
            border: "1px solid #ECB176"
          }}
        >
          {jam}
        </button>
      ))}
    </div>
  </div>
)}

        <p className="text-xs" style={{ color: "#A67B5B" }}>
          ⚠️ Setelah disimpan status anomali akan otomatis dikonfirmasi
        </p>
      </div>

      <div className="flex gap-2 mt-5">
        <button
          onClick={() => setEditData(null)}
          className="flex-1 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: "#FED8B1", color: "#6F4E37" }}
        >
          Batal
        </button>
        <button
          onClick={handleSimpanEdit}
          className="flex-1 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}
        >
          Simpan & Konfirmasi
        </button>
      </div>
    </div>
  </div>
)}

      {/* List per Karyawan */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto"
            style={{ borderColor: "#ECB176", borderTopColor: "#6F4E37" }} />
          <p className="mt-3 text-sm" style={{ color: "#A67B5B" }}>Memuat data...</p>
        </div>
      ) : groupedList.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <AlertTriangle size={40} className="mx-auto mb-3" style={{ color: "#ECB176" }} />
          <p className="font-semibold" style={{ color: "#6F4E37" }}>Tidak ada anomali ditemukan</p>
          <p className="text-sm mt-1" style={{ color: "#A67B5B" }}>Upload file absensi untuk mendeteksi anomali</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedList.map(k => {
            const belum = k.anomalis.filter(a => a.status === "belum").length;
            const isExpanded = expandedKaryawan === k.userId;

            return (
              <div key={k.userId} className="bg-white rounded-xl shadow-sm overflow-hidden">

                {/* Header Karyawan */}
                <button
                  onClick={() => setExpandedKaryawan(isExpanded ? null : k.userId)}
                  className="w-full flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                      style={{ backgroundColor: "#ECB176", color: "#6F4E37" }}>
                      {k.nama?.[0]?.toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm" style={{ color: "#6F4E37" }}>{k.nama}</p>
                      <p className="text-xs" style={{ color: "#A67B5B" }}>{k.dept} · {k.anomalis.length} anomali</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {belum > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: "#FFF3CD", color: "#856404" }}>
                        {belum} belum dikonfirmasi
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: "#d4edda", color: "#155724" }}>
                        ✓ Semua dikonfirmasi
                      </span>
                    )}
                    {isExpanded
                      ? <ChevronUp size={16} style={{ color: "#A67B5B" }} />
                      : <ChevronDown size={16} style={{ color: "#A67B5B" }} />}
                  </div>
                </button>

                {/* Detail Anomali */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid #FED8B1" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: "#fffaf5" }}>
                          <th className="px-5 py-2.5 text-left text-xs font-medium" style={{ color: "#A67B5B" }}>Tanggal</th>
                          <th className="px-5 py-2.5 text-left text-xs font-medium" style={{ color: "#A67B5B" }}>Jenis</th>
                          <th className="px-5 py-2.5 text-left text-xs font-medium" style={{ color: "#A67B5B" }}>Keterangan</th>
                          <th className="px-5 py-2.5 text-center text-xs font-medium" style={{ color: "#A67B5B" }}>Status</th>
                          <th className="px-5 py-2.5 text-center text-xs font-medium" style={{ color: "#A67B5B" }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {k.anomalis
                          .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal))
                          .map((a) => (
                            <tr key={a.id} style={{ borderTop: "1px solid #FED8B1" }}>
                              <td className="px-5 py-2.5 text-xs" style={{ color: "#6F4E37" }}>{a.tanggal}</td>
                              <td className="px-5 py-2.5">
                                <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit"
                                  style={jenisColor[a.jenis]}>
                                  {jenisIcon[a.jenis]}
                                  {a.jenis}
                                </span>
                              </td>
                              <td className="px-5 py-2.5 text-xs" style={{ color: "#A67B5B" }}>{a.keterangan}</td>
                              <td className="px-5 py-2.5 text-center">
                                <span className="px-2 py-1 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: a.status === "belum" ? "#fff3cd" : "#d4edda",
                                    color: a.status === "belum" ? "#856404" : "#155724"
                                  }}>
                                  {a.status === "belum" ? "Belum" : "dikonfirmasi"}
                                </span>
                              </td>
                              <td className="px-5 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {a.status === "belum" && (
                                    <button
                                      onClick={() => handleKonfirmasi(a.id)}
                                      className="p-1.5 rounded-lg"
                                      style={{ backgroundColor: "#d4edda", color: "#155724" }}
                                    >
                                      <CheckCircle size={14} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleEdit(a)}
                                    className="p-1.5 rounded-lg"
                                    style={{ backgroundColor: "#FED8B1", color: "#6F4E37" }}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}