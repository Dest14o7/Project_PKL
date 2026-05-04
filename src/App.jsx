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
import SlipGaji from "./pages/SlipGaji";
import Pengaturan from "./pages/Pengaturan";
import Login from "./pages/Login";

const ProtectedRoute = ({ children, activePage }) => {
  const token = sessionStorage.getItem("token");
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return <Layout activePage={activePage}>{children}</Layout>;
};

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

        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute activePage="dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/karyawan" element={<ProtectedRoute activePage="karyawan"><Karyawan /></ProtectedRoute>} />
        <Route path="/absensi" element={<ProtectedRoute activePage="absensi"><Absensi /></ProtectedRoute>} />
        <Route path="/anomali" element={<ProtectedRoute activePage="anomali"><Anomali /></ProtectedRoute>} />
        <Route path="/izin" element={<ProtectedRoute activePage="izin"><Izin /></ProtectedRoute>} />
        <Route path="/gaji" element={<ProtectedRoute activePage="gaji"><Gaji /></ProtectedRoute>} />
        <Route path="/slipgaji" element={<ProtectedRoute activePage="slipgaji"><SlipGaji /></ProtectedRoute>} />
        <Route path="/pengaturan" element={<ProtectedRoute activePage="pengaturan"><Pengaturan /></ProtectedRoute>} />

        {/* Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}