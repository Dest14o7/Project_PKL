import React, { useState, useEffect } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { parseAbsensiExcel } from "../utils/excelParser";
import { exportRekapAbsen } from "../utils/exportExcel";
import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where, updateDoc, doc, getDoc, deleteDoc } from "firebase/firestore";

export default function Absensi() {
  const [isDragging, setIsDragging] = useState(false);
  const [allPeriods, setAllPeriods] = useState([]);
  const [selectedPeriode, setSelectedPeriode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [absensiData, setAbsensiData] = useState([]);
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  const fetchConfig = async () => {
    try {
      const configSnap = await getDoc(doc(db, "config", "global"));
      const configData = configSnap.exists() ? configSnap.data() : {};
      const pList = (configData.periodeList || [])
        .map(p => typeof p === "string" ? p : p.name)
        .filter(Boolean);
      setAllPeriods(pList);
      if (configData.periodeAktif) setSelectedPeriode(configData.periodeAktif);
    } catch (err) {
      console.error("Absensi Config Error:", err);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchAbsensi = async () => {
    try {
      if (!selectedPeriode) return;
      const q = query(collection(db, "absensi"), where("periode", "==", selectedPeriode));
      const snapshot = await getDocs(q);
      const allAbsensi = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Ambil data karyawan untuk filter status aktif
      const karyawanSnap = await getDocs(collection(db, "karyawan"));
      const activeUserIds = new Set(
        karyawanSnap.docs
          .filter(d => d.data().status === "aktif")
          .map(d => d.data().userId?.toString()?.trim()?.replace(/^0+/, ""))
      );

      const filtered = allAbsensi.filter(abs => 
        activeUserIds.has(abs.userId?.toString()?.trim()?.replace(/^0+/, ""))
      );

      setAbsensiData(filtered);
    } catch (err) {
      console.error("Absensi Fetch Error:", err);
    }
  };

  useEffect(() => {
    fetchAbsensi();
  }, [selectedPeriode]);

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

  const handleReset = async () => {
    if (!selectedPeriode) return alert("Pilih periode yang akan direset!");
    if (!confirm(`Hapus SEMUA data absensi & anomali untuk periode ${selectedPeriode}?`)) return;
    
    setIsLoading(true);
    
    try {
      // 1. Hapus Absensi
      const qAbs = query(collection(db, "absensi"), where("periode", "==", selectedPeriode));
      const snapAbs = await getDocs(qAbs);
      let deletedCount = 0;
      for (const d of snapAbs.docs) {
        await deleteDoc(doc(db, "absensi", d.id));
        deletedCount++;
      }

      // Catat ke auditLog
      await addDoc(collection(db, "auditLogs"), {
        action: "RESET_ABSENSI",
        periode: selectedPeriode,
        adminId: "admin", // Placeholder for actual logged in admin
        deletedCount,
        timestamp: new Date().toISOString()
      });

      alert(`Data periode ${selectedPeriode} berhasil direset!`);
      fetchAbsensi();
    } catch (err) {
      console.error("Reset Error:", err);
      alert("Gagal mereset data!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimpan = async () => {
    if (!result) return;
    if (!selectedPeriode) {
      alert("Silakan pilih periode di pojok kanan atas terlebih dahulu!");
      return;
    }
    setIsLoading(true);

    try {
      const izinSnap = await getDocs(collection(db, "izin"));
      const izinData = izinSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const karyawanSnap = await getDocs(collection(db, "karyawan"));
      const karyawanData = karyawanSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (karyawanData.length === 0) {
        alert("⚠️ Perhatian: Anda belum memiliki data karyawan.");
      }

      let savedCount = 0;
      let skippedCount = 0;
      let missingEmployeeCount = 0;
      let skippedNames = [];
      const processedIds = new Set();

      for (const emp of result.employees) {
        const normalizedId = emp.userId?.toString()?.trim()?.replace(/^0+/, "") || "";
        
        // Cek apakah ID ini sudah diproses dalam batch ini (mencegah duplikat di file yang sama)
        if (processedIds.has(normalizedId + selectedPeriode)) {
          continue;
        }
        processedIds.add(normalizedId + selectedPeriode);

        const karyawan = karyawanData.find(k => k.userId?.toString()?.trim()?.replace(/^0+/, "") === normalizedId);
        
        if (!karyawan) missingEmployeeCount++;
        const isFreelance = karyawan?.tipe === "freelance";

        // Gunakan selectedPeriode dari UI agar konsisten
        const targetPeriode = selectedPeriode;

        const q = query(
          collection(db, "absensi"),
          where("userId", "==", normalizedId),
          where("periode", "==", targetPeriode)
        );
        const existing = await getDocs(q);
        if (!existing.empty) {
          skippedCount++;
          skippedNames.push(emp.nama);
          continue;
        }

        await addDoc(collection(db, "absensi"), {
          userId: normalizedId,
          nama: emp.nama || "Tanpa Nama",
          dept: emp.dept || "-",
          periode: targetPeriode,
          dailyData: emp.dailyData || [],
          rekap: emp.rekap || {},
          createdAt: new Date().toISOString(),
        });
        savedCount++;

        for (const anomali of (emp.anomali || [])) {
          if (isFreelance && anomali.jenis === "Tidak Hadir") continue;
          const qAnomali = query(
            collection(db, "anomali"),
            where("userId", "==", normalizedId),
            where("tanggal", "==", anomali.tanggal)
          );
          const existingAnomali = await getDocs(qAnomali);

          if (!existingAnomali.empty) {
            // Jika ada duplikat sebelumnya, bersihkan agar tidak terdouble
            if (existingAnomali.docs.length > 1) {
              for (let i = 1; i < existingAnomali.docs.length; i++) {
                await deleteDoc(doc(db, "anomali", existingAnomali.docs[i].id));
              }
            }
            continue; // Skip jika sudah ada agar status konfirmasi lama tidak hilang
          }

          const izinCocok = izinData.find(i =>
            i.userId?.toString()?.replace(/^0+/, "") === normalizedId &&
            i.tanggal === anomali.tanggal
          );
          const statusFinal = izinCocok ? izinCocok.jenis : (anomali.status || "belum");

          await addDoc(collection(db, "anomali"), {
            ...anomali,
            userId: normalizedId,
            nama: emp.nama || "Tanpa Nama",
            dept: emp.dept || "-",
            periode: targetPeriode,
            status: statusFinal,
            keteranganIzin: izinCocok ? izinCocok.keterangan : null,
          });
        }
      }

      if (skippedCount > 0) {
        alert(`Proses Selesai!\n\n✅ ${savedCount} data baru disimpan\n⚠️ ${skippedCount} data dilewati karena sudah ada di database untuk periode ${selectedPeriode}.\n❓ ${missingEmployeeCount} ID tidak ditemukan di daftar karyawan.\n\nData yang dilewati: ${skippedNames.join(", ")}`);
      } else {
        alert(`Proses Selesai!\n- ${savedCount} data baru disimpan\n- ${missingEmployeeCount} ID tidak ditemukan`);
      }
      fetchAbsensi();
      setResult(null);
    } catch (err) {
      alert("Gagal menyimpan data!");
      console.error("Absensi Simpan Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#6F4E37" }}>Manajemen Absensi</h2>
          <p className="text-xs mt-1" style={{ color: "#A67B5B" }}>Periode: {selectedPeriode || "-"}</p>
        </div>
        <div className="flex gap-3">
          <select 
            value={selectedPeriode}
            onChange={(e) => setSelectedPeriode(e.target.value)}
            className="bg-white border border-[#ECB176] text-[#6F4E37] rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="" disabled>Pilih Periode</option>
            {allPeriods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            onClick={() => exportRekapAbsen(absensiData, selectedPeriode)}
            disabled={absensiData.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            style={{ 
              backgroundColor: absensiData.length === 0 ? "#E5E7EB" : "#6F4E37", 
              color: absensiData.length === 0 ? "#9CA3AF" : "#FED8B1" 
            }}
          >
            <Upload size={16} /> Unduh Rekap Absen
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            style={{ backgroundColor: "#F8D7DA", color: "#842029" }}
          >
            <Trash2 size={16} /> Reset Data Periode
          </button>
        </div>
      </div>

      <div className="space-y-4">
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
          <p className="font-semibold" style={{ color: "#6F4E37" }}>Drag & drop file Excel di sini</p>
          <p className="text-sm mt-1 mb-4" style={{ color: "#A67B5B" }}>atau pilih file</p>
          <label className="px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer" style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}>
            Pilih File Excel
            <input type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
          </label>
        </div>

        <div className="flex items-center gap-3 text-[10px] bg-white p-3 rounded-xl border border-[#ECB176]" style={{ color: "#A67B5B" }}>
          <AlertCircle size={14} />
          <span>Pastikan file sesuai format. Data baru akan otomatis terdeteksi jika User ID cocok dengan periode aktif yang dipilih.</span>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: "#ECB176", borderTopColor: "#6F4E37" }} />
          <p className="mt-3 text-sm" style={{ color: "#A67B5B" }}>Memproses file...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: "#fff0f0", border: "1px solid #ffcccc" }}>
          <AlertCircle size={20} color="#e53e3e" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: "#f0fff4", border: "1px solid #9ae6b4" }}>
            <div className="flex items-center gap-3">
              <CheckCircle size={20} color="#38a169" />
              <div>
                <p className="text-sm font-semibold text-green-700">Berhasil membaca {result.employees.length} karyawan</p>
                <p className="text-xs text-green-600">Periode: {result.periode}</p>
              </div>
            </div>
            <button onClick={handleSimpan} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}>
              Simpan ke Database
            </button>
          </div>

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
                  <React.Fragment key={emp.userId}>
                    <tr style={{ backgroundColor: i % 2 === 0 ? "#fffaf5" : "white" }}>
                      <td className="px-4 py-3" style={{ color: "#6F4E37" }}>{emp.userId}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: "#6F4E37" }}>{emp.nama}</td>
                      <td className="px-4 py-3" style={{ color: "#A67B5B" }}>{emp.dept}</td>
                      <td className="px-4 py-3 text-center" style={{ color: "#6F4E37" }}>{emp.rekap.hariHadir} hari</td>
                      <td className="px-4 py-3 text-center" style={{ color: "#6F4E37" }}>{emp.rekap.totalJamKerja.toFixed(1)} jam</td>
                      <td className="px-4 py-3 text-center" style={{ color: "#A67B5B" }}>{emp.rekap.totalJamLembur.toFixed(1)} jam</td>
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
                    {expandedEmployee === emp.userId && (
                      <tr>
                        <td colSpan={7} className="px-4 py-3" style={{ backgroundColor: "#fffaf5" }}>
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ color: "#A67B5B" }}>
                                <th className="text-left py-1">Tanggal</th>
                                <th className="text-center">Masuk Pagi</th>
                                <th className="text-center">Keluar Pagi</th>
                                <th className="text-center">Masuk Siang</th>
                                <th className="text-center">Keluar Siang</th>
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
                                  <td className="text-center" style={{ color: "#A67B5B" }}>{day.jamMasukSiang || "-"}</td>
                                  <td className="text-center" style={{ color: "#A67B5B" }}>{day.jamKeluarSiang || "-"}</td>
                                  <td className="text-center" style={{ color: "#A67B5B" }}>{day.jamMasukLembur || "-"}</td>
                                  <td className="text-center" style={{ color: "#A67B5B" }}>{day.jamKeluarLembur || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Terupload List */}
      {!result && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-8">
          <div className="px-4 py-3 border-b border-[#ECB176] flex justify-between items-center" style={{ backgroundColor: "#fffaf5" }}>
            <h3 className="text-sm font-bold" style={{ color: "#6F4E37" }}>Data Terupload (Periode {selectedPeriode})</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
              {absensiData.length} Karyawan
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr style={{ color: "#A67B5B", borderBottom: "1px solid #FED8B1" }}>
                  <th className="px-4 py-2 text-left">User ID</th>
                  <th className="px-4 py-2 text-left">Nama</th>
                  <th className="px-4 py-2 text-left">Dept</th>
                  <th className="px-4 py-2 text-center">Hadir</th>
                  <th className="px-4 py-2 text-center">Jam Kerja</th>
                  <th className="px-4 py-2 text-center">Detail</th>
                </tr>
              </thead>
              <tbody>
                {[...absensiData]
                  .sort((a, b) => (Number(a.userId) || 0) - (Number(b.userId) || 0))
                  .map((abs, i) => (
                  <React.Fragment key={abs.id}>
                    <tr style={{ borderBottom: i < absensiData.length - 1 ? "1px solid #FFF8F0" : "none" }}>
                      <td className="px-4 py-2" style={{ color: "#6F4E37" }}>{abs.userId}</td>
                      <td className="px-4 py-2 font-medium" style={{ color: "#6F4E37" }}>{abs.nama}</td>
                      <td className="px-4 py-2" style={{ color: "#A67B5B" }}>{abs.dept}</td>
                      <td className="px-4 py-2 text-center" style={{ color: "#6F4E37" }}>{abs.rekap?.hariHadir || 0} hr</td>
                      <td className="px-4 py-2 text-center" style={{ color: "#6F4E37" }}>{Number(abs.rekap?.totalJamKerja || 0).toFixed(1)} j</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => setExpandedEmployee(expandedEmployee === abs.id ? null : abs.id)}
                          className="p-1 rounded hover:bg-amber-50"
                          style={{ color: "#A67B5B" }}
                        >
                          {expandedEmployee === abs.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </td>
                    </tr>
                    {expandedEmployee === abs.id && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3" style={{ backgroundColor: "#fffaf5" }}>
                          <div className="max-h-40 overflow-y-auto">
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr style={{ color: "#A67B5B", borderBottom: "1px solid #FED8B1" }}>
                                  <th className="text-left py-1">Tanggal</th>
                                  <th className="text-center">M. Pagi</th>
                                  <th className="text-center">K. Pagi</th>
                                  <th className="text-center">M. Siang</th>
                                  <th className="text-center">K. Siang</th>
                                  <th className="text-center">M. Lembur</th>
                                  <th className="text-center">K. Lembur</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(abs.dailyData || []).map((day, j) => (
                                  <tr key={j} className="border-b border-[#FFF8F0]">
                                    <td className="py-1" style={{ color: "#6F4E37" }}>{day.tanggal}</td>
                                    <td className="text-center" style={{ color: "#6F4E37" }}>{day.jamMasukPagi || "-"}</td>
                                    <td className="text-center" style={{ color: "#6F4E37" }}>{day.jamKeluarPagi || "-"}</td>
                                    <td className="text-center" style={{ color: "#A67B5B" }}>{day.jamMasukSiang || "-"}</td>
                                    <td className="text-center" style={{ color: "#A67B5B" }}>{day.jamKeluarSiang || "-"}</td>
                                    <td className="text-center" style={{ color: "#A67B5B" }}>{day.jamMasukLembur || "-"}</td>
                                    <td className="text-center" style={{ color: "#A67B5B" }}>{day.jamKeluarLembur || "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {absensiData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle size={32} className="opacity-20" style={{ color: "#A67B5B" }} />
                        <p className="text-xs font-medium" style={{ color: "#A67B5B" }}>
                          Belum ada data absensi untuk periode <strong>{selectedPeriode}</strong>.
                        </p>
                        <p className="text-[10px]" style={{ color: "#A67B5B" }}>
                          Silakan unggah file Excel untuk mengisi data.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}