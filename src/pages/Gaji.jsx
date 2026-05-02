import { useState, useEffect } from "react";
import { DollarSign, ChevronDown, ChevronUp, Search } from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc, getDoc, addDoc, updateDoc } from "firebase/firestore";
import { exportRekapAbsen } from "../utils/exportExcel";
import { exportRekapGaji } from "../utils/exportPDF";
import { terbilang } from "../utils/terbilang";

export default function Gaji() {
  const [absensiData, setAbsensiData] = useState([]);
  const [karyawanData, setKaryawanData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("reguler");
  const [periodeAktif, setPeriodeAktif] = useState("");
  const [filterPeriode, setFilterPeriode] = useState("");
  const [allPeriods, setAllPeriods] = useState([]);
  const [izinData, setIzinData] = useState([]);
  const [komponenData, setKomponenData] = useState([]);
  const [activeDetailTab, setActiveDetailTab] = useState({});
  const [bonusForm, setBonusForm] = useState({ nama: "", nominal: "", tipe: "one-time" });
  const [potonganForm, setPotonganForm] = useState({ nama: "", nominal: "" });
  const [editIzinMode, setEditIzinMode] = useState(null);
  const [manualIzinValue, setManualIzinValue] = useState("");
  const [editLemburMode, setEditLemburMode] = useState(null);
  const [manualLemburValue, setManualLemburValue] = useState("");

  const fetchData = async () => {
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
      setPeriodeAktif(activeP);

      if (!filterPeriode && activeP) setFilterPeriode(activeP);

      // 2. Fetch Data
      const absensiSnap = await getDocs(collection(db, "absensi"));
      const absensi = absensiSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const karyawanSnap = await getDocs(collection(db, "karyawan"));
      const karyawan = karyawanSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const izinSnap = await getDocs(collection(db, "izin"));
      const izin = izinSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const komponenSnap = await getDocs(collection(db, "komponenGaji"));
      const komponen = komponenSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setAbsensiData(absensi);
      setKaryawanData(karyawan);
      setIzinData(izin);
      setKomponenData(komponen);
    } catch (err) {
      console.error("Gaji Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Export logic removed from Gaji menu as per Section 8.10

  useEffect(() => { 
    fetchData(); 
  }, []);

  const handleSaveKomponen = async (gajiItem, kategori) => {
    try {
      const isBonus = kategori === "bonus";
      const form = isBonus ? bonusForm : potonganForm;
      if (!form.nama || !form.nominal) return alert("Nama dan nominal wajib diisi!");
      
      const payload = {
        userId: gajiItem.userId,
        kategori,
        nama: form.nama,
        nominal: Number(form.nominal),
        periode: isBonus && form.tipe === "recurring" ? "" : gajiItem.periode,
        tipe: isBonus ? form.tipe : "one-time",
        createdAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, "komponenGaji"), payload);
      
      if (isBonus) setBonusForm({ nama: "", nominal: "", tipe: "one-time" });
      else setPotonganForm({ nama: "", nominal: "" });
      
      fetchData();
    } catch (err) {
      console.error("Save komponen error:", err);
    }
  };

  const handleDeleteKomponen = async (id) => {
    if (!window.confirm("Hapus komponen ini?")) return;
    try {
      await deleteDoc(doc(db, "komponenGaji", id));
      fetchData();
    } catch (err) {
      console.error("Delete komponen error:", err);
    }
  };

  const handleSaveIzinManual = async (gajiItem) => {
    try {
      const value = parseFloat(manualIzinValue);
      if (isNaN(value) || value < 0) return alert("Nilai tidak valid. Harus angka >= 0.");
      
      await updateDoc(doc(db, "absensi", gajiItem.id), {
        isManualIzin: true,
        manualPotonganIzinHari: value
      });
      
      await addDoc(collection(db, "auditLogs"), {
        action: "EDIT_POTONGAN_IZIN",
        userId: gajiItem.userId,
        periode: gajiItem.periode,
        adminId: "admin", 
        oldValue: gajiItem.totalHariPotonganIzin,
        newValue: value,
        timestamp: new Date().toISOString()
      });
      
      setEditIzinMode(null);
      fetchData();
    } catch (err) {
      console.error("Save izin manual error:", err);
    }
  };

  const handleResetIzinManual = async (gajiItem) => {
    if (!window.confirm("Kembalikan ke hitungan otomatis?")) return;
    try {
      await updateDoc(doc(db, "absensi", gajiItem.id), {
        isManualIzin: false,
        manualPotonganIzinHari: 0
      });
      fetchData();
    } catch (err) {
      console.error("Reset izin manual error:", err);
    }
  };

  const handleSaveLemburManual = async (gajiItem) => {
    try {
      const value = parseFloat(manualLemburValue);
      if (isNaN(value) || value < 0) return alert("Nilai tidak valid. Harus angka >= 0.");
      
      await updateDoc(doc(db, "absensi", gajiItem.id), {
        isManualLembur: true,
        manualUpahLembur: value
      });
      
      await addDoc(collection(db, "auditLogs"), {
        action: "EDIT_UPAH_LEMBUR",
        userId: gajiItem.userId,
        periode: gajiItem.periode,
        adminId: "admin", 
        oldValue: gajiItem.upahLembur,
        newValue: value,
        timestamp: new Date().toISOString()
      });
      
      setEditLemburMode(null);
      fetchData();
    } catch (err) {
      console.error("Save lembur manual error:", err);
    }
  };

  const handleResetLemburManual = async (gajiItem) => {
    if (!window.confirm("Kembalikan ke hitungan otomatis?")) return;
    try {
      await updateDoc(doc(db, "absensi", gajiItem.id), {
        isManualLembur: false,
        manualUpahLembur: 0
      });
      fetchData();
    } catch (err) {
      console.error("Reset lembur manual error:", err);
    }
  };

  // Fungsi bantu untuk normalisasi periode
  const normalizePeriode = (rawPeriode) => {
    let p = rawPeriode || "";
    if (p.includes("~")) {
      const [start] = p.split("~");
      const parts = start.trim().split(/[-/]/);
      let y, m;
      if (parts[0]?.length === 4) { [y, m] = parts; }
      else if (parts[2]?.length === 4) { [m, , y] = [parts[1], parts[0], parts[2]]; }
      
      if (y && m) {
        const bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        p = `${bulanIndo[parseInt(m) - 1] || "Bulan"} ${y}`;
      }
    }
    return p;
  };

  // Gabungkan absensi dengan data karyawan
  const uniqueAbsensiData = [];
  const seenAbsensi = new Set();
  for (const abs of absensiData) {
    const normP = normalizePeriode(abs.periode);
    const key = `${abs.userId?.toString().trim().replace(/^0+/, "")}_${normP}`;
    if (!seenAbsensi.has(key)) {
      seenAbsensi.add(key);
      uniqueAbsensiData.push({ ...abs, displayPeriode: normP });
    }
  }

  const gajiList = uniqueAbsensiData.map(absensi => {
    try {
      const karyawan = karyawanData.find(k =>
        k.userId?.toString()?.trim()?.replace(/^0+/, "") === absensi.userId?.toString()?.trim()?.replace(/^0+/, "")
      );
      
      // Filter karyawan yang diarsip agar tidak muncul di menu gaji
      if (!karyawan || karyawan.status === "arsip") return null;

      let displayPeriode = absensi.displayPeriode;

      const [bulan, tahun] = displayPeriode.split(" ");
      const bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const bulanIndex = bulanIndo.indexOf(bulan) + 1;
      const monthPrefix = (bulanIndex > 0 && tahun) ? `${tahun}-${bulanIndex.toString().padStart(2, "0")}` : "";

      const listIzinKaryawan = izinData.filter(i => {
        const sameUser = i.userId?.toString()?.replace(/^0+/, "") === absensi.userId?.toString()?.replace(/^0+/, "");
        // Gunakan tglMulai sebagai referensi tanggal utama, fallback ke tanggal
        const refTanggal = i.tglMulai || i.tanggal || "";
        const matchPeriode = monthPrefix ? refTanggal.startsWith(monthPrefix) : true;
        return sameUser && matchPeriode;
      });

      // Hitung total hari per jenis (bukan jumlah dokumen)
      const counts = {
        Izin: listIzinKaryawan.filter(i => i.jenis?.toLowerCase() === "izin").reduce((sum, i) => sum + Number(i.totalHari || 1), 0),
        Sakit: listIzinKaryawan.filter(i => i.jenis?.toLowerCase() === "sakit").reduce((sum, i) => sum + Number(i.totalHari || 1), 0),
        Cuti: listIzinKaryawan.filter(i => i.jenis?.toLowerCase() === "cuti").reduce((sum, i) => sum + Number(i.totalHari || 1), 0),
        Setengah: listIzinKaryawan.filter(i => i.jenis?.toLowerCase()?.includes("setengah")).reduce((sum, i) => sum + Number(i.totalHari || 0.5), 0),
      };

      const tarifJam = Number(karyawan?.tarifJam || 0);
      const totalJamKerja = absensi.rekap?.totalJamKerja || 0;
      const totalJamLembur = absensi.rekap?.totalJamLembur || 0;
      const totalLemburKasar = absensi.rekap?.totalLemburKasar || 0;
      const totalPenguranganLembur = absensi.rekap?.totalPenguranganLembur || 0;
      
      const gajiPokok = Number(karyawan?.gajiPokok || 0);
      let upahLembur = totalJamLembur * tarifJam;
      if (absensi.isManualLembur) {
        upahLembur = Number(absensi.manualUpahLembur || 0);
      }
      
      const potBPJS = karyawan.tipe === "tetap" ? Number(karyawan.potonganBPJSTetap || 0) : 0;
      let totalHariPotonganIzin = karyawan.tipe === "freelance" ? 0 : (counts.Izin + counts.Setengah);
      if (karyawan.tipe !== "freelance" && absensi.isManualIzin) {
        totalHariPotonganIzin = Number(absensi.manualPotonganIzinHari || 0);
      }
      const potIzin = totalHariPotonganIzin * Number(karyawan.potonganIzinPerHari || 0);
      
      const myKomponen = komponenData.filter(c => 
        c?.userId?.toString()?.trim()?.replace(/^0+/, "") === absensi.userId?.toString()?.trim()?.replace(/^0+/, "") &&
        c.periode?.trim() === displayPeriode?.trim()
      );

      const bonusList = myKomponen.filter(c => c.kategori?.toLowerCase() === "bonus");
      const potonganList = myKomponen.filter(c => c.kategori?.toLowerCase() === "potongan");

      const totalBonus = bonusList.reduce((sum, b) => sum + Number(b.nominal || 0), 0);
      const totalPotonganManual = potonganList.reduce((sum, p) => sum + Number(p.nominal || 0), 0);

      const totalIncome = gajiPokok + upahLembur + totalBonus;
      const totalDeduction = potBPJS + potIzin + totalPotonganManual;
      const takeHomePay = totalIncome - totalDeduction;

      // Hitung Sisa Cuti Tahun Ini
      const currentYear = displayPeriode.split(" ")[1] || new Date().getFullYear().toString();
      const cutiTaken = izinData.filter(i => 
        i.userId?.toString().trim().replace(/^0+/, "") === absensi.userId?.toString().trim().replace(/^0+/, "") &&
        i.jenis?.toLowerCase() === "cuti" &&
        (i.tglMulai || i.tanggal || "").startsWith(currentYear)
      ).reduce((sum, i) => sum + Number(i.totalHari || 1), 0);
      const saldoCutiAktif = (karyawan.saldoCuti || 0) - cutiTaken;

      return {
        id: absensi.id,
        userId: absensi.userId,
        nama: absensi.nama,
        dept: absensi.dept,
        tipe: karyawan.tipe,
        periode: displayPeriode,
        totalJamKerja,
        totalJamLembur,
        totalLemburKasar,
        totalPenguranganLembur,
        tarifJam,
        gajiPokok,
        upahLembur,
        isManualLembur: absensi.isManualLembur,
        potBPJS,
        potIzin,
        totalHariPotonganIzin,
        totalBonus,
        totalPotonganManual,
        bonusList,
        potonganList,
        counts,
        isManualIzin: absensi.isManualIzin,
        saldoCuti: saldoCutiAktif,
        hariHadir: absensi.rekap?.hariHadir || 0,
        takeHomePay
      };
    } catch (err) {
      console.error("Gaji Calculation Error for", absensi.nama, err);
      return null;
    }
  }).filter(Boolean);

  console.log("GAJI DEBUG:", {
    rawAbsensi: absensiData.length,
    gajiList: gajiList.length,
    activeP: filterPeriode
  });

  // Ambil list periode unik
  const periodeList = [...new Set(gajiList.map(g => g.periode))].sort();

  // Filter
  let filtered = gajiList.filter(g => g.tipe === (activeTab === "reguler" ? "tetap" : "freelance"));
  if (filterPeriode && filterPeriode !== "semua") filtered = filtered.filter(g => g.periode === filterPeriode);
  if (search) filtered = filtered.filter(g =>
    g.nama?.toLowerCase().includes(search.toLowerCase()) ||
    g.dept?.toLowerCase().includes(search.toLowerCase())
  );
  filtered.sort((a, b) => Number(a.userId) - Number(b.userId));

  const totalGaji = filtered.reduce((sum, g) => sum + g.takeHomePay, 0);

  return (
    <div className="space-y-6">

      {/* Header */}
<div className="flex items-center justify-between">
  <div>
    <h2 className="text-xl font-bold" style={{ color: "#6F4E37" }}>Kalkulasi Gaji</h2>
    <p className="text-xs mt-1" style={{ color: "#A67B5B" }}>
      Rekap gaji karyawan periode {filterPeriode || "-"}
    </p>
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
          {allPeriods.map(p => (
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
                      Rp {g.takeHomePay.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[10px]" style={{ color: "#A67B5B" }}>
                      Take Home Pay
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
                  
                  {/* Detail Tabs Nav */}
                  <div className="flex border-b mt-4 mb-4" style={{ borderColor: "#FED8B1" }}>
                    {["rincian", "bonus", "potongan"].map(tabKey => (
                      <button
                        key={tabKey}
                        onClick={() => setActiveDetailTab({ ...activeDetailTab, [g.id]: tabKey })}
                        className={`px-4 py-2 text-sm font-medium ${
                          (activeDetailTab[g.id] || "rincian") === tabKey 
                            ? "border-b-2" : "text-gray-500 hover:text-gray-700"
                        }`}
                        style={{ 
                          borderColor: (activeDetailTab[g.id] || "rincian") === tabKey ? "#6F4E37" : "transparent",
                          color: (activeDetailTab[g.id] || "rincian") === tabKey ? "#6F4E37" : ""
                        }}
                      >
                        {tabKey === "rincian" ? "Rincian Gaji" : 
                         tabKey === "bonus" ? "Bonus" : "Potongan Manual"}
                      </button>
                    ))}
                  </div>

                  {/* Tab Rincian */}
                  {(activeDetailTab[g.id] || "rincian") === "rincian" && (
                    <>
                      {/* Summary row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        {g.tipe === "tetap" && (
                          <>
                            <div className="rounded-lg p-3 bg-[#fffaf5]">
                              <p className="text-[10px] uppercase font-bold" style={{ color: "#A67B5B" }}>Ringkasan Izin</p>
                              <div className="grid grid-cols-2 gap-1 mt-1 text-[11px] font-medium" style={{ color: "#6F4E37" }}>
                                <span>Izin: {g.counts.Izin}</span>
                                <span>Sakit: {g.counts.Sakit}</span>
                                <span>Cuti: {g.counts.Cuti}</span>
                                <span>1/2 Hari: {g.counts.Setengah}</span>
                              </div>
                            </div>
                            <div className="rounded-lg p-3 bg-[#fffaf5]">
                              <p className="text-[10px] uppercase font-bold" style={{ color: "#A67B5B" }}>Sisa Cuti</p>
                              <p className="font-bold text-sm mt-1" style={{ color: "#6F4E37" }}>{g.saldoCuti} Hari</p>
                            </div>
                          </>
                        )}
                        <div className="rounded-lg p-3 bg-[#fffaf5]">
                          <p className="text-[10px] uppercase font-bold" style={{ color: "#A67B5B" }}>Kehadiran</p>
                          <p className="font-bold text-sm mt-1" style={{ color: "#6F4E37" }}>{g.hariHadir} Hari Hadir</p>
                        </div>
                        <div className="rounded-lg p-3 bg-[#fffaf5]">
                          <p className="text-[10px] uppercase font-bold" style={{ color: "#A67B5B" }}>Jam Kerja</p>
                          <p className="font-bold text-sm mt-1" style={{ color: "#6F4E37" }}>{g.totalJamKerja.toFixed(1)} Jam</p>
                        </div>
                      </div>

                      {/* Components row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        {/* Income */}
                        <div>
                          <h5 className="text-xs font-bold mb-2 uppercase" style={{ color: "#6F4E37" }}>Pendapatan</h5>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span style={{ color: "#A67B5B" }}>Gaji Pokok</span>
                              <span className="font-medium" style={{ color: "#6F4E37" }}>Rp {g.gajiPokok.toLocaleString("id-ID")}</span>
                            </div>
                            <div className="flex justify-between text-sm items-center">
                              <span style={{ color: "#A67B5B" }}>
                                Upah Lembur {g.isManualLembur && <span className="text-[9px] ml-1 bg-yellow-100 text-yellow-800 px-1 rounded">Manual</span>}
                                {editLemburMode === g.id ? (
                                    <div className="mt-1 flex items-center gap-2">
                                      Rp <input 
                                        type="number" min="0" step="1000"
                                        value={manualLemburValue}
                                        onChange={e => setManualLemburValue(e.target.value)}
                                        className="w-24 px-1 border rounded text-xs"
                                        style={{ borderColor: "#ECB176" }}
                                      />
                                      <button onClick={() => handleSaveLemburManual(g)} className="text-xs text-green-600 font-bold hover:underline">Simpan</button>
                                      <button onClick={() => setEditLemburMode(null)} className="text-xs text-red-600 font-bold hover:underline">Batal</button>
                                    </div>
                                ) : (
                                  <>
                                    <button onClick={() => { setEditLemburMode(g.id); setManualLemburValue(g.upahLembur); }} className="text-xs text-blue-500 hover:underline ml-2">Edit</button>
                                    {g.isManualLembur && (
                                      <button onClick={() => handleResetLemburManual(g)} className="text-xs text-gray-500 underline ml-2">Reset ke Otomatis</button>
                                    )}
                                  </>
                                )}
                              </span>
                              <span className="font-medium" style={{ color: "#6F4E37" }}>Rp {g.upahLembur.toLocaleString("id-ID")}</span>
                            </div>
                            <div className="flex flex-col text-xs border p-2 rounded-lg mt-1" style={{ borderColor: "#ECB176", backgroundColor: "#fffaf5" }}>
                                <div className="flex justify-between mb-1">
                                  <span style={{ color: "#A67B5B" }}>Total Lembur Kasar:</span>
                                  <span className="font-medium" style={{ color: "#6F4E37" }}>
                                    {Math.floor(g.totalLemburKasar || 0)} jam {Math.round(((g.totalLemburKasar || 0) % 1) * 60)} menit
                                  </span>
                                </div>
                                <div className="flex justify-between mb-1">
                                  <span style={{ color: "#A67B5B" }}>Pengurangan Keterlambatan:</span>
                                  <span className="font-medium text-red-600">
                                    {Math.floor(g.totalPenguranganLembur || 0)} jam {Math.round(((g.totalPenguranganLembur || 0) % 1) * 60)} menit
                                  </span>
                                </div>
                                <div className="flex justify-between border-t pt-1 mt-1" style={{ borderColor: "#FED8B1" }}>
                                  <span className="font-bold" style={{ color: "#A67B5B" }}>Lembur Diakui:</span>
                                  <span className="font-bold" style={{ color: "#6F4E37" }}>
                                    {Math.floor(g.totalJamLembur || 0)} jam {Math.round(((g.totalJamLembur || 0) % 1) * 60)} menit
                                  </span>
                                </div>
                            </div>
                            {g.bonusList && g.bonusList.map((b, i) => (
                              <div key={`bonus-${i}`} className="flex justify-between text-sm">
                                <span style={{ color: "#A67B5B" }}>Bonus: {b.nama}</span>
                                <span className="font-medium" style={{ color: "#6F4E37" }}>Rp {Number(b.nominal || 0).toLocaleString("id-ID")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Deductions */}
                        <div>
                          <h5 className="text-xs font-bold mb-2 uppercase" style={{ color: "#6F4E37" }}>Potongan</h5>
                          <div className="space-y-2">
                            {g.tipe === "tetap" && (
                              <div className="flex justify-between text-sm items-center">
                                <span style={{ color: "#A67B5B" }}>Potongan BPJS</span>
                                <span className="font-medium text-red-600">-Rp {g.potBPJS.toLocaleString("id-ID")}</span>
                              </div>
                            )}
                            {g.tipe === "tetap" && (
                              <div className="flex justify-between text-sm items-center">
                                <div className="flex items-center gap-2">
                                  <span style={{ color: "#A67B5B" }}>
                                    Potongan Izin ({editIzinMode === g.id ? (
                                      <input 
                                        type="number" min="0" step="0.5"
                                        value={manualIzinValue}
                                        onChange={e => setManualIzinValue(e.target.value)}
                                        className="w-16 px-1 border rounded text-xs"
                                        style={{ borderColor: "#ECB176" }}
                                      />
                                    ) : g.totalHariPotonganIzin} hari)
                                    {g.isManualIzin && <span className="text-[9px] ml-1 bg-yellow-100 text-yellow-800 px-1 rounded">Manual</span>}
                                  </span>
                                  {editIzinMode === g.id ? (
                                    <>
                                      <button onClick={() => handleSaveIzinManual(g)} className="text-xs text-green-600 font-bold hover:underline">Simpan</button>
                                      <button onClick={() => setEditIzinMode(null)} className="text-xs text-red-600 font-bold hover:underline">Batal</button>
                                    </>
                                  ) : (
                                    <button onClick={() => { setEditIzinMode(g.id); setManualIzinValue(g.totalHariPotonganIzin); }} className="text-xs text-blue-500 hover:underline">Edit</button>
                                  )}
                                  {g.isManualIzin && editIzinMode !== g.id && (
                                    <button onClick={() => handleResetIzinManual(g)} className="text-xs text-gray-500 underline ml-2">Reset ke Otomatis</button>
                                  )}
                                </div>
                                <span className="font-medium text-red-600">-Rp {g.potIzin.toLocaleString("id-ID")}</span>
                              </div>
                            )}
                            {g.potonganList && g.potonganList.map((p, i) => (
                              <div key={`potongan-${i}`} className="flex justify-between text-sm">
                                <span style={{ color: "#A67B5B" }}>Potongan: {p.nama}</span>
                                <span className="font-medium text-red-600">-Rp {Number(p.nominal || 0).toLocaleString("id-ID")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="flex flex-col items-end mt-6 pt-3"
                        style={{ borderTop: "2px solid #FED8B1" }}>
                        <div className="flex justify-between items-center w-full">
                          <p className="text-sm font-bold" style={{ color: "#6F4E37" }}>Take Home Pay</p>
                          <p className="text-xl font-bold" style={{ color: "#6F4E37" }}>
                            Rp {g.takeHomePay.toLocaleString("id-ID")}
                          </p>
                        </div>
                        <p className="text-xs italic mt-1" style={{ color: "#A67B5B" }}>
                          Terbilang: {terbilang(Math.floor(g.takeHomePay))}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Tab Bonus */}
                  {(activeDetailTab[g.id] || "rincian") === "bonus" && (
                    <div className="mt-4">
                      <div className="flex gap-2 mb-4 flex-wrap items-end">
                        <div className="flex-1 min-w-[120px]">
                          <label className="text-[10px] font-bold uppercase" style={{ color: "#A67B5B" }}>Nama Bonus</label>
                          <input type="text" value={bonusForm.nama} onChange={e => setBonusForm({...bonusForm, nama: e.target.value})} className="w-full mt-1 px-2 py-1 border rounded text-sm outline-none" placeholder="Cth: Lembur Ekstra" />
                        </div>
                        <div className="flex-1 min-w-[100px]">
                          <label className="text-[10px] font-bold uppercase" style={{ color: "#A67B5B" }}>Nominal</label>
                          <input type="number" value={bonusForm.nominal} onChange={e => setBonusForm({...bonusForm, nominal: e.target.value})} className="w-full mt-1 px-2 py-1 border rounded text-sm outline-none" placeholder="0" />
                        </div>
                        <div className="flex-none w-32">
                          <label className="text-[10px] font-bold uppercase" style={{ color: "#A67B5B" }}>Tipe</label>
                          <select value={bonusForm.tipe} onChange={e => setBonusForm({...bonusForm, tipe: e.target.value})} className="w-full mt-1 px-2 py-1 border rounded text-sm outline-none bg-white">
                            <option value="one-time">One-time</option>
                            <option value="recurring">Recurring</option>
                          </select>
                        </div>
                        <button onClick={() => handleSaveKomponen(g, "bonus")} className="px-4 py-1.5 rounded text-sm font-medium h-[30px]" style={{ backgroundColor: "#6F4E37", color: "white" }}>
                          Simpan
                        </button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b" style={{ borderColor: "#FED8B1", color: "#A67B5B" }}>
                              <th className="py-2 font-medium">Nama Bonus</th>
                              <th className="py-2 font-medium">Nominal</th>
                              <th className="py-2 font-medium">Tipe</th>
                              <th className="py-2 font-medium">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.bonusList.length === 0 && <tr><td colSpan="5" className="py-4 text-center text-xs text-gray-400">Belum ada bonus</td></tr>}
                            {g.bonusList.map(b => (
                              <tr key={b.id} className="border-b last:border-0" style={{ borderColor: "#fef3e9" }}>
                                <td className="py-2" style={{ color: "#6F4E37" }}>{b.nama}</td>
                                <td className="py-2" style={{ color: "#6F4E37" }}>Rp {Number(b.nominal).toLocaleString("id-ID")}</td>
                                <td className="py-2 text-xs" style={{ color: "#A67B5B" }}>{b.tipe === "recurring" ? "Recurring" : "One-time"}</td>
                                <td className="py-2">
                                  <button onClick={() => handleDeleteKomponen(b.id)} className="text-red-500 text-xs font-medium hover:underline">Hapus</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab Potongan Manual */}
                  {(activeDetailTab[g.id] || "rincian") === "potongan" && (
                    <div className="mt-4">
                      <div className="flex gap-2 mb-4 flex-wrap items-end">
                        <div className="flex-1 min-w-[120px]">
                          <label className="text-[10px] font-bold uppercase" style={{ color: "#A67B5B" }}>Nama Potongan</label>
                          <input type="text" value={potonganForm.nama} onChange={e => setPotonganForm({...potonganForm, nama: e.target.value})} className="w-full mt-1 px-2 py-1 border rounded text-sm outline-none" placeholder="Cth: Cicilan Koperasi" />
                        </div>
                        <div className="flex-1 min-w-[100px]">
                          <label className="text-[10px] font-bold uppercase" style={{ color: "#A67B5B" }}>Nominal</label>
                          <input type="number" value={potonganForm.nominal} onChange={e => setPotonganForm({...potonganForm, nominal: e.target.value})} className="w-full mt-1 px-2 py-1 border rounded text-sm outline-none" placeholder="0" />
                        </div>
                        <button onClick={() => handleSaveKomponen(g, "potongan")} className="px-4 py-1.5 rounded text-sm font-medium h-[30px]" style={{ backgroundColor: "#6F4E37", color: "white" }}>
                          Simpan
                        </button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b" style={{ borderColor: "#FED8B1", color: "#A67B5B" }}>
                              <th className="py-2 font-medium">Nama Potongan</th>
                              <th className="py-2 font-medium">Nominal</th>
                              <th className="py-2 font-medium">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.potonganList.length === 0 && <tr><td colSpan="4" className="py-4 text-center text-xs text-gray-400">Belum ada potongan manual</td></tr>}
                            {g.potonganList.map(p => (
                              <tr key={p.id} className="border-b last:border-0" style={{ borderColor: "#fef3e9" }}>
                                <td className="py-2" style={{ color: "#6F4E37" }}>{p.nama}</td>
                                <td className="py-2 text-red-600">Rp {Number(p.nominal).toLocaleString("id-ID")}</td>
                                <td className="py-2">
                                  <button onClick={() => handleDeleteKomponen(p.id)} className="text-red-500 text-xs font-medium hover:underline">Hapus</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}