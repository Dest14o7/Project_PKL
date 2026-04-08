import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut } from "lucide-react";
import { auth } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function Navbar({ activePage }) {
  const [userEmail, setUserEmail] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email);
      } else {
        setUserEmail("");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("token");
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const nameBeforeAt = userEmail ? userEmail.split("@")[0] : "User";
  const firstChar = nameBeforeAt.charAt(0).toUpperCase();

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
      <div className="flex items-center gap-4">
        {/* Notification */}
        <button 
          className="relative p-2 rounded-full transition-colors"
          style={{ color: "#A67B5B" }}
        >
          <Bell size={20} />
        </button>

        {/* User */}
        <div className="relative">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: "#ECB176", color: "#6F4E37" }}
            >
              {firstChar}
            </div>
            <span className="text-sm font-medium" style={{ color: "#6F4E37" }}>
              {nameBeforeAt}
            </span>
          </div>

          {/* Dropdown */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 border overflow-hidden" style={{ borderColor: "#ECB176" }}>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left transition-colors"
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}