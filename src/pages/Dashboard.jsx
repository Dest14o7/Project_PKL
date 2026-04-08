import { useState, useEffect } from "react";
import { Users, ClipboardList, AlertTriangle, Clock } from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  // Hooks harus di dalam sini
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/'); // Tendang ke login kalau gak ada token
    }
  }, [navigate]);

  const [stats, setStats] = useState({
    totalKaryawan: 0,
    hariHadir: 0,
    totalAnomali: 0,
    totalLembur: 0,
    ringkasanAnomali: {},
    ringkasanIzin: {},
  });
  const [loading, setLoading] = useState(true);
  const [periodeList, setPeriodeList] = useState([]);
  const [selectedPeriode, setSelectedPeriode] = useState("semua");

  const fetchStats = async () => {
    setLoading(true);

    const karyawanSnap = await getDocs(collection(db, "karyawan"));
    const totalKaryawan = karyawanSnap.docs.filter(d => d.data().status === "aktif").length;

    const absensiSnap = await getDocs(collection(db, "absensi"));
    const absensiData = absensiSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const periodes = [...new Set(absensiData.map(a => a.periode))].sort();
    setPeriodeList(periodes);

    const filtered = selectedPeriode === "semua"
      ? absensiData
      : absensiData.filter(a => a.periode === selectedPeriode);

    const hariHadir = filtered.reduce((sum, a) => sum + (a.rekap?.hariHadir || 0), 0);
    const totalLembur = filtered.reduce((sum, a) => sum + (a.rekap?.totalJamLembur || 0), 0);

    const anomaliSnap = await getDocs(collection(db, "anomali"));
    const anomaliData = anomaliSnap.docs.map(d => d.data());
    const filteredAnomali = selectedPeriode === "semua"
      ? anomaliData
      : anomaliData.filter(a => a.periode === selectedPeriode);
    const totalAnomali = filteredAnomali.filter(a => a.status === "belum").length;

    const izinSnap = await getDocs(collection(db, "izin"));
    const izinData = izinSnap.docs.map(d => d.data());
    const filteredIzin = selectedPeriode === "semua"
      ? izinData
      : izinData.filter(i => {
          const [, bulan, tahun] = selectedPeriode.split("~")[0].split("-");
          return i.tanggal?.startsWith(`${tahun}-${bulan}`);
        });

    const ringkasanIzin = {
      Izin: filteredIzin.filter(i => i.jenis === "Izin").length,
      Sakit: filteredIzin.filter(i => i.jenis === "Sakit").length,
      "Izin Terlambat": filteredIzin.filter(i => i.jenis === "Izin Terlambat").length,
      "Izin 2 Jam": filteredIzin.filter(i => i.jenis === "Izin 2 Jam").length,
      Cuti: filteredIzin.filter(i => i.jenis === "Cuti").length,
    };

    const ringkasanAnomali = {
      Terlambat: filteredAnomali.filter(a => a.jenis === "Terlambat").length,
      "Tidak Hadir": filteredAnomali.filter(a => a.jenis === "Tidak Hadir").length,
      "Pulang Cepat": filteredAnomali.filter(a => a.jenis === "Pulang Cepat").length,
      "Scan Tidak Lengkap": filteredAnomali.filter(a => a.jenis === "Scan Tidak Lengkap").length,
    };

    setStats({
      totalKaryawan,
      hariHadir,
      totalAnomali,
      totalLembur: Math.round(totalLembur * 10) / 10,
      ringkasanAnomali,
      ringkasanIzin,
    });
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, [selectedPeriode]);

  const statCards = [
    { label: "Total Karyawan Aktif", value: stats.totalKaryawan, icon: Users, bg: "#6F4E37", color: "#FED8B1" },
    { label: "Total Hari Hadir", value: `${stats.hariHadir} Hari`, icon: ClipboardList, bg: "#B17457", color: "#FED8B1" },
    { label: "Anomali Belum Dikonfirmasi", value: stats.totalAnomali, icon: AlertTriangle, bg: "#ECB176", color: "#6F4E37" },
    { label: "Total Lembur", value: `${stats.totalLembur} Jam`, icon: Clock, bg: "#FED8B1", color: "#6F4E37" },
  ];

  return (
    <div className="space-y-6">

      {/* Welcome */}
      <div className="rounded-xl p-6" style={{ backgroundColor: "#6F4E37" }}>
        <h2 className="text-2xl font-bold" style={{ color: "#FED8B1" }}>
          Selamat Datang di RekapIn! 
        </h2>
        <p className="mt-1 text-sm" style={{ color: "#ECB176" }}>
          Sistem Rekap Absensi & Penggajian S&D Project
        </p>
      </div>

      {/* Filter Periode */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium" style={{ color: "#6F4E37" }}>Periode:</span>
        <select
          value={selectedPeriode}
          onChange={e => setSelectedPeriode(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: "1px solid #ECB176", color: "#6F4E37", backgroundColor: "white" }}
        >
          <option value="semua">Semua Periode</option>
          {periodeList.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

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

      {/* Ringkasan Anomali & Izin */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Ringkasan Anomali */}
<div className="bg-white rounded-xl p-5 shadow-sm">
  <h3 className="font-bold text-sm mb-4" style={{ color: "#6F4E37" }}>
    Ringkasan Anomali
  </h3>
  {Object.values(stats.ringkasanAnomali).every(v => v === 0) ? (
    <p className="text-center text-sm py-8" style={{ color: "#A67B5B" }}>
      Tidak ada anomali
    </p>
  ) : (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={[
            { name: "Terlambat", value: stats.ringkasanAnomali["Terlambat"] || 0, color: "#856404" },
            { name: "Tidak Hadir", value: stats.ringkasanAnomali["Tidak Hadir"] || 0, color: "#842029" },
            { name: "Pulang Cepat", value: stats.ringkasanAnomali["Pulang Cepat"] || 0, color: "#0C5460" },
            { name: "Scan Tidak Lengkap", value: stats.ringkasanAnomali["Scan Tidak Lengkap"] || 0, color: "#6B21A8" },
          ].filter(d => d.value > 0)}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
          label={({ value }) => `${value}`}
          labelLine={false}
        >
          {[
            { name: "Terlambat", value: stats.ringkasanAnomali["Terlambat"] || 0, color: "#856404" },
            { name: "Tidak Hadir", value: stats.ringkasanAnomali["Tidak Hadir"] || 0, color: "#842029" },
            { name: "Pulang Cepat", value: stats.ringkasanAnomali["Pulang Cepat"] || 0, color: "#0C5460" },
            { name: "Scan Tidak Lengkap", value: stats.ringkasanAnomali["Scan Tidak Lengkap"] || 0, color: "#6B21A8" },
          ].filter(d => d.value > 0).map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${value} kasus`, name]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #ECB176", fontSize: "12px" }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ fontSize: "11px", color: "#6F4E37" }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )}
</div>

          {/* Ringkasan Izin */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-sm mb-4" style={{ color: "#6F4E37" }}>
              Ringkasan Izin
            </h3>
            <div className="space-y-2">
              {[
                { label: "Izin", bg: "#E8F4FD", color: "#1A5276" },
                { label: "Sakit", bg: "#F8D7DA", color: "#842029" },
                { label: "Izin Terlambat", bg: "#FFF3CD", color: "#856404" },
                { label: "Izin 2 Jam", bg: "#FED8B1", color: "#6F4E37" },
                { label: "Cuti", bg: "#D4EDDA", color: "#155724" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ backgroundColor: item.bg }}>
                  <span className="text-xs font-medium" style={{ color: item.color }}>{item.label}</span>
                  <span className="text-sm font-bold" style={{ color: item.color }}>
                    {stats.ringkasanIzin[item.label] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Info kalau belum ada data */}
      {!loading && stats.hariHadir === 0 && (
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