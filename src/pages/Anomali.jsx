import { useState, useEffect } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle, Clock, UserX, LogOut, Pencil } from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";

const jenisColor = {
  "Terlambat": { bg: "#FFF3CD", color: "#856404" },
  "Tidak Hadir": { bg: "#F8D7DA", color: "#842029" },
  "Pulang Cepat": { bg: "#D1ECF1", color: "#0C5460" },
  "Scan Tidak Lengkap": { bg: "#E8D5F5", color: "#6B21A8" },
};

const jenisIcon = {
  "Terlambat": <Clock size={12} />,
  "Tidak Hadir": <UserX size={12} />,
  "Pulang Cepat": <LogOut size={12} />,
  "Scan Tidak Lengkap": <AlertTriangle size={12} />,
};

export default function Anomali() {
  const [anomaliData, setAnomaliData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedKaryawan, setExpandedKaryawan] = useState(null);
  const [filterJenis, setFilterJenis] = useState("semua");
  const [filterNama, setFilterNama] = useState("");
  const [editData, setEditData] = useState(null);
  const [editForm, setEditForm] = useState({ keterangan: "", jamTambahan: "" });

  const fetchAnomali = async () => {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "anomali"));
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setAnomaliData(data);
    setLoading(false);
  };

  useEffect(() => { fetchAnomali(); }, []);

  const handleKonfirmasi = async (id) => {
    await updateDoc(doc(db, "anomali", id), { status: "dikonfirmasi" });
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
  setEditData(null);
  fetchAnomali();
};

  // Group anomali per karyawan
  const grouped = anomaliData.reduce((acc, a) => {
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
  groupedList.sort((a, b) => Number(a.userId) - Number(b.userId));

  const totalBelum = anomaliData.filter(a => a.status === "belum").length;
  const totalTerlambat = anomaliData.filter(a => a.jenis === "Terlambat").length;
  const totalTidakHadir = anomaliData.filter(a => a.jenis === "Tidak Hadir").length;
  const totalPulangCepat = anomaliData.filter(a => a.jenis === "Pulang Cepat").length;
  const totalScanTidakLengkap = anomaliData.filter(a => a.jenis === "Scan Tidak Lengkap").length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold" style={{ color: "#6F4E37" }}>Pengecekan Anomali</h2>
        <p className="text-xs mt-1" style={{ color: "#A67B5B" }}>Deteksi ketidaksesuaian absensi karyawan</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Belum Dikonfirmasi", value: totalBelum, bg: "#6F4E37", color: "#FED8B1" },
          { label: "Terlambat", value: totalTerlambat, bg: "#FFF3CD", color: "#856404" },
          { label: "Tidak Hadir", value: totalTidakHadir, bg: "#F8D7DA", color: "#842029" },
          { label: "Pulang Cepat", value: totalPulangCepat, bg: "#D1ECF1", color: "#0C5460" },
          { label: "Scan Tidak Lengkap", value: totalScanTidakLengkap, bg: "#E8D5F5", color: "#6B21A8" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl p-4" style={{ backgroundColor: s.bg }}>
            <p className="text-xs font-medium" style={{ color: s.color, opacity: 0.8 }}>{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterJenis}
          onChange={e => setFilterJenis(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm outline-none"
          style={{ border: "1px solid #ECB176", color: "#6F4E37", backgroundColor: "white" }}
        >
          <option value="semua">Semua Jenis</option>
          <option value="Terlambat">Terlambat</option>
          <option value="Tidak Hadir">Tidak Hadir</option>
          <option value="Pulang Cepat">Pulang Cepat</option>
          <option value="Scan Tidak Lengkap">Scan Tidak Lengkap</option>
        </select>

        <input
          type="text"
          placeholder="Cari nama karyawan..."
          value={filterNama}
          onChange={e => setFilterNama(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm outline-none"
          style={{ border: "1px solid #ECB176", color: "#6F4E37", backgroundColor: "white" }}
        />
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
                                  {a.status === "belum" ? "Belum" : a.status}
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