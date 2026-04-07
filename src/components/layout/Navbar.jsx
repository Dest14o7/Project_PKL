import { Bell, User } from "lucide-react";

export default function Navbar({ activePage }) {
  const pageTitle = {
    dashboard: "Dashboard",
    karyawan: "Manajemen Karyawan",
    absensi: "Rekap Absensi",
    anomali: "Pengecekan Anomali",
    izin: "Manajemen Izin",
    gaji: "Kalkulasi Gaji",
  };

  return (
    <div 
      className="flex items-center justify-between px-8 py-4 shadow-sm"
      style={{ backgroundColor: "#ffffff", borderBottom: "2px solid #ECB176" }}
    >
      {/* Page Title */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: "#6F4E37" }}>
          {pageTitle[activePage] || activePage}
        </h2>
        <p className="text-xs" style={{ color: "#A67B5B" }}>
          S&D Project — RekapIn
        </p>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4">
        {/* Notification */}
        <button 
          className="relative p-2 rounded-full transition-colors"
          style={{ color: "#A67B5B" }}
        >
          <Bell size={20} />
        </button>

        {/* User */}
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: "#ECB176", color: "#6F4E37" }}
          >
            S
          </div>
          <span className="text-sm font-medium" style={{ color: "#6F4E37" }}>
            S&D Finance
          </span>
        </div>
      </div>
    </div>
  );
}