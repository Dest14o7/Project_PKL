import { useState, useEffect } from "react";
import { Settings, Save, Clock, Percent, AlertCircle } from "lucide-react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function Pengaturan() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    lemburSebelumKerja: false,
    periodeAktif: "",
    periodeList: []
  });
  const [newPeriode, setNewPeriode] = useState({ bulan: "Januari", tahun: new Date().getFullYear().toString() });
  
  const bulanList = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const [massal, setMassal] = useState({
    jamMasuk: "08:00", 
    jamPulang: "16:00", 
    jamMasukSabtu: "08:00",
    jamPulangSabtu: "12:00",
    tarifJam: "", 
    potonganIzinPerHari: "", 
    potonganBPJSTetap: "", 
    saldoCuti: 12,
    gajiPokok: ""
  });
  const [savingMassal, setSavingMassal] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const docRef = doc(db, "config", "global");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setConfig(docSnap.data());
      }
    } catch (err) {
      console.error("Gagal memuat konfigurasi", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "config", "global"), config);
      alert("Konfigurasi berhasil disimpan!");
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan konfigurasi!");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMassal = async () => {
    if (!confirm("Apakah Anda yakin ingin menerapkan pengaturan ini ke SEMUA karyawan? Data lama pada setiap karyawan akan tertimpa.")) return;
    setSavingMassal(true);
    try {
      const { collection, getDocs, updateDoc, doc } = await import("firebase/firestore");
      const snap = await getDocs(collection(db, "karyawan"));
      const promises = snap.docs.map(d => {
        const updateData = {};
        if (massal.jamMasuk) updateData.jamMasuk = massal.jamMasuk;
        if (massal.jamPulang) updateData.jamPulang = massal.jamPulang;
        if (massal.jamMasukSabtu) updateData.jamMasukSabtu = massal.jamMasukSabtu;
        if (massal.jamPulangSabtu) updateData.jamPulangSabtu = massal.jamPulangSabtu;
        if (massal.tarifJam) updateData.tarifJam = massal.tarifJam;
        if (massal.potonganIzinPerHari) updateData.potonganIzinPerHari = massal.potonganIzinPerHari;
        if (massal.potonganBPJSTetap) updateData.potonganBPJSTetap = massal.potonganBPJSTetap;
        if (massal.saldoCuti) updateData.saldoCuti = massal.saldoCuti;
        if (massal.gajiPokok) updateData.gajiPokok = massal.gajiPokok;
        return updateDoc(doc(db, "karyawan", d.id), updateData);
      });
      await Promise.all(promises);
      alert("Aturan massal berhasil diterapkan ke semua karyawan!");
      setMassal({ jamMasuk: "", jamPulang: "", tarifJam: "", potonganIzinPerHari: "", potonganBPJSTetap: "", saldoCuti: "" });
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan aturan massal!");
    } finally {
      setSavingMassal(false);
    }
  };

  const handleChange = (path, value) => {
    const keys = path.split(".");
    setConfig(prev => {
      const next = { ...prev };
      let current = next;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return next;
    });
  };


  const handleAddPeriode = () => {
    const pName = `${newPeriode.bulan} ${newPeriode.tahun}`;
    
    setConfig(prev => {
      const list = prev.periodeList || [];
      const exists = list.find(p => (typeof p === 'string' ? p : p.name) === pName);
      if (exists) {
        alert("Periode ini sudah ada!");
        return prev;
      }
      const newItem = { name: pName, bulan: newPeriode.bulan, tahun: newPeriode.tahun };
      return { ...prev, periodeList: [...list, newItem], periodeAktif: pName };
    });
  };

  const handleRemovePeriode = async (pName) => {
    if (!confirm(`Hapus periode ${pName}? SEMUA data terkait (Absensi, Izin, Anomali, dan Gaji) pada periode ini akan ikut terhapus.`)) return;
    
    setSaving(true);
    try {
      const { collection, getDocs, query, where, writeBatch, doc: fsDoc } = await import("firebase/firestore");
      
      // List of collections to prune by period
      const collectionsToPrune = ["absensi", "izin", "anomali", "gaji", "komponenGaji"];
      let totalDeleted = 0;

      for (const colName of collectionsToPrune) {
        // Fetch ALL docs in the collection to be sure we don't miss any due to whitespace/case
        // If collection is too large, this might be slow, but for RekapIn it should be fine.
        const snap = await getDocs(collection(db, colName));
        const docsToDelete = snap.docs.filter(d => {
          const docPeriode = d.data().periode;
          if (!docPeriode || typeof docPeriode !== 'string') return false;
          
          // Special case for komponenGaji: only delete non-recurring
          if (colName === "komponenGaji" && d.data().isRecurring) return false;

          return docPeriode.trim().toLowerCase() === pName.trim().toLowerCase();
        });

        if (docsToDelete.length > 0) {
          // Firestore batches are limited to 500 operations
          for (let i = 0; i < docsToDelete.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = docsToDelete.slice(i, i + 500);
            chunk.forEach(d => batch.delete(fsDoc(db, colName, d.id)));
            await batch.commit();
            totalDeleted += chunk.length;
          }
        }
      }
      
      // Update config
      const list = (config.periodeList || []).filter(p => {
        const name = (typeof p === 'string' ? p : p.name).trim().toLowerCase();
        return name !== pName.trim().toLowerCase();
      });
      const nextPeriodeAktif = (config.periodeAktif || "").trim().toLowerCase() === pName.trim().toLowerCase() 
        ? (list[0]?.name || list[0] || "") 
        : config.periodeAktif;
      
      const newConfig = { ...config, periodeList: list, periodeAktif: nextPeriodeAktif };
      await setDoc(doc(db, "config", "global"), newConfig);
      setConfig(newConfig);
      
      alert(`Berhasil menghapus periode ${pName} dan ${totalDeleted} data terkait.`);
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus periode dan data terkait: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10" style={{ color: "#6F4E37" }}>Memuat konfigurasi...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings size={28} style={{ color: "#6F4E37" }} />
          <div>
            <h2 className="text-xl font-bold" style={{ color: "#6F4E37" }}>Konfigurasi Global</h2>
            <p className="text-xs" style={{ color: "#A67B5B" }}>
              Atur parameter perhitungan absensi dan penggajian
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}
        >
          <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel Konfigurasi Gabungan */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-[#ECB176]">
          
          {/* Section: Lembur Sebelum Kerja */}
          <div className="mb-6">
            <div className="flex items-center justify-between p-3 rounded-lg border border-[#ECB176] bg-[#FFF8F0]">
              <div>
                <p className="text-sm font-medium" style={{ color: "#6F4E37" }}>Lembur Sebelum Jam Kerja</p>
                <p className="text-xs" style={{ color: "#A67B5B" }}>Aktifkan hitungan lembur jika scan pagi lebih awal.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.lemburSebelumKerja || false}
                  onChange={e => handleChange("lemburSebelumKerja", e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6F4E37]"></div>
              </label>
            </div>
          </div>

          {/* Section: Manajemen Periode Kerja */}
          <div>
            <label className="text-xs font-bold uppercase mb-2 block" style={{ color: "#6F4E37" }}>Manajemen Periode Kerja</label>
            
            {/* Tambah Periode Baru (Bulan & Tahun) */}
            <div className="space-y-3 mb-6 p-4 rounded-lg border border-[#FED8B1] bg-white">
              <p className="text-[10px] font-bold text-[#A67B5B] uppercase">Buat Periode Baru</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#6F4E37" }}>Bulan</label>
                  <select
                    value={newPeriode.bulan}
                    onChange={e => setNewPeriode({ ...newPeriode, bulan: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]"
                  >
                    {bulanList.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#6F4E37" }}>Tahun</label>
                  <select 
                    value={newPeriode.tahun} 
                    onChange={e => setNewPeriode({...newPeriode, tahun: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]"
                  >
                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                      <option key={y} value={y.toString()}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button 
                onClick={handleAddPeriode}
                className="w-full mt-2 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}
              >
                Tambah Periode Baru
              </button>
            </div>

            {/* Daftar Periode */}
            <div className="border border-[#ECB176] rounded-lg overflow-hidden bg-white">
              <table className="w-full text-sm text-left">
                <thead style={{ backgroundColor: "#FFF8F0", color: "#A67B5B" }}>
                  <tr>
                    <th className="px-3 py-2 font-medium">Nama Periode</th>
                    <th className="px-3 py-2 font-medium text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {!(config.periodeList && config.periodeList.length > 0) ? (
                    <tr>
                      <td colSpan="2" className="px-3 py-4 text-center text-xs" style={{ color: "#A67B5B" }}>Belum ada periode yang dibuat</td>
                    </tr>
                  ) : (
                    config.periodeList.map(p => {
                      const pName = typeof p === 'string' ? p : p.name;
                      return (
                        <tr key={pName} className="border-t border-[#ECB176]">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium" style={{ color: "#6F4E37" }}>{pName}</span>
                              {config.periodeAktif === pName && (
                                <span className="px-1.5 py-0.5 text-[8px] rounded-full font-bold bg-green-100 text-green-700">AKTIF</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex justify-center gap-2">
                              {config.periodeAktif !== pName && (
                                <button 
                                  onClick={() => handleChange("periodeAktif", pName)}
                                  className="text-[10px] px-2 py-1 rounded border hover:bg-amber-50"
                                  style={{ borderColor: "#ECB176", color: "#6F4E37" }}
                                >
                                  Aktifkan
                                </button>
                              )}
                              <button 
                                onClick={() => handleRemovePeriode(pName)}
                                className="text-[10px] px-2 py-1 rounded border hover:bg-red-50 text-red-600 border-red-200"
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>

        {/* Panel Aturan Massal */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-[#ECB176]">
          <div className="flex items-center gap-2 mb-4" style={{ color: "#6F4E37" }}>
            <Settings size={20} />
            <h3 className="font-semibold">Aturan Massal Karyawan</h3>
          </div>
          <p className="text-xs mb-4" style={{ color: "#A67B5B" }}>
            Gunakan form ini untuk memperbarui pengaturan yang sama secara massal ke semua karyawan. Kosongkan field jika tidak ingin diubah.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium" style={{ color: "#A67B5B" }}>Jam Masuk</label>
              <input type="time" value={massal.jamMasuk} onChange={e => setMassal({...massal, jamMasuk: e.target.value})} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "#A67B5B" }}>Jam Pulang</label>
              <input type="time" value={massal.jamPulang} onChange={e => setMassal({...massal, jamPulang: e.target.value})} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "#A67B5B" }}>Jam Masuk (Sabtu)</label>
              <input type="time" value={massal.jamMasukSabtu} onChange={e => setMassal({...massal, jamMasukSabtu: e.target.value})} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "#A67B5B" }}>Jam Pulang (Sabtu)</label>
              <input type="time" value={massal.jamPulangSabtu} onChange={e => setMassal({...massal, jamPulangSabtu: e.target.value})} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "#A67B5B" }}>Saldo Cuti (Hari)</label>
              <input type="number" value={massal.saldoCuti} onChange={e => setMassal({...massal, saldoCuti: e.target.value})} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "#A67B5B" }}>Gaji Pokok (Rp)</label>
              <input type="number" value={massal.gajiPokok} onChange={e => setMassal({...massal, gajiPokok: e.target.value})} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "#A67B5B" }}>Tarif Lembur / Jam (Rp)</label>
              <input type="number" value={massal.tarifJam} onChange={e => setMassal({...massal, tarifJam: e.target.value})} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "#A67B5B" }}>Tarif Potongan Izin / Hari (Rp)</label>
              <input type="number" value={massal.potonganIzinPerHari} onChange={e => setMassal({...massal, potonganIzinPerHari: e.target.value})} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "#A67B5B" }}>Nominal BPJS Tetap (Rp)</label>
              <input type="number" value={massal.potonganBPJSTetap} onChange={e => setMassal({...massal, potonganBPJSTetap: e.target.value})} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none border border-[#ECB176] focus:border-[#6F4E37]" />
            </div>
            
          
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSaveMassal}
              disabled={savingMassal}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#ECB176", color: "#6F4E37" }}
            >
              {savingMassal ? "Menerapkan..." : "Terapkan ke Semua Karyawan"}
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-[#FFF8F0] p-4 rounded-xl flex gap-3 border border-[#ECB176]">
        <AlertCircle size={20} className="text-[#6F4E37] shrink-0" />
        <p className="text-xs" style={{ color: "#A67B5B" }}>
          Perubahan pada halaman ini akan langsung mempengaruhi perhitungan absen dan lembur pada data yang di-upload setelah perubahan disimpan. 
          Jika Anda telah mengubah aturan keterlambatan atau toleransi pulang, Anda perlu meng-upload ulang file absensi agar data dikalkulasi ulang menggunakan aturan baru.
        </p>
      </div>

    </div>
  );
}
