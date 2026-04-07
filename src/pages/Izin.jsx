import { useState, useEffect } from "react";
import { FileText, Plus, Trash2, Search } from "lucide-react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";


const jenisIzin = ["Izin", "Sakit", "Izin Terlambat", "Izin 2 Jam", "Cuti"];

export default function Izin() {
  const [izinData, setIzinData] = useState([]);
  const [karyawanList, setKaryawanList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
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

  const fetchData = async () => {
    setLoading(true);
    // Fetch izin
    const izinSnap = await getDocs(collection(db, "izin"));
    const izin = izinSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setIzinData(izin.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)));

    // Fetch karyawan untuk dropdown
    const karyawanSnap = await getDocs(collection(db, "karyawan"));
    const karyawan = karyawanSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(k => k.status === "aktif")
      .sort((a, b) => Number(a.userId) - Number(b.userId));
    setKaryawanList(karyawan);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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
  await addDoc(collection(db, "izin"), {
    ...form,
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

  const filtered = izinData.filter(i =>
    i.nama?.toLowerCase().includes(search.toLowerCase()) ||
    i.jenis?.toLowerCase().includes(search.toLowerCase())
  );

  const jenisColor = {
    "Izin": { bg: "#E8F4FD", color: "#1A5276" },
    "Sakit": { bg: "#F8D7DA", color: "#842029" },
    "Izin Terlambat": { bg: "#FFF3CD", color: "#856404" },
    "Izin 2 Jam": { bg: "#FED8B1", color: "#6F4E37" },
    "Cuti": { bg: "#D4EDDA", color: "#155724" },
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#6F4E37" }}>Manajemen Izin</h2>
          <p className="text-xs mt-1" style={{ color: "#A67B5B" }}>
            Catat izin karyawan sebelum rekap absensi
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}
        >
          <Plus size={16} /> Tambah Izin
        </button>
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