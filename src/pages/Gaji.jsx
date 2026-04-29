import { useState, useEffect } from "react";
import { DollarSign, ChevronDown, ChevronUp, Search } from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc, getDoc } from "firebase/firestore";
import { exportRekapAbsen } from "../utils/exportExcel";
import { exportRekapGaji } from "../utils/exportPDF";

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

      setAbsensiData(absensi);
      setKaryawanData(karyawan);
      setIzinData(izin);
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

  // Gabungkan absensi dengan data karyawan
  const gajiList = absensiData.map(absensi => {
    try {
      const karyawan = karyawanData.find(k =>
        k.userId?.toString()?.trim()?.replace(/^0+/, "") === absensi.userId?.toString()?.trim()?.replace(/^0+/, "")
      );
      if (!karyawan) return null;

      // Normalize Periode
      let displayPeriode = absensi.periode || "";
      if (displayPeriode.includes("~")) {
        const [start] = displayPeriode.split("~");
        const parts = start.trim().split(/[-/]/);
        let y, m;
        if (parts[0].length === 4) { [y, m] = parts; }
        else if (parts[2]?.length === 4) { [m, , y] = [parts[1], parts[0], parts[2]]; }
        
        if (y && m) {
          const bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
          displayPeriode = `${bulanIndo[parseInt(m) - 1] || "Bulan"} ${y}`;
        }
      }

      const [bulan, tahun] = displayPeriode.split(" ");
      const bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const bulanIndex = bulanIndo.indexOf(bulan) + 1;
      const monthPrefix = (bulanIndex > 0 && tahun) ? `${tahun}-${bulanIndex.toString().padStart(2, "0")}` : "";

      const listIzinKaryawan = izinData.filter(i => 
        i.userId?.toString()?.replace(/^0+/, "") === absensi.userId?.toString()?.replace(/^0+/, "") &&
        i.tanggal?.startsWith(monthPrefix)
      );

      const counts = {
        Izin: listIzinKaryawan.filter(i => i.jenis === "Izin").length,
        Sakit: listIzinKaryawan.filter(i => i.jenis === "Sakit").length,
        Cuti: listIzinKaryawan.filter(i => i.jenis === "Cuti").length,
        Setengah: listIzinKaryawan.filter(i => i.jenis?.includes("Setengah")).length,
      };

      const tarifJam = Number(karyawan?.tarifJam || 0);
      const totalJamKerja = absensi.rekap?.totalJamKerja || 0;
      const totalJamLembur = absensi.rekap?.totalJamLembur || 0;
      
      const gajiPokok = Number(karyawan?.gajiPokok || 0);
      const upahLembur = totalJamLembur * tarifJam;
      
      const potBPJS = karyawan.tipe === "tetap" ? Number(karyawan.potonganBPJSTetap || 0) : 0;
      const potIzin = counts.Izin * Number(karyawan.potonganIzinPerHari || 0);
      
      const totalIncome = gajiPokok + upahLembur;
      const totalDeduction = potBPJS + potIzin;
      const takeHomePay = totalIncome - totalDeduction;

      return {
        id: absensi.id,
        userId: absensi.userId,
        nama: absensi.nama,
        dept: absensi.dept,
        tipe: karyawan.tipe,
        periode: displayPeriode,
        totalJamKerja,
        totalJamLembur,
        tarifJam,
        gajiPokok,
        upahLembur,
        potBPJS,
        potIzin,
        counts,
        saldoCuti: karyawan.saldoCuti || 0,
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
                  
                  {/* Summary row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="rounded-lg p-3 bg-[#fffaf5]">
                      <p className="text-[10px] uppercase font-bold" style={{ color: "#A67B5B" }}>Ringkasan Izin</p>
                      <div className="grid grid-cols-2 gap-1 mt-1 text-[11px] font-medium" style={{ color: "#6F4E37" }}>
                        <span>Izin: {g.counts.Izin}</span>
                        <span>Sakit: {g.counts.Sakit}</span>
                        <span>Cuti: {g.counts.Cuti}</span>
                        <span>1/2 Hari: {g.counts.Setengah}</span>
                      </div>
                    </div>
                    {g.tipe === "tetap" && (
                      <div className="rounded-lg p-3 bg-[#fffaf5]">
                        <p className="text-[10px] uppercase font-bold" style={{ color: "#A67B5B" }}>Sisa Cuti</p>
                        <p className="font-bold text-sm mt-1" style={{ color: "#6F4E37" }}>{g.saldoCuti} Hari</p>
                      </div>
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
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "#A67B5B" }}>Upah Lembur ({g.totalJamLembur.toFixed(1)} jam)</span>
                          <span className="font-medium" style={{ color: "#6F4E37" }}>Rp {g.upahLembur.toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                    </div>
                    {/* Deductions */}
                    <div>
                      <h5 className="text-xs font-bold mb-2 uppercase" style={{ color: "#6F4E37" }}>Potongan</h5>
                      <div className="space-y-2">
                        {g.tipe === "tetap" && (
                          <div className="flex justify-between text-sm">
                            <span style={{ color: "#A67B5B" }}>Potongan BPJS</span>
                            <span className="font-medium text-red-600">-Rp {g.potBPJS.toLocaleString("id-ID")}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "#A67B5B" }}>Potongan Izin ({g.counts.Izin} hari)</span>
                          <span className="font-medium text-red-600">-Rp {g.potIzin.toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center mt-6 pt-3"
                    style={{ borderTop: "2px solid #FED8B1" }}>
                    <p className="text-sm font-bold" style={{ color: "#6F4E37" }}>Take Home Pay</p>
                    <p className="text-xl font-bold" style={{ color: "#6F4E37" }}>
                      Rp {g.takeHomePay.toLocaleString("id-ID")}
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