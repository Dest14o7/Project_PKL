import { useState, useEffect } from "react";
import { Download, FileText, Search, Layout } from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs, doc, getDoc, query, where, deleteDoc } from "firebase/firestore";
import { exportSlipGajiPDF } from "../utils/exportPDF";

export default function SlipGaji() {
  const [absensiData, setAbsensiData] = useState([]);
  const [gajiCollectionData, setGajiCollectionData] = useState([]);
  const [karyawanData, setKaryawanData] = useState([]);
  const [komponenData, setKomponenData] = useState([]);
  const [izinData, setIzinData] = useState([]);
  const [config, setConfig] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPeriode, setFilterPeriode] = useState("");
  const [periodeList, setPeriodeList] = useState([]);
  const [layout, setLayout] = useState(1);
  const [activeTab, setActiveTab] = useState("tetap");
  const [templateConfig, setTemplateConfig] = useState({ logoKop: "", watermark: "", namaFinance: "" });
  const [savingTemplate, setSavingTemplate] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    try {
      const confSnap = await getDoc(doc(db, "config", "global"));
      const confData = confSnap.exists() ? confSnap.data() : null;
      if (confData) {
        setConfig(confData);
        if (confData.periodeAktif && !filterPeriode) {
          setFilterPeriode(confData.periodeAktif);
        }
      }
      
      const templateSnap = await getDoc(doc(db, "config", "slipGaji"));
      if (templateSnap.exists()) {
        setTemplateConfig(templateSnap.data());
      }

      const qAbsensi = filterPeriode && filterPeriode !== "semua" ? query(collection(db, "absensi"), where("periode", "==", filterPeriode)) : collection(db, "absensi");
      const absensiSnap = await getDocs(qAbsensi);
      const absSnap = absensiSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAbsensiData(absSnap);

      // Fetch fallback from gaji collection
      const qGaji = filterPeriode && filterPeriode !== "semua" ? query(collection(db, "gaji"), where("periode", "==", filterPeriode)) : collection(db, "gaji");
      const gajiSnap = await getDocs(qGaji);
      const gjData = gajiSnap.docs.map(d => ({ id: d.id, ...d.data(), fromCollection: true }));
      setGajiCollectionData(gjData);

      const karyawanSnap = await getDocs(collection(db, "karyawan"));
      setKaryawanData(karyawanSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const qKomponen = filterPeriode && filterPeriode !== "semua" ? query(collection(db, "komponenGaji"), where("periode", "==", filterPeriode)) : collection(db, "komponenGaji");
      const komponenSnap = await getDocs(qKomponen);
      setKomponenData(komponenSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const qIzin = filterPeriode && filterPeriode !== "semua" ? query(collection(db, "izin"), where("periode", "==", filterPeriode)) : collection(db, "izin");
      const izinSnap = await getDocs(qIzin);
      setIzinData(izinSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch ALL izin for balance tracking (across all periods)
      const allIzinSnap = await getDocs(collection(db, "izin"));
      const allIzin = allIzinSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      window._allIzinData = allIzin; // Temporary storage for use in gajiList

      // Combine periods
      let allPeriods = [];
      if (confData?.periodeList) {
        allPeriods = confData.periodeList.map(p => typeof p === 'string' ? p : p.name);
      }
      const monthOrder = {
        "januari": 1, "februari": 2, "maret": 3, "april": 4, "mei": 5, "juni": 6,
        "juli": 7, "agustus": 8, "september": 9, "oktober": 10, "november": 11, "desember": 12
      };

      const sortedPeriods = allPeriods.sort((a, b) => {
        const parse = (p) => {
          if (!p) return 0;
          if (p.includes("-") && p.length === 7) return new Date(p).getTime();
          const parts = p.split(" ");
          if (parts.length === 2) {
            const m = monthOrder[parts[0].toLowerCase()] || 0;
            const y = parseInt(parts[1]);
            return new Date(y, m - 1).getTime();
          }
          return 0;
        };
        return parse(b) - parse(a);
      });

      setPeriodeList(sortedPeriods);

      if (!filterPeriode && sortedPeriods.length > 0) {
        const defaultP = (confData?.periodeAktif && sortedPeriods.includes(confData.periodeAktif))
            ? confData.periodeAktif
            : sortedPeriods[0];
        setFilterPeriode(defaultP);
      }
    } catch (err) {
      console.error("SlipGaji fetchData error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterPeriode]);

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert("Ukuran file maksimal 2MB!");
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setTemplateConfig(prev => ({ ...prev, [field]: event.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSimpanTemplate = async () => {
    setSavingTemplate(true);
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "config", "slipGaji"), templateConfig);
      alert("Pengaturan template slip gaji berhasil disimpan!");
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan template!");
    }
    setSavingTemplate(false);
  };

  const gajiList = (() => {
    const list = [];
    const processedKeys = new Set();

    // 1. Process Absensi Data
    absensiData.forEach(absensi => {
      const k = karyawanData.find(k => k?.userId?.toString() === absensi?.userId?.toString());
      const tarifJam = Number(k?.tarifJam || 0);
      const gajiPokokBulan = Number(k?.gajiPokok || 0);
      const potonganIzinPerHari = Number(k?.potonganIzinPerHari || 0);
      const potonganBPJSTetap = Number(k?.potonganBPJSTetap || 0);
      
      const totalJamKerja = absensi.rekap?.totalJamKerja || 0;
      const totalJamLembur = absensi.rekap?.totalJamLembur || 0;
      
      const gajiPokok = gajiPokokBulan > 0 ? gajiPokokBulan : (totalJamKerja * tarifJam);
      const upahLembur = totalJamLembur * tarifJam;

      const myIzin = (izinData || []).filter(i => {
        if (i?.userId?.toString() !== absensi?.userId?.toString()) return false;
        if (i.periode) return i.periode === absensi.periode;
        const tgl = i.tglMulai || i.tanggal;
        return tgl?.startsWith(absensi.periode.substring(0, 7));
      });

      const izinSummary = myIzin.reduce((acc, curr) => {
        const days = Number(curr.totalHari || 0);
        const jenis = curr.jenis?.toLowerCase() || "";
        if (jenis === "sakit") acc.sakit += days;
        else if (jenis === "cuti") acc.cuti += days;
        else if (jenis.includes("setengah hari")) acc.setengahHari += days;
        else if (jenis === "izin") acc.izin += days;
        return acc;
      }, { izin: 0, sakit: 0, cuti: 0, setengahHari: 0 });

      const manualHariIzin = absensi.manualPotonganIzinHari;
      const isManual = manualHariIzin !== undefined && manualHariIzin !== null;
      
      // Hitung total hari yang dipotong: Izin + Setengah Hari
      const totalHariPotonganIzin = k?.tipe === 'freelance' ? 0 : (isManual ? manualHariIzin : (izinSummary.izin + izinSummary.setengahHari));
      const nilaiPotonganIzin = totalHariPotonganIzin * potonganIzinPerHari;

      const myKomponen = (komponenData || []).filter(c => 
        c?.userId?.toString() === absensi?.userId?.toString() && 
        (c.isRecurring || c.periode === absensi.periode)
      );

      const bonusList = myKomponen.filter(c => c.kategori === "bonus");
      const potonganList = myKomponen.filter(c => c.kategori === "potongan");

      const totalBonus = bonusList.reduce((sum, b) => sum + b.nominal, 0);
      const totalPotonganManual = potonganList.reduce((sum, p) => sum + p.nominal, 0);

      const isFreelance = k?.tipe === 'freelance';
      const totalPotonganOtomatis = isFreelance ? 0 : (potonganBPJSTetap + nilaiPotonganIzin);
      const totalSemuaPotongan = totalPotonganManual + totalPotonganOtomatis;

      const takeHomePay = gajiPokok + upahLembur + totalBonus - totalSemuaPotongan;

      const totalCutiTaken = (window._allIzinData || []).filter(i => 
        i?.userId?.toString() === absensi?.userId?.toString() && 
        i?.jenis?.toLowerCase() === "cuti"
      ).reduce((sum, i) => sum + Number(i.totalHari || 0), 0);
      
      const saldoCutiAktif = (k?.saldoCuti ?? 12) - totalCutiTaken;

      const obj = {
        userId: absensi.userId,
        nama: absensi.nama,
        dept: absensi.dept,
        tipe: k?.tipe || "tetap",
        periode: absensi.periode,
        totalJamLembur,
        gajiPokok,
        upahLembur,
        bonusList,
        potonganList,
        potonganBPJSTetap: isFreelance ? 0 : potonganBPJSTetap,
        nilaiPotonganIzin: isFreelance ? 0 : nilaiPotonganIzin,
        totalHariPotonganIzin: isFreelance ? 0 : totalHariPotonganIzin,
        takeHomePay,
        saldoCuti: saldoCutiAktif,
        izinSummary,
        isManual,
      };
      list.push(obj);
      processedKeys.add(`${obj.userId}_${obj.periode}`);
    });

    // 2. Process Gaji Collection (fallback)
    gajiCollectionData.forEach(gj => {
      const key = `${gj.userId}_${gj.periode}`;
      if (!processedKeys.has(key)) {
        list.push({ ...gj, fromCollection: true });
        processedKeys.add(key);
      }
    });

    return list;
  })();



  let filtered = gajiList.filter(g => g.tipe === activeTab);
  if (filterPeriode) filtered = filtered.filter(g => g.periode === filterPeriode);
  if (search) filtered = filtered.filter(g =>
    g.nama?.toLowerCase().includes(search.toLowerCase()) ||
    g.dept?.toLowerCase().includes(search.toLowerCase())
  );
  filtered.sort((a, b) => Number(a.userId) - Number(b.userId));

  const deleteAbsensiData = async (periode, userId = null) => {
    try {
      let q = query(collection(db, "absensi"), where("periode", "==", periode));
      if (userId) {
        q = query(collection(db, "absensi"), where("periode", "==", periode), where("userId", "==", userId));
      }
      const snap = await getDocs(q);
      if (snap.empty) return;

      const promises = snap.docs.map(d => deleteDoc(doc(db, "absensi", d.id)));
      await Promise.all(promises);
      console.log(`Data absensi ${userId ? `User ${userId}` : "Massal"} periode ${periode} berhasil dihapus otomatis.`);
      fetchData();
    } catch (err) {
      console.error("Gagal menghapus data absensi otomatis:", err);
    }
  };

  const handleDownloadMassal = () => {
    if (filtered.length === 0) return alert("Tidak ada data slip gaji pada periode ini.");
    
    const confirmMsg = `Apakah Anda yakin ingin mengunduh massal? \n\nPERHATIAN: Sistem akan MENGHAPUS data absensi harian untuk periode ${filterPeriode} setelah unduhan dimulai. Data gaji tetap tersimpan di database.`;
    if (!confirm(confirmMsg)) return;

    exportSlipGajiPDF(filtered, filterPeriode || "Slip_Gaji", layout, templateConfig);
    
    // Trigger auto-delete
    setTimeout(() => {
      deleteAbsensiData(filterPeriode);
    }, 2000);
  };

  const handleCetakMassal = () => {
    if (filtered.length === 0) return alert("Tidak ada data slip gaji pada periode ini.");
    exportSlipGajiPDF(filtered, filterPeriode || "Slip_Gaji", layout, templateConfig, "preview");
  };

  const handleDownloadSingle = (g) => {
    const confirmMsg = `Unduh slip gaji untuk ${g.nama}? \n\nData absensi harian untuk karyawan ini pada periode ${g.periode} akan dihapus otomatis.`;
    if (!confirm(confirmMsg)) return;

    exportSlipGajiPDF([g], filterPeriode || g.periode, 1, templateConfig);
    
    // Trigger auto-delete
    setTimeout(() => {
      deleteAbsensiData(g.periode, g.userId);
    }, 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#6F4E37" }}>Slip Gaji & Cetak</h2>
          <p className="text-xs mt-1" style={{ color: "#A67B5B" }}>
            Pratinjau dan unduh massal Slip Gaji karyawan.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCetakMassal}
            className="px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all hover:scale-105"
            style={{ backgroundColor: "white", color: "#6F4E37", border: "1px solid #6F4E37" }}
          >
            <Layout size={18} /> Cetak Slip (Buka Tab Baru)
          </button>
          <button
            onClick={handleDownloadMassal}
            className="px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all hover:scale-105"
            style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}
          >
            <Download size={18} /> Unduh Massal PDF
          </button>
        </div>
      </div>

      {/* Template Configuration */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-[#ECB176] border-opacity-40 mb-6">
        <h3 className="text-sm font-bold mb-4" style={{ color: "#6F4E37" }}>Konfigurasi Template Slip Gaji</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: "#A67B5B" }}>Logo Kop Surat (Maks 2MB)</label>
              <div className="mt-2 relative">
                <label className="cursor-pointer px-3 py-1.5 rounded bg-gray-100 border text-xs font-medium hover:bg-gray-200 transition-colors inline-block">
                  Choose file
                  <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={e => handleImageUpload(e, "logoKop")} />
                </label>
                {templateConfig.logoKop && (
                  <div className="mt-2 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center h-20 w-full">
                    <img src={templateConfig.logoKop} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                )}
                {!templateConfig.logoKop && <span className="text-[10px] ml-2 text-gray-400 italic">Belum ada file</span>}
              </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: "#A67B5B" }}>Logo Watermark (Maks 2MB)</label>
              <div className="mt-2 relative">
                <label className="cursor-pointer px-3 py-1.5 rounded bg-gray-100 border text-xs font-medium hover:bg-gray-200 transition-colors inline-block">
                  Choose file
                  <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={e => handleImageUpload(e, "watermark")} />
                </label>
                {templateConfig.watermark && (
                  <div className="mt-2 border rounded-lg overflow-hidden flex items-center justify-center h-20 w-full" 
                    style={{ 
                      backgroundImage: "linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%)",
                      backgroundSize: "10px 10px",
                      backgroundPosition: "0 0, 0 5px, 5px 5px, 5px 0"
                    }}>
                    <img src={templateConfig.watermark} alt="Watermark Preview" className="max-h-full max-w-full object-contain opacity-50" />
                  </div>
                )}
                {!templateConfig.watermark && <span className="text-[10px] ml-2 text-gray-400 italic">Belum ada file</span>}
              </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: "#A67B5B" }}>Nama Finance (Tanda Tangan)</label>
            <input 
              type="text" 
              placeholder="Contoh: Ivana" 
              value={templateConfig.namaFinance} 
              onChange={e => setTemplateConfig({...templateConfig, namaFinance: e.target.value})}
              className="w-full px-3 py-1.5 rounded border text-sm outline-none" 
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button 
            onClick={handleSimpanTemplate} 
            disabled={savingTemplate}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#ECB176", color: "#6F4E37" }}
          >
            {savingTemplate ? "Menyimpan..." : "Simpan Pengaturan Template"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { id: "tetap", label: "Karyawan Reguler" },
          { id: "freelance", label: "Freelance" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearch(""); }}
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

      {/* Control Panel */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-[#ECB176] border-opacity-40">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Periode Filter */}
          <div>
            <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "#A67B5B" }}>Periode Cetak</label>
            <select
              value={filterPeriode}
              onChange={e => setFilterPeriode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
              style={{ borderColor: "#ECB176", color: "#6F4E37", backgroundColor: "#fffaf5" }}
            >

              {periodeList.map(p => {
                const name = typeof p === 'string' ? p : p.name;
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          </div>

          {/* Layout Setting */}
          <div>
            <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "#A67B5B" }}>Layout Halaman PDF</label>
            <div className="flex bg-[#fffaf5] rounded-lg p-1 border" style={{ borderColor: "#ECB176" }}>
              <button 
                onClick={() => setLayout(1)}
                className="flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-colors"
                style={{ 
                  backgroundColor: layout === 1 ? "#6F4E37" : "transparent", 
                  color: layout === 1 ? "#FED8B1" : "#A67B5B" 
                }}
              >
                <Layout size={14}/> 1 Per Halaman
              </button>
              <button 
                onClick={() => setLayout(2)}
                className="flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-colors"
                style={{ 
                  backgroundColor: layout === 2 ? "#6F4E37" : "transparent", 
                  color: layout === 2 ? "#FED8B1" : "#A67B5B" 
                }}
              >
                <Layout size={14}/> 2 Per Halaman
              </button>
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "#A67B5B" }}>Cari Karyawan</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5" style={{ color: "#A67B5B" }} />
              <input
                type="text"
                placeholder="Nama atau Departemen..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none border"
                style={{ borderColor: "#ECB176", color: "#6F4E37", backgroundColor: "#fffaf5" }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Preview Stats */}
      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#6F4E37" }}>
        <FileText size={18} style={{ color: "#ECB176" }}/> 
        Pratinjau {filtered.length} Slip Gaji untuk diunduh
      </div>

      {/* Grid Preview */}
      {loading ? (
        <div className="text-center py-12"><div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto border-[#ECB176] border-t-[#6F4E37]" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-[#ECB176] border-opacity-30">
          <FileText size={40} className="mx-auto mb-3" style={{ color: "#ECB176" }} />
          <p className="font-semibold" style={{ color: "#6F4E37" }}>Tidak ada slip gaji untuk ditampilkan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((g, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-[#ECB176] border-opacity-40 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-base" style={{ color: "#6F4E37" }}>{g.nama}</p>
                    <p className="text-xs font-medium" style={{ color: "#A67B5B" }}>{g.dept} · {g.tipe === 'freelance' ? 'Freelance' : 'Reguler'}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-md" style={{ backgroundColor: "#FED8B1", color: "#6F4E37" }}>
                    ID: {g.userId}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: "#A67B5B" }}>Pendapatan</span>
                    <span className="font-medium text-green-700">
                      Rp {(
                        (g.gajiPokok || 0) + 
                        (g.upahLembur || 0) + 
                        (g.bonusList?.reduce((s,b)=>s+b.nominal,0) || 0)
                      ).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#A67B5B" }}>Potongan</span>
                    <span className="font-medium text-red-600">
                      Rp {(
                        (g.tipe === 'freelance' ? 0 : (g.potonganBPJSTetap || 0)) + 
                        (g.tipe === 'freelance' ? 0 : (g.nilaiPotonganIzin || 0)) + 
                        (g.potonganList?.reduce((s,p)=>s+p.nominal,0) || 0)
                      ).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-dashed flex justify-between items-center" style={{ borderColor: "#ECB176" }}>
                <div className="flex flex-col">
                  <span className="text-xs font-bold" style={{ color: "#6F4E37" }}>TAKE HOME PAY</span>
                  <span className="text-sm font-black" style={{ color: "#6F4E37" }}>Rp {g.takeHomePay.toLocaleString("id-ID")}</span>
                </div>
                <button 
                  onClick={() => handleDownloadSingle(g)}
                  className="p-2 rounded-lg bg-[#FED8B1] text-[#6F4E37] hover:bg-[#ECB176] transition-colors"
                  title="Unduh Slip Individu"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
