import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"; // <-- Tambah ini
import Sidebar from "./components/layout/Sidebar";
import Navbar from "./components/layout/Navbar";
import Dashboard from "./pages/Dashboard";
import Karyawan from "./pages/Karyawan";
import Absensi from "./pages/Absensi";
import Anomali from "./pages/Anomali";
import Izin from "./pages/Izin";
import Gaji from "./pages/Gaji";
import Login from "./pages/Login";

const Layout = ({ children, activePage, setActivePage }) => {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#FFF8F0" }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="flex-1 flex flex-col">
        <Navbar activePage={activePage} />
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");

  return (
    <Router>
      <Routes>
        {/* Login */}
        <Route path="/" element={<Login />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={
          <Layout activePage="dashboard" setActivePage={setActivePage}>
            <Dashboard />
          </Layout>
        } />

        <Route path="/karyawan" element={
          <Layout activePage="karyawan" setActivePage={setActivePage}>
            <Karyawan />
          </Layout>
        } />

        {/* Tambahkan route lainnya (Absensi, Izin, dll) dengan pola yang sama */}
        <Route path="/absensi" element={<Layout activePage="absensi"><Absensi /></Layout>} />
        <Route path="/anomali" element={<Layout activePage="anomali"><Anomali /></Layout>} />
        <Route path="/izin" element={<Layout activePage="izin"><Izin /></Layout>} />
        <Route path="/gaji" element={<Layout activePage="gaji"><Gaji /></Layout>} />

        {/* Jika nyasar, balikkan ke login atau dashboard */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}