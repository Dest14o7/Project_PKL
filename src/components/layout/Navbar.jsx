import { useState } from "react";
import { User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Navbar({ activePage }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

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
      className="flex items-center justify-between px-8 py-4 shadow-sm relative z-50"
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
      <div className="flex items-center gap-4 relative">
        {/* User */}
        <button 
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 hover:bg-[#FFF8F0] p-1.5 rounded-lg transition-colors outline-none"
        >
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: "#ECB176", color: "#6F4E37" }}
          >
            S
          </div>
          <span className="text-sm font-medium" style={{ color: "#6F4E37" }}>
            S&D Finance
          </span>
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border py-2 z-50" style={{ borderColor: "#ECB176" }}>
            <div className="px-4 py-2 border-b mb-1" style={{ borderColor: "#FED8B1" }}>
              <p className="text-xs font-bold" style={{ color: "#6F4E37" }}>S&D Finance</p>
            </div>
            <button 
              onClick={() => {
                sessionStorage.removeItem("token");
                navigate("/");
              }}
              className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}