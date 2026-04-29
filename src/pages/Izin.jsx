import { useState, useEffect } from "react";
import { FileText, Plus, Trash2, Search, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, getDoc, writeBatch } from "firebase/firestore";
import { parseIzinExcel } from "../utils/excelParser";
import { downloadTemplateIzin } from "../utils/exportExcel";


const jenisIzin = ["Izin", "Sakit", "Cuti", "Setengah Hari (Pagi)", "Setengah Hari (Siang)", "Izin Terlambat", "Izin 2 Jam"];

export default function Izin() {
  const [izinData, setIzinData] = useState([]);
  const [karyawanList, setKaryawanList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPeriode, setSelectedPeriode] = useState("");
  const [allPeriods, setAllPeriods] = useState([]);
  const [monthPrefix, setMonthPrefix] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    userId: "",
    nama: "",
    dept: "",
    tanggal: "",
    jenis: "Izin",
    keterangan: "",
  });
  const [searchKaryawan, setSearchKaryawan] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // States for Import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResults, setImportResults] = useState([]);
  const [isImporting, setIsImporting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch config
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

      // Fetch izin
      const izinSnap = await getDocs(collection(db, "izin"));
      const izin = izinSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setIzinData(izin.sort((a, b) => {
        const dateA = new Date(a.tanggal || 0);
        const dateB = new Date(b.tanggal || 0);
        return dateB - dateA;
      }));

      // Fetch karyawan untuk dropdown
      const karyawanSnap = await getDocs(collection(db, "karyawan"));
      const karyawan = karyawanSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(k => k.status === "aktif")
        .sort((a, b) => Number(a.userId || 0) - Number(b.userId || 0));
      setKaryawanList(karyawan);
    } catch (err) {
      console.error("Izin Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedPeriode]);

  const handleKaryawanChange = (userId) => {
    const k = karyawanList.find(k => k.userId.toString() === userId.toString());
    if (k) {
      setForm({ ...form, userId: k.userId, nama: k.nama, dept: k.dept });
    }
  };

  const handleSubmit = async () => {
  if (!form.userId || !form.tanggal || !form.jenis) {
    return alert("Karyawan, tanggal, dan jenis izin wajib diisi!");
  }
  const normalizedId = form.userId?.toString().replace(/^0+/, "") || "";
  await addDoc(collection(db, "izin"), {
    ...form,
    userId: normalizedId,
    createdAt: new Date().toISOString(),
  });
  setForm({ userId: "", nama: "", dept: "", tanggal: "", jenis: "Izin", keterangan: "" });
  setSearchKaryawan("");
  setShowForm(false);
  fetchData();
};

  const handleHapus = async (id) => {
    if (!confirm("Hapus data izin ini?")) return;
    await deleteDoc(doc(db, "izin", id));
    fetchData();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setIsImporting(true);
      const results = await parseIzinExcel(file);
      
      // Validasi tambahan: Cek apakah User ID ada di sistem
      const validatedResults = results.map(res => {
        const k = karyawanList.find(k => k.userId.toString() === res.userId.toString());
        if (!k) {
          res.isValid = false;
          res.errors.push(`User ID ${res.userId} tidak ditemukan`);
        } else {
          res.dept = k.dept;
          res.nama = k.nama; // Gunakan nama asli dari sistem
        }
        return res;
      });

      setImportResults(validatedResults);
      setShowImportModal(true);
    } catch (err) {
      alert("Gagal membaca file: " + err.message);
    } finally {
      setIsImporting(false);
      e.target.value = ""; // Reset input
    }
  };

  const handleConfirmImport = async () => {
    const validData = importResults.filter(r => r.isValid);
    if (validData.length === 0) return alert("Tidak ada data valid untuk disimpan.");

    if (!confirm(`Simpan ${validData.length} data izin yang valid?`)) return;

    try {
      setIsImporting(true);
      const batch = writeBatch(db);
      
      validData.forEach(item => {
        const docRef = doc(collection(db, "izin"));
        batch.set(docRef, {
          userId: item.userId,
          nama: item.nama,
          dept: item.dept || "",
          tanggal: item.tanggal,
          tglMulai: item.tglMulai,
          tglSelesai: item.tglSelesai,
          jamMulai: item.jamMulai || null,
          jamSelesai: item.jamSelesai || null,
          jenis: item.jenis,
          totalHari: item.totalHari,
          keterangan: item.keterangan || "",
          createdAt: new Date().toISOString(),
        });
      });

      await batch.commit();
      alert(`Berhasil menyimpan ${validData.length} data izin.`);
      setShowImportModal(false);
      setImportResults([]);
      fetchData();
    } catch (err) {
      alert("Gagal menyimpan data: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const filtered = izinData.filter(i => {
    const matchesSearch = i.nama?.toLowerCase().includes(search.toLowerCase()) ||
                         i.jenis?.toLowerCase().includes(search.toLowerCase());
    const matchesPrefix = monthPrefix ? i.tanggal?.startsWith(monthPrefix) : true;
    return matchesSearch && matchesPrefix;
  });

  const jenisColor = {
    "Izin": { bg: "#E8F4FD", color: "#1A5276" },
    "Sakit": { bg: "#F8D7DA", color: "#842029" },
    "Izin Terlambat": { bg: "#FFF3CD", color: "#856404" },
    "Izin 2 Jam": { bg: "#FED8B1", color: "#6F4E37" },
    "Cuti": { bg: "#D4EDDA", color: "#155724" },
    "Setengah Hari (Pagi)": { bg: "#E0F2F1", color: "#00695C" },
    "Setengah Hari (Siang)": { bg: "#E0F2F1", color: "#00695C" },
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#6F4E37" }}>Manajemen Izin</h2>
          <p className="text-xs mt-1" style={{ color: "#A67B5B" }}>
            Periode: {selectedPeriode || "-"}
          </p>
        </div>
        <div className="flex gap-3">
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
          <button
            onClick={downloadTemplateIzin}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border border-[#6F4E37]"
            style={{ color: "#6F4E37" }}
          >
            <Upload size={16} className="rotate-180" /> Template
          </button>
          <label className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer border border-[#6F4E37]"
            style={{ color: "#6F4E37" }}>
            <Upload size={16} /> Import File
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
          </label>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm"
            style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}
          >
            <Plus size={16} /> Tambah Izin
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {jenisIzin.map(j => {
          const count = izinData.filter(i => i.jenis === j).length;
          return (
            <div key={j} className="rounded-xl p-4" style={{ backgroundColor: jenisColor[j].bg }}>
              <p className="text-xs font-medium" style={{ color: jenisColor[j].color }}>{j}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: jenisColor[j].color }}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3" style={{ color: "#A67B5B" }} />
        <input
          type="text"
          placeholder="Cari nama atau jenis izin..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
          style={{ backgroundColor: "white", border: "1px solid #ECB176", color: "#6F4E37" }}
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4" style={{ color: "#6F4E37" }}>Tambah Izin</h3>
            <div className="space-y-3">

              {/* Pilih Karyawan */}
<div className="relative">
  <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>Karyawan</label>
  <input
    type="text"
    placeholder="Cari nama karyawan..."
    value={searchKaryawan}
    onChange={e => {
      setSearchKaryawan(e.target.value);
      setShowDropdown(true);
    }}
    onFocus={() => setShowDropdown(true)}
    className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none"
    style={{ border: "1px solid #ECB176", color: "#6F4E37" }}
  />

  {/* Dropdown hasil search */}
  {showDropdown && (
    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg max-h-48 overflow-y-auto"
      style={{ border: "1px solid #ECB176" }}>
      {karyawanList
        .filter(k =>
          k.nama?.toLowerCase().includes(searchKaryawan.toLowerCase()) ||
          k.userId?.toString().includes(searchKaryawan)
        )
        .map(k => (
          <button
            key={k.id}
            type="button"
            onClick={() => {
              handleKaryawanChange(k.userId);
              setSearchKaryawan(`${k.userId} - ${k.nama}`);
              setShowDropdown(false);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-amber-50 transition-colors"
            style={{ color: "#6F4E37" }}
          >
            <span className="font-medium">{k.userId} - {k.nama}</span>
            <span className="text-xs ml-2" style={{ color: "#A67B5B" }}>({k.dept})</span>
          </button>
        ))}
      {karyawanList.filter(k =>
        k.nama?.toLowerCase().includes(searchKaryawan.toLowerCase()) ||
        k.userId?.toString().includes(searchKaryawan)
      ).length === 0 && (
        <p className="px-3 py-2 text-sm" style={{ color: "#A67B5B" }}>
          Karyawan tidak ditemukan
        </p>
      )}
    </div>
  )}
</div>

              {/* Tanggal */}
              <div>
                <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>Tanggal</label>
                <input
                  type="date"
                  value={form.tanggal}
                  onChange={e => setForm({ ...form, tanggal: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: "1px solid #ECB176", color: "#6F4E37" }}
                />
              </div>

              {/* Jenis Izin */}
              <div>
                <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>Jenis Izin</label>
                <select
                  value={form.jenis}
                  onChange={e => setForm({ ...form, jenis: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: "1px solid #ECB176", color: "#6F4E37" }}
                >
                  {jenisIzin.map(j => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
              </div>

              {/* Keterangan */}
              <div>
                <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>Keterangan (opsional)</label>
                <textarea
                  value={form.keterangan}
                  onChange={e => setForm({ ...form, keterangan: e.target.value })}
                  placeholder="Contoh: Sakit demam, ada surat dokter"
                  rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ border: "1px solid #ECB176", color: "#6F4E37" }}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "#FED8B1", color: "#6F4E37" }}
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Result Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold" style={{ color: "#6F4E37" }}>Ringkasan Import Data Izin</h3>
              <p className="text-xs mt-1" style={{ color: "#A67B5B" }}>
                Ditemukan {importResults.length} baris data. Silakan tinjau sebelum menyimpan.
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b" style={{ color: "#A67B5B" }}>
                    <th className="py-2 text-left">Status</th>
                    <th className="py-2 text-left">User ID</th>
                    <th className="py-2 text-left">Nama</th>
                    <th className="py-2 text-left">Jenis</th>
                    <th className="py-2 text-left">Tanggal</th>
                    <th className="py-2 text-center">Hari</th>
                    <th className="py-2 text-left">Pesan/Error</th>
                  </tr>
                </thead>
                <tbody>
                  {importResults.map((res, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3">
                        {res.isValid ? 
                          <CheckCircle size={16} className="text-green-500" /> : 
                          <AlertCircle size={16} className="text-red-500" />
                        }
                      </td>
                      <td className="py-3 font-medium">{res.userId}</td>
                      <td className="py-3">{res.nama || <span className="text-red-400">?</span>}</td>
                      <td className="py-3">{res.jenis}</td>
                      <td className="py-3">{res.tglMulai} {res.tglSelesai && res.tglSelesai !== res.tglMulai ? `s/d ${res.tglSelesai}` : ""}</td>
                      <td className="py-3 text-center font-bold">{res.totalHari}</td>
                      <td className="py-3 text-[10px]">
                        {res.isValid ? 
                          <span className="text-green-600">Siap simpan</span> : 
                          <span className="text-red-500">{res.errors.join(", ")}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-between items-center">
              <div className="text-xs" style={{ color: "#6F4E37" }}>
                <span className="font-bold">{importResults.filter(r => r.isValid).length} data valid</span> dari {importResults.length} total baris
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowImportModal(false); setImportResults([]); }}
                  className="px-6 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: "#FED8B1", color: "#6F4E37" }}
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={isImporting || importResults.filter(r => r.isValid).length === 0}
                  className="px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                  style={{ 
                    backgroundColor: importResults.filter(r => r.isValid).length === 0 ? "#E5E7EB" : "#6F4E37", 
                    color: importResults.filter(r => r.isValid).length === 0 ? "#9CA3AF" : "#FED8B1" 
                  }}
                >
                  {isImporting ? "Menyimpan..." : "Simpan Data Valid"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto"
              style={{ borderColor: "#ECB176", borderTopColor: "#6F4E37" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={40} className="mx-auto mb-3" style={{ color: "#ECB176" }} />
            <p className="font-semibold" style={{ color: "#6F4E37" }}>Belum ada data izin</p>
            <p className="text-sm mt-1" style={{ color: "#A67B5B" }}>Tambah izin karyawan di sini</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Dept</th>
                <th className="px-4 py-3 text-left">Jenis Izin</th>
                <th className="px-4 py-3 text-left">Keterangan</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((izin, i) => (
                <tr key={izin.id} style={{ backgroundColor: i % 2 === 0 ? "#fffaf5" : "white" }}>
                  <td className="px-4 py-3 text-xs" style={{ color: "#6F4E37" }}>{izin.tanggal}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: "#6F4E37" }}>{izin.nama}</td>
                  <td className="px-4 py-3" style={{ color: "#A67B5B" }}>{izin.dept}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium"
                      style={jenisColor[izin.jenis]}>
                      {izin.jenis}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#A67B5B" }}>
                    {izin.keterangan || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleHapus(izin.id)}
                      className="p-1.5 rounded-lg"
                      style={{ backgroundColor: "#FED8B1", color: "#6F4E37" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}