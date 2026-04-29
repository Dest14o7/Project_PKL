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
import Pengaturan from "./pages/Pengaturan";
import Login from "./pages/Login";

const Layout = ({ children, activePage }) => {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#FFF8F0" }}>
      <Sidebar activePage={activePage} />
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
  return (
    <Router>
      <Routes>
        {/* Login */}
        <Route path="/" element={<Login />} />

        {/* Routes with Layout */}
        <Route path="/dashboard" element={<Layout activePage="dashboard"><Dashboard /></Layout>} />
        <Route path="/karyawan" element={<Layout activePage="karyawan"><Karyawan /></Layout>} />
        <Route path="/absensi" element={<Layout activePage="absensi"><Absensi /></Layout>} />
        <Route path="/anomali" element={<Layout activePage="anomali"><Anomali /></Layout>} />
        <Route path="/izin" element={<Layout activePage="izin"><Izin /></Layout>} />
        <Route path="/gaji" element={<Layout activePage="gaji"><Gaji /></Layout>} />
        <Route path="/pengaturan" element={<Layout activePage="pengaturan"><Pengaturan /></Layout>} />

        {/* Redirect */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}