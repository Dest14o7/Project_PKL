import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { parseAbsensiExcel } from "../utils/excelParser";
import { db } from "../firebase";
// import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";

export default function Absensi() {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith(".xls") && !file.name.endsWith(".xlsx")) {
      setError("File harus berformat .xls atau .xlsx!");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const parsed = await parseAbsensiExcel(file);
      setResult(parsed);
    } catch (err) {
      setError("Gagal membaca file. Pastikan format file benar!");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSimpan = async () => {
  if (!result) return;
  setIsLoading(true);

  try {
    // Fetch data izin & karyawan dulu
    const izinSnap = await getDocs(collection(db, "izin"));
    const izinData = izinSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const karyawanSnap = await getDocs(collection(db, "karyawan"));
    const karyawanData = karyawanSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const emp of result.employees) {
      // Cek apakah data periode ini sudah ada
      const q = query(
        collection(db, "absensi"),
        where("userId", "==", emp.userId),
        where("periode", "==", emp.periode)
      );
      const existing = await getDocs(q);
      if (!existing.empty) continue;

      // Cek tipe karyawan
      const karyawan = karyawanData.find(k =>
        k.userId.toString() === emp.userId.toString()
      );
      const isFreelance = karyawan?.tipe === "freelance";

      // Simpan absensi
      await addDoc(collection(db, "absensi"), {
        userId: emp.userId,
        nama: emp.nama,
        dept: emp.dept,
        periode: emp.periode,
        dailyData: emp.dailyData,
        rekap: emp.rekap,
        createdAt: new Date().toISOString(),
      });

      // Filter & simpan anomali
      for (const anomali of emp.anomali) {
        // Skip "Tidak Hadir" untuk freelance
        if (isFreelance && anomali.jenis === "Tidak Hadir") continue;

        // Cek izin
        const izinCocok = izinData.find(i =>
          i.userId.toString() === emp.userId.toString() &&
          i.tanggal === anomali.tanggal
        );

        const statusFinal = izinCocok ? izinCocok.jenis : "belum";

        await addDoc(collection(db, "anomali"), {
          ...anomali,
          userId: emp.userId,
          nama: emp.nama,
          dept: emp.dept,
          periode: emp.periode,
          status: statusFinal,
          keteranganIzin: izinCocok ? izinCocok.keterangan : null,
        });
      }
    }
    alert("Data berhasil disimpan & anomali sudah divalidasi!");
  } catch (err) {
    alert("Gagal menyimpan data!");
    console.error(err);
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold" style={{ color: "#6F4E37" }}>Rekap Absensi</h2>
        <p className="text-xs mt-1" style={{ color: "#A67B5B" }}>
          Upload file Excel dari mesin fingerprint
        </p>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className="rounded-xl p-10 text-center transition-all"
        style={{
          border: `2px dashed ${isDragging ? "#6F4E37" : "#ECB176"}`,
          backgroundColor: isDragging ? "#FED8B1" : "white",
        }}
      >
        <FileSpreadsheet size={48} className="mx-auto mb-3" style={{ color: "#ECB176" }} />
        <p className="font-semibold" style={{ color: "#6F4E37" }}>
          Drag & drop file Excel di sini
        </p>
        <p className="text-sm mt-1 mb-4" style={{ color: "#A67B5B" }}>
          atau klik tombol di bawah untuk pilih file
        </p>
        <label
          className="px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
          style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}
        >
          Pilih File Excel
          <input
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </label>
        <p className="text-xs mt-3" style={{ color: "#A67B5B" }}>
          Format: .xls atau .xlsx dari mesin fingerprint
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto"
            style={{ borderColor: "#ECB176", borderTopColor: "#6F4E37" }} />
          <p className="mt-3 text-sm" style={{ color: "#A67B5B" }}>Memproses file...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: "#fff0f0", border: "1px solid #ffcccc" }}>
          <AlertCircle size={20} color="#e53e3e" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between p-4 rounded-xl"
            style={{ backgroundColor: "#f0fff4", border: "1px solid #9ae6b4" }}>
            <div className="flex items-center gap-3">
              <CheckCircle size={20} color="#38a169" />
              <div>
                <p className="text-sm font-semibold text-green-700">
                  Berhasil membaca {result.employees.length} karyawan
                </p>
                <p className="text-xs text-green-600">Periode: {result.periode}</p>
              </div>
            </div>
            <button
              onClick={handleSimpan}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}
            >
              Simpan ke Database
            </button>
          </div>

          {/* Tombol Reset — hapus setelah testing! */}
<button
  onClick={async () => {
    if (!confirm("Hapus SEMUA data absensi & anomali?")) return;
    const { getDocs, collection, deleteDoc, doc } = await import("firebase/firestore");
    const absensiSnap = await getDocs(collection(db, "absensi"));
    const anomaliSnap = await getDocs(collection(db, "anomali"));
    for (const d of absensiSnap.docs) await deleteDoc(doc(db, "absensi", d.id));
    for (const d of anomaliSnap.docs) await deleteDoc(doc(db, "anomali", d.id));
    alert("Semua data berhasil dihapus!");
  }}
  className="px-4 py-2 rounded-lg text-sm font-medium"
  style={{ backgroundColor: "#F8D7DA", color: "#842029" }}
>
  🗑️ Reset Data (Testing)
</button>

          {/* Tabel Rekap */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}>
                  <th className="px-4 py-3 text-left">User ID</th>
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-left">Dept</th>
                  <th className="px-4 py-3 text-center">Hari Hadir</th>
                  <th className="px-4 py-3 text-center">Total Jam Kerja</th>
                  <th className="px-4 py-3 text-center">Total Lembur</th>
                  <th className="px-4 py-3 text-center">Detail</th>
                </tr>
              </thead>
              <tbody>
                {result.employees.map((emp, i) => (
                  <>
                    <tr key={emp.userId} style={{ backgroundColor: i % 2 === 0 ? "#fffaf5" : "white" }}>
                      <td className="px-4 py-3" style={{ color: "#6F4E37" }}>{emp.userId}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: "#6F4E37" }}>{emp.nama}</td>
                      <td className="px-4 py-3" style={{ color: "#A67B5B" }}>{emp.dept}</td>
                      <td className="px-4 py-3 text-center" style={{ color: "#6F4E37" }}>
                        {emp.rekap.hariHadir} hari
                      </td>
                      <td className="px-4 py-3 text-center" style={{ color: "#6F4E37" }}>
                        {emp.rekap.totalJamKerja.toFixed(1)} jam
                      </td>
                      <td className="px-4 py-3 text-center" style={{ color: "#A67B5B" }}>
                        {emp.rekap.totalJamLembur.toFixed(1)} jam
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setExpandedEmployee(expandedEmployee === emp.userId ? null : emp.userId)}
                          className="p-1 rounded"
                          style={{ color: "#A67B5B" }}
                        >
                          {expandedEmployee === emp.userId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>

                    {/* Detail Harian */}
                    {expandedEmployee === emp.userId && (
                      <tr key={`detail-${emp.userId}`}>
                        <td colSpan={7} className="px-4 py-3" style={{ backgroundColor: "#fffaf5" }}>
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ color: "#A67B5B" }}>
                                <th className="text-left py-1">Tanggal</th>
                                <th className="text-center">Masuk Pagi</th>
                                <th className="text-center">Keluar Pagi</th>
                                <th className="text-center">Masuk Lembur</th>
                                <th className="text-center">Keluar Lembur</th>
                              </tr>
                            </thead>
                            <tbody>
                              {emp.dailyData.map((day, j) => (
                                <tr key={j} style={{ borderTop: "1px solid #FED8B1" }}>
                                  <td className="py-1" style={{ color: "#6F4E37" }}>{day.tanggal}</td>
                                  <td className="text-center" style={{ color: "#6F4E37" }}>{day.jamMasukPagi || "-"}</td>
                                  <td className="text-center" style={{ color: "#6F4E37" }}>{day.jamKeluarPagi || "-"}</td>
                                  <td className="text-center" style={{ color: "#A67B5B" }}>{day.jamMasukLembur || "-"}</td>
                                  <td className="text-center" style={{ color: "#A67B5B" }}>{day.jamKeluarLembur || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}