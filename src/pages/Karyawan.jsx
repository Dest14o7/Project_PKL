import { useState, useEffect } from "react";
import { Users, Plus, Pencil, Trash2, RotateCcw, Search } from "lucide-react";
import { db } from "../firebase";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc
} from "firebase/firestore";

export default function Karyawan() {
  const [karyawan, setKaryawan] = useState([]);
  const [arsip, setArsip] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showArsip, setShowArsip] = useState(false);
  const [editData, setEditData] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("tetap");
  const [form, setForm] = useState({
    nama: "", userId: "", dept: "", tarifJam: "", tipe: "tetap", status: "aktif",
    gajiPokok: "", saldoCuti: 12, potonganIzinPerHari: "", potonganBPJSTetap: ""
  });

  const fetchKaryawan = async () => {
    const snapshot = await getDocs(collection(db, "karyawan"));
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const sorted = data.sort((a, b) => Number(a.userId) - Number(b.userId));
    setKaryawan(sorted.filter(k => k.status === "aktif"));
    setArsip(sorted.filter(k => k.status === "arsip"));
  };

  useEffect(() => { fetchKaryawan(); }, []);

  const handleSubmit = async () => {
    if (!form.nama || !form.userId) return alert("Nama dan User ID wajib diisi!");

    const normalizedId = form.userId?.toString()?.trim()?.replace(/^0+/, "") || "";
    const dataToSave = {
      ...form,
      userId: normalizedId,
      dept: activeTab === "freelance" ? "freelance" : form.dept,
      tipe: activeTab,
    };

    if (editData) {
      await updateDoc(doc(db, "karyawan", editData.id), dataToSave);
    } else {
      await addDoc(collection(db, "karyawan"), dataToSave);
    }
    setForm({ 
      nama: "", userId: "", dept: "", tarifJam: "", tipe: activeTab, status: "aktif",
      gajiPokok: "", saldoCuti: 12, potonganIzinPerHari: "", potonganBPJSTetap: ""
    });
    setEditData(null);
    setShowForm(false);
    fetchKaryawan();
  };

  const handleEdit = (k) => {
    setEditData(k);
    setForm({ 
      nama: k.nama, userId: k.userId, dept: k.dept, tarifJam: k.tarifJam, 
      tipe: k.tipe, status: k.status, gajiPokok: k.gajiPokok || "", 
      saldoCuti: k.saldoCuti || 12, potonganIzinPerHari: k.potonganIzinPerHari || "", 
      potonganBPJSTetap: k.potonganBPJSTetap || "" 
    });
    setShowForm(true);
  };

  const handleHapus = async (k) => {
    if (!confirm(`Arsipkan ${k.nama}?`)) return;
    await updateDoc(doc(db, "karyawan", k.id), { status: "arsip", arsipAt: new Date().toISOString() });
    fetchKaryawan();
  };

  const handleRestore = async (k) => {
    await updateDoc(doc(db, "karyawan", k.id), { status: "aktif", arsipAt: null });
    fetchKaryawan();
  };

  const handleDeletePermanent = async (k) => {
    if (!confirm(`Hapus permanen ${k.nama}? Data tidak bisa dikembalikan!`)) return;
    await deleteDoc(doc(db, "karyawan", k.id));
    fetchKaryawan();
  };

  const filtered = karyawan.filter(k =>
    k.tipe === activeTab &&
    (k.nama?.toLowerCase().includes(search.toLowerCase()) ||
    k.userId?.toString().includes(search) ||
    k.dept?.toLowerCase().includes(search.toLowerCase()))
  );

  const arsipFiltered = arsip.filter(k => k.tipe === activeTab);
  const tetapCount = karyawan.filter(k => k.tipe === "tetap").length;
  const freelanceCount = karyawan.filter(k => k.tipe === "freelance").length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={28} style={{ color: "#6F4E37" }} />
          <div>
            <h2 className="text-xl font-bold" style={{ color: "#6F4E37" }}>Manajemen Karyawan</h2>
            <p className="text-xs" style={{ color: "#A67B5B" }}>
              {tetapCount} karyawan tetap · {freelanceCount} freelance
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowArsip(!showArsip)}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "#ECB176", color: "#6F4E37" }}
          >
            {showArsip ? "Lihat Aktif" : `Arsip (${arsipFiltered.length})`}
          </button>
          <button
            onClick={() => { setShowForm(true); setEditData(null); setForm({ nama: "", userId: "", dept: "", tarifJam: "", tipe: activeTab, status: "aktif", gajiPokok: "", saldoCuti: 12, potonganIzinPerHari: "", potonganBPJSTetap: "" }); }}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}
          >
            <Plus size={16} /> Tambah {activeTab === "tetap" ? "Karyawan" : "Freelance"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: "tetap", label: `Karyawan Tetap (${tetapCount})` },
          { id: "freelance", label: `Freelance (${freelanceCount})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearch(""); setShowArsip(false); }}
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

      {/* Search */}
      {!showArsip && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3" style={{ color: "#A67B5B" }} />
          <input
            type="text"
            placeholder="Cari nama, user ID, atau departemen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
            style={{ backgroundColor: "white", border: "1px solid #ECB176", color: "#6F4E37" }}
          />
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 sticky top-0 bg-white pb-2 z-10" style={{ color: "#6F4E37" }}>
              {editData ? "Edit Data" : `Tambah ${activeTab === "tetap" ? "Karyawan" : "Freelance"}`}
            </h3>
            <div className="space-y-3 pb-2">

              {/* Nama */}
              <div>
                <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Contoh: Budi Santoso"
                  value={form.nama}
                  onChange={e => setForm({ ...form, nama: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: "1px solid #ECB176", color: "#6F4E37" }}
                />
              </div>

              {/* User ID */}
              <div>
                <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>User ID</label>
                <input
                  type="number"
                  placeholder="Contoh: 1"
                  value={form.userId}
                  onChange={e => setForm({ ...form, userId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: "1px solid #ECB176", color: "#6F4E37" }}
                />
              </div>

              {/* Departemen - khusus karyawan tetap */}
              {activeTab === "tetap" && (
                <div>
                  <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>Departemen</label>
                  <div className="flex gap-2 mt-1 mb-1">
                    {["marketing", "accounting", "operationa"].map(dept => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => setForm({ ...form, dept })}
                        className="px-3 py-1 rounded-full text-xs font-medium transition-all capitalize"
                        style={{
                          backgroundColor: form.dept === dept ? "#6F4E37" : "#FED8B1",
                          color: form.dept === dept ? "#FED8B1" : "#6F4E37",
                          border: "1px solid #ECB176"
                        }}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Atau ketik manual..."
                    value={form.dept}
                    onChange={e => setForm({ ...form, dept: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: "1px solid #ECB176", color: "#6F4E37" }}
                  />
                </div>
              )}

              {/* Gaji Pokok & Tarif Lembur */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>Gaji Pokok (Rp)</label>
                  <input
                    type="number"
                    value={form.gajiPokok}
                    onChange={e => setForm({ ...form, gajiPokok: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>Tarif Lembur / Jam</label>
                  <input
                    type="number"
                    value={form.tarifJam}
                    onChange={e => setForm({ ...form, tarifJam: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]"
                  />
                </div>
              </div>

              {activeTab === "tetap" && (
                <>
                  {/* Saldo Cuti & Potongan Izin */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>Saldo Cuti (Hari)</label>
                      <input
                        type="number"
                        value={form.saldoCuti}
                        onChange={e => setForm({ ...form, saldoCuti: e.target.value })}
                        className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>Pot. Izin / Hari</label>
                      <input
                        type="number"
                        value={form.potonganIzinPerHari}
                        onChange={e => setForm({ ...form, potonganIzinPerHari: e.target.value })}
                        className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]"
                      />
                    </div>
                  </div>

                  {/* BPJS */}
                  <div>
                    <label className="text-xs font-medium" style={{ color: "#6F4E37" }}>Potongan BPJS Tetap (Rp)</label>
                    <input
                      type="number"
                      value={form.potonganBPJSTetap}
                      onChange={e => setForm({ ...form, potonganBPJSTetap: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]"
                    />
                  </div>
                </>
              )}

            </div>
            <div className="flex gap-2 mt-5 sticky bottom-0 bg-white pt-2 z-10">
              <button
                onClick={() => { setShowForm(false); setEditData(null); }}
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
                {editData ? "Simpan Perubahan" : "Tambah"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List Karyawan */}
      {activeTab === "tetap" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(k => (
            <div key={k.id} className="bg-white rounded-2xl p-5 shadow-sm border border-[#ECB176] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg"
                    style={{ backgroundColor: "#FED8B1", color: "#6F4E37" }}>
                    {k.nama?.[0]?.toUpperCase()}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase" style={{ color: "#A67B5B" }}>ID: {k.userId}</p>
                    <p className="text-xs font-medium" style={{ color: "#6F4E37" }}>{k.dept}</p>
                  </div>
                </div>
                <h4 className="font-bold text-lg mb-4" style={{ color: "#6F4E37" }}>{k.nama}</h4>
                
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[11px]">
                  <div>
                    <p style={{ color: "#A67B5B" }}>Gaji Pokok</p>
                    <p className="font-bold" style={{ color: "#6F4E37" }}>Rp {Number(k.gajiPokok || 0).toLocaleString("id-ID")}</p>
                  </div>
                  <div>
                    <p style={{ color: "#A67B5B" }}>Tarif Lembur</p>
                    <p className="font-bold" style={{ color: "#6F4E37" }}>Rp {Number(k.tarifJam || 0).toLocaleString("id-ID")}/jam</p>
                  </div>
                  <div>
                    <p style={{ color: "#A67B5B" }}>Saldo Cuti</p>
                    <p className="font-bold" style={{ color: "#6F4E37" }}>{k.saldoCuti || 0} Hari</p>
                  </div>
                  <div>
                    <p style={{ color: "#A67B5B" }}>Pot. Izin</p>
                    <p className="font-bold" style={{ color: "#6F4E37" }}>Rp {Number(k.potonganIzinPerHari || 0).toLocaleString("id-ID")}/hari</p>
                  </div>
                  <div className="col-span-2">
                    <p style={{ color: "#A67B5B" }}>Potongan BPJS</p>
                    <p className="font-bold" style={{ color: "#6F4E37" }}>Rp {Number(k.potonganBPJSTetap || 0).toLocaleString("id-ID")}/periode</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button 
                  onClick={() => handleEdit(k)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  style={{ backgroundColor: "#ECB176", color: "#6F4E37" }}
                >
                  <Pencil size={14} /> EDIT
                </button>
                <button 
                  onClick={() => handleHapus(k)}
                  className="px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                  style={{ backgroundColor: "#FED8B1", color: "#6F4E37" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}>
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Departemen</th>
                <th className="px-4 py-3 text-left">Gaji Pokok</th>
                <th className="px-4 py-3 text-left">Tarif/Jam</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8" style={{ color: "#A67B5B" }}>
                    Belum ada data freelance
                  </td>
                </tr>
              )}
              {filtered.map((k, i) => (
                <tr key={k.id} style={{ backgroundColor: i % 2 === 0 ? "#fffaf5" : "white" }}>
                  <td className="px-4 py-3" style={{ color: "#6F4E37" }}>{k.userId}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: "#6F4E37" }}>{k.nama}</td>
                  <td className="px-4 py-3" style={{ color: "#A67B5B" }}>{k.dept}</td>
                  <td className="px-4 py-3" style={{ color: "#A67B5B" }}>
                    Rp {Number(k.gajiPokok || 0).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3" style={{ color: "#A67B5B" }}>
                    Rp {Number(k.tarifJam || 0).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEdit(k)} className="p-1.5 rounded-lg" style={{ backgroundColor: "#ECB176", color: "#6F4E37" }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleHapus(k)} className="p-1.5 rounded-lg" style={{ backgroundColor: "#FED8B1", color: "#6F4E37" }}>
                        <Trash2 size={14} />
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
}