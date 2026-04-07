import { useState, useEffect } from "react";
import { DollarSign, ChevronDown, ChevronUp, Search } from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { exportRekapAbsen } from "../utils/exportExcel";
import { exportRekapGaji } from "../utils/exportPDF";

export default function Gaji() {
  const [absensiData, setAbsensiData] = useState([]);
  const [karyawanData, setKaryawanData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterPeriode, setFilterPeriode] = useState("semua");

  const fetchData = async () => {
    setLoading(true);

    const absensiSnap = await getDocs(collection(db, "absensi"));
    const absensi = absensiSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const karyawanSnap = await getDocs(collection(db, "karyawan"));
    const karyawan = karyawanSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    setAbsensiData(absensi);
    setKaryawanData(karyawan);
    setLoading(false);
  };

  const handleExportAbsen = async () => {
  // Cek anomali belum dikonfirmasi
  const anomaliSnap = await getDocs(collection(db, "anomali"));
  const anomali = anomaliSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const belumKonfirmasi = anomali.filter(a => 
    a.status === "belum" && 
    (a.jenis === "Tidak Hadir" || a.jenis === "Scan Tidak Lengkap")
  );

  if (belumKonfirmasi.length > 0) {
    alert(`⚠️ Masih ada ${belumKonfirmasi.length} anomali "Tidak Hadir" atau "Scan Tidak Lengkap" yang belum dikonfirmasi!\n\nSilakan konfirmasi dulu di halaman Anomali.`);
    return;
  }

  // Export Excel
  await exportRekapAbsen(absensiData);

  // Auto delete
  if (confirm("Data absensi & anomali akan dihapus setelah export. Lanjutkan?")) {
    for (const d of anomaliSnap.docs) await deleteDoc(doc(db, "anomali", d.id));
    const absensiSnap = await getDocs(collection(db, "absensi"));
    for (const d of absensiSnap.docs) await deleteDoc(doc(db, "absensi", d.id));
    const izinSnap = await getDocs(collection(db, "izin"));
    for (const d of izinSnap.docs) await deleteDoc(doc(db, "izin", d.id));
    alert("✅ Export berhasil & data telah dihapus!");
    fetchData();
  }
};

const handleExportGaji = async () => {
  // Cek anomali belum dikonfirmasi
  const anomaliSnap = await getDocs(collection(db, "anomali"));
  const anomali = anomaliSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const belumKonfirmasi = anomali.filter(a =>
    a.status === "belum" &&
    (a.jenis === "Tidak Hadir" || a.jenis === "Scan Tidak Lengkap")
  );

  if (belumKonfirmasi.length > 0) {
    alert(`⚠️ Masih ada ${belumKonfirmasi.length} anomali "Tidak Hadir" atau "Scan Tidak Lengkap" yang belum dikonfirmasi!\n\nSilakan konfirmasi dulu di halaman Anomali.`);
    return;
  }

  // Export PDF
  const periode = filterPeriode !== "semua" ? filterPeriode : "Semua Periode";
  exportRekapGaji(filtered, periode);

  // Auto delete
  if (confirm("Data absensi & anomali akan dihapus setelah export. Lanjutkan?")) {
    for (const d of anomaliSnap.docs) await deleteDoc(doc(db, "anomali", d.id));
    const absensiSnap = await getDocs(collection(db, "absensi"));
    for (const d of absensiSnap.docs) await deleteDoc(doc(db, "absensi", d.id));
    const izinSnap = await getDocs(collection(db, "izin"));
    for (const d of izinSnap.docs) await deleteDoc(doc(db, "izin", d.id));
    alert("✅ Export berhasil & data telah dihapus!");
    fetchData();
  }
};

  useEffect(() => { fetchData(); }, []);

  // Gabungkan absensi dengan data karyawan
  const gajiList = absensiData.map(absensi => {
    const karyawan = karyawanData.find(k =>
      k.userId.toString() === absensi.userId.toString()
    );
    const tarifJam = Number(karyawan?.tarifJam || 0);
    const totalJamKerja = absensi.rekap?.totalJamKerja || 0;
    const totalJamLembur = absensi.rekap?.totalJamLembur || 0;
    const gajiPokok = totalJamKerja * tarifJam;

    return {
      id: absensi.id,
      userId: absensi.userId,
      nama: absensi.nama,
      dept: absensi.dept,
      periode: absensi.periode,
      totalJamKerja,
      totalJamLembur,
      tarifJam,
      gajiPokok,
      hariHadir: absensi.rekap?.hariHadir || 0,
    };
  });

  // Ambil list periode unik
  const periodeList = [...new Set(gajiList.map(g => g.periode))].sort();

  // Filter
  let filtered = gajiList;
  if (filterPeriode !== "semua") filtered = filtered.filter(g => g.periode === filterPeriode);
  if (search) filtered = filtered.filter(g =>
    g.nama?.toLowerCase().includes(search.toLowerCase()) ||
    g.dept?.toLowerCase().includes(search.toLowerCase())
  );
  filtered.sort((a, b) => Number(a.userId) - Number(b.userId));

  const totalGaji = filtered.reduce((sum, g) => sum + g.gajiPokok, 0);

  return (
    <div className="space-y-6">

      {/* Header */}
<div className="flex items-center justify-between">
  <div>
    <h2 className="text-xl font-bold" style={{ color: "#6F4E37" }}>Kalkulasi Gaji</h2>
    <p className="text-xs mt-1" style={{ color: "#A67B5B" }}>
      Rekap gaji karyawan berdasarkan jam kerja
    </p>
  </div>
  <div className="flex gap-2">
    <button
      onClick={handleExportAbsen}
      className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
      style={{ backgroundColor: "#ECB176", color: "#6F4E37" }}
    >
      Export Absen (.xlsx)
    </button>
    <button
      onClick={handleExportGaji}
      className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
      style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}
    >
      Export Gaji (.pdf)
    </button>
  </div>
</div>

      {/* Total Gaji */}
      <div className="rounded-xl p-6" style={{ backgroundColor: "#6F4E37" }}>
        <p className="text-sm font-medium" style={{ color: "#ECB176" }}>
          Total Pengeluaran Gaji
        </p>
        <p className="text-3xl font-bold mt-1" style={{ color: "#FED8B1" }}>
          Rp {totalGaji.toLocaleString("id-ID")}
        </p>
        <p className="text-xs mt-1" style={{ color: "#ECB176" }}>
          {filtered.length} karyawan · {filterPeriode === "semua" ? "Semua periode" : filterPeriode}
        </p>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterPeriode}
          onChange={e => setFilterPeriode(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: "1px solid #ECB176", color: "#6F4E37", backgroundColor: "white" }}
        >
          <option value="semua">Semua Periode</option>
          {periodeList.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5" style={{ color: "#A67B5B" }} />
          <input
            type="text"
            placeholder="Cari nama atau departemen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none"
            style={{ border: "1px solid #ECB176", color: "#6F4E37", backgroundColor: "white" }}
          />
        </div>
      </div>

      {/* List Gaji */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto"
            style={{ borderColor: "#ECB176", borderTopColor: "#6F4E37" }} />
          <p className="mt-3 text-sm" style={{ color: "#A67B5B" }}>Memuat data...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <DollarSign size={40} className="mx-auto mb-3" style={{ color: "#ECB176" }} />
          <p className="font-semibold" style={{ color: "#6F4E37" }}>Belum ada data gaji</p>
          <p className="text-sm mt-1" style={{ color: "#A67B5B" }}>
            Upload absensi & pastikan tarif karyawan sudah diisi
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(g => (
            <div key={g.id} className="bg-white rounded-xl shadow-sm overflow-hidden">

              {/* Header */}
              <button
                onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                className="w-full flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: "#ECB176", color: "#6F4E37" }}>
                    {g.nama?.[0]?.toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm" style={{ color: "#6F4E37" }}>{g.nama}</p>
                    <p className="text-xs" style={{ color: "#A67B5B" }}>
                      {g.dept} · {g.periode}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-sm" style={{ color: "#6F4E37" }}>
                      Rp {g.gajiPokok.toLocaleString("id-ID")}
                    </p>
                    <p className="text-xs" style={{ color: "#A67B5B" }}>
                      {g.totalJamKerja.toFixed(1)} jam × Rp {g.tarifJam.toLocaleString("id-ID")}
                    </p>
                  </div>
                  {expandedId === g.id
                    ? <ChevronUp size={16} style={{ color: "#A67B5B" }} />
                    : <ChevronDown size={16} style={{ color: "#A67B5B" }} />
                  }
                </div>
              </button>

              {/* Detail */}
              {expandedId === g.id && (
                <div className="px-5 pb-4" style={{ borderTop: "1px solid #FED8B1" }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    {[
                      { label: "Hari Hadir", value: `${g.hariHadir} hari` },
                      { label: "Total Jam Kerja", value: `${g.totalJamKerja.toFixed(1)} jam` },
                      { label: "Total Lembur", value: `${g.totalJamLembur.toFixed(1)} jam` },
                      { label: "Tarif per Jam", value: `Rp ${g.tarifJam.toLocaleString("id-ID")}` },
                    ].map((item, i) => (
                      <div key={i} className="rounded-lg p-3" style={{ backgroundColor: "#fffaf5" }}>
                        <p className="text-xs" style={{ color: "#A67B5B" }}>{item.label}</p>
                        <p className="font-semibold text-sm mt-0.5" style={{ color: "#6F4E37" }}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center mt-4 pt-3"
                    style={{ borderTop: "1px solid #FED8B1" }}>
                    <p className="text-sm font-medium" style={{ color: "#A67B5B" }}>
                      Total Gaji
                      {g.tarifJam === 0 && (
                        <span className="ml-2 text-xs text-red-500">⚠️ Tarif belum diisi!</span>
                      )}
                    </p>
                    <p className="text-lg font-bold" style={{ color: "#6F4E37" }}>
                      Rp {g.gajiPokok.toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}