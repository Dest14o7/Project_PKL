import { useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import Navbar from "./components/layout/Navbar";
import Dashboard from "./pages/Dashboard";
import Karyawan from "./pages/Karyawan";
import Absensi from "./pages/Absensi";
import Anomali from "./pages/Anomali";
import Izin from "./pages/Izin";
import Gaji from "./pages/Gaji";

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");

  const renderPage = () => {
    switch (activePage) {
      case "dashboard": return <Dashboard />;
      case "karyawan": return <Karyawan />;
      case "absensi" : return <Absensi />;
      case "anomali" : return <Anomali />;
      case "izin" : return <Izin />;
      case "gaji" : return <Gaji />;
      
      default: return (
        <div className="text-center mt-20">
          <p className="text-lg font-semibold" style={{ color: "#6F4E37" }}>
            Halaman {activePage} akan segera hadir!
          </p>
        </div>
      );
    }
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#FFF8F0" }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      
      <div className="flex-1 flex flex-col">
        <Navbar activePage={activePage} />
        <main className="flex-1 p-8">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}