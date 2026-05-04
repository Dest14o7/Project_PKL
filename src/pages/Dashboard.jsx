import { useState, useEffect } from "react";
import { Users, ClipboardList, AlertTriangle, Clock } from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
// PieChart and other recharts imports removed as per PRD
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  // Hooks harus di dalam sini
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalKaryawan: 0,
    totalFreelance: 0,
    totalAnomali: 0,
    totalIzin: 0,
    keterlambatanList: [],
    izinList: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedPeriode, setSelectedPeriode] = useState("");
  const [allPeriods, setAllPeriods] = useState([]);
  const [monthPrefix, setMonthPrefix] = useState("");

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
      
      const targetP = selectedPeriode || activeP;
      if (!selectedPeriode && activeP) setSelectedPeriode(activeP);

      if (!targetP) {
        setLoading(false);
        return;
      }

      const [bulan, tahun] = targetP.split(" ");
      const bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const bulanIndex = bulanIndo.indexOf(bulan) + 1;
      const prefix = (bulanIndex > 0 && tahun) ? `${tahun}-${bulanIndex.toString().padStart(2, "0")}` : "";
      setMonthPrefix(prefix);

      // 2. Fetch Karyawan
      const karyawanSnap = await getDocs(collection(db, "karyawan"));
      const karyawanData = karyawanSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const totalKaryawan = karyawanData.filter(d => d.status === "aktif" && d.tipe === "tetap").length;
      const totalFreelance = karyawanData.filter(d => d.status === "aktif" && d.tipe === "freelance").length;

      // 3. Fetch Anomali
      const anomaliSnap = await getDocs(collection(db, "anomali"));
      const anomaliData = anomaliSnap.docs.map(d => d.data());
      const filteredAnomali = anomaliData.filter(a => a.periode === targetP);
      const totalAnomali = filteredAnomali.filter(a => 
        a.status === "belum" && 
        (a.jenis === "Tidak Hadir" || a.jenis === "Scan Tidak Lengkap")
      ).length;

      // Ringkasan Keterlambatan
      const keterlambatanMap = {};
      filteredAnomali.filter(a => a.jenis === "Terlambat").forEach(a => {
        const key = `${a.userId || "N/A"}_${a.nama || "Tanpa Nama"}`;
        keterlambatanMap[key] = (keterlambatanMap[key] || 0) + 1;
      });
      const keterlambatanList = Object.entries(keterlambatanMap).map(([key, count]) => {
        const [userId, nama] = key.split("_");
        return { userId, nama, count };
      }).sort((a, b) => b.count - a.count);

      // 4. Fetch Izin
      const izinSnap = await getDocs(collection(db, "izin"));
      const izinData = izinSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filteredIzin = izinData.filter(i => prefix && i.tanggal?.startsWith(prefix));
      const totalIzin = filteredIzin.length;

      const formatIzinDate = (izin) => {
        const formatDateStr = (dateStr) => {
          if (!dateStr) return "";
          if (dateStr.includes("-") && dateStr.split("-")[0].length === 2) return dateStr;
          if (dateStr.includes("-") && dateStr.split("-")[0].length === 4) {
            const [y, m, d] = dateStr.split("-");
            return `${d}-${m}-${y}`;
          }
          return dateStr;
        };
        const t1 = formatDateStr(izin.tglMulai || izin.tanggal);
        const t2 = formatDateStr(izin.tglSelesai);
        
        if (izin.totalHari > 1 && t2 && t1 !== t2) {
          return `${t1} – ${t2}`;
        }
        return t1;
      };

      setStats({
        totalKaryawan,
        totalFreelance,
        totalAnomali,
        totalIzin,
        keterlambatanList,
        izinList: filteredIzin.map(i => ({...i, displayDate: formatIzinDate(i)})).sort((a, b) => {
          const dateA = new Date(a.tanggal || 0);
          const dateB = new Date(b.tanggal || 0);
          return dateB - dateA;
        }),
      });
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, [selectedPeriode]);

  const statCards = [
    { label: "Total Karyawan Aktif", value: stats.totalKaryawan, icon: Users, bg: "#6F4E37", color: "#FED8B1" },
    { label: "Total Freelance Aktif", value: stats.totalFreelance, icon: Users, bg: "#B17457", color: "#FED8B1" },
    { label: "Anomali Belum Dikonfirmasi", value: stats.totalAnomali, icon: AlertTriangle, bg: "#ECB176", color: "#6F4E37" },
    { label: "Total Izin Periode Berjalan", value: stats.totalIzin, icon: ClipboardList, bg: "#FED8B1", color: "#6F4E37" },
  ];

  return (
    <div className="space-y-6">

      {/* Welcome & Period */}
      <div className="flex items-center justify-between bg-[#6F4E37] rounded-xl p-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "#FED8B1" }}>
            Selamat Datang di RekapIn! 
          </h2>
          <p className="mt-1 text-sm" style={{ color: "#ECB176" }}>
            Sistem Rekap Absensi & Penggajian S&D Project
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <div>
            <p className="text-xs uppercase font-bold" style={{ color: "#ECB176" }}>Periode Aktif</p>
            <select 
              value={selectedPeriode}
              onChange={(e) => setSelectedPeriode(e.target.value)}
              className="mt-1 bg-white/10 text-[#FED8B1] border border-[#ECB176]/30 rounded px-2 py-1 text-sm outline-none"
            >
              <option value="" disabled className="text-black">Pilih Periode</option>
              {allPeriods.map(p => (
                <option key={p} value={p} className="text-black">{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Period Filter Removed as per Section 6.2 (Centralized Period) */}

      {/* Stats Cards */}
      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto"
            style={{ borderColor: "#ECB176", borderTopColor: "#6F4E37" }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="rounded-xl p-5 flex items-center gap-4 shadow-sm"
                style={{ backgroundColor: stat.bg }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                  <Icon size={24} color={stat.color} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: stat.color, opacity: 0.8 }}>
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold mt-0.5" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ringkasan Keterlambatan & Izin */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Ringkasan Keterlambatan */}
          <div className="lg:col-span-1 bg-white rounded-xl p-6 shadow-sm border border-[#ECB176]">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: "#6F4E37" }}>
              <Clock size={16} /> Ringkasan Keterlambatan
            </h3>
            {stats.keterlambatanList.length === 0 ? (
              <p className="text-center text-xs py-10" style={{ color: "#A67B5B" }}>Tidak ada catatan terlambat</p>
            ) : (
              <div className="space-y-3">
                {stats.keterlambatanList.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[#FFF8F0]">
                    <div>
                      <p className="text-xs font-bold" style={{ color: "#6F4E37" }}>{item.nama}</p>
                      <p className="text-[10px]" style={{ color: "#A67B5B" }}>ID: {item.userId}</p>
                    </div>
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-[#FED8B1] text-[#6F4E37]">
                      {item.count} hari terlambat
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ringkasan Izin (Table) */}
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-[#ECB176]">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: "#6F4E37" }}>
              <ClipboardList size={16} /> Ringkasan Izin
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b" style={{ color: "#A67B5B" }}>
                    <th className="pb-2 font-medium">No</th>
                    <th className="pb-2 font-medium">Karyawan</th>
                    <th className="pb-2 font-medium">Tanggal</th>
                    <th className="pb-2 font-medium">Rincian</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.izinList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10" style={{ color: "#A67B5B" }}>Belum ada data izin</td>
                    </tr>
                  ) : (
                    stats.izinList.map((i, idx) => (
                      <tr key={i.id} className="border-b last:border-0">
                        <td className="py-3" style={{ color: "#A67B5B" }}>{idx + 1}</td>
                        <td className="py-3">
                          <p className="font-bold" style={{ color: "#6F4E37" }}>{i.nama}</p>
                          <p className="text-[10px]" style={{ color: "#A67B5B" }}>ID: {i.userId}</p>
                        </td>
                        <td className="py-3" style={{ color: "#6F4E37" }}>{i.displayDate || i.tanggal}</td>
                        <td className="py-3">
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold"
                            style={{ 
                              backgroundColor: i.jenis === "Sakit" ? "#F8D7DA" : i.jenis === "Cuti" ? "#D4EDDA" : "#E8F4FD",
                              color: i.jenis === "Sakit" ? "#842029" : i.jenis === "Cuti" ? "#155724" : "#1A5276"
                            }}>
                            {i.jenis}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Info kalau belum ada data */}
      {!loading && stats.totalKaryawan === 0 && (
        <div className="rounded-xl p-6 text-center"
          style={{ backgroundColor: "white", border: "2px dashed #ECB176" }}>
          <ClipboardList size={40} className="mx-auto mb-3" style={{ color: "#ECB176" }} />
          <p className="font-semibold" style={{ color: "#6F4E37" }}>Belum ada data absensi</p>
          <p className="text-sm mt-1" style={{ color: "#A67B5B" }}>
            Upload file Excel absensi di menu Absensi untuk memulai
          </p>
        </div>
      )}

    </div>
  );
}