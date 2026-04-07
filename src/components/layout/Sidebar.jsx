import { useState } from "react";
import { 
  LayoutDashboard, Users, ClipboardList, 
  AlertTriangle, FileText, DollarSign, ChevronLeft, ChevronRight 
} from "lucide-react";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Users, label: "Karyawan", id: "karyawan" },
  { icon: ClipboardList, label: "Absensi", id: "absensi" },
  { icon: AlertTriangle, label: "Anomali", id: "anomali" },
  { icon: FileText, label: "Izin", id: "izin" },
  { icon: DollarSign, label: "Gaji", id: "gaji" },
];

export default function Sidebar({ activePage, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`${collapsed ? "w-16" : "w-64"} min-h-screen flex flex-col transition-all duration-300`} 
      style={{ backgroundColor: "#6F4E37" }}>
      
      {/* Logo */}
      <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid #A67B5B" }}>
        {!collapsed && (
          <span className="text-xl font-bold" style={{ color: "#FED8B1" }}>RekapIn</span>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)} 
          className="p-1 rounded transition-colors"
          style={{ color: "#FED8B1" }}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-2 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
              style={{
                backgroundColor: isActive ? "#ECB176" : "transparent",
                color: isActive ? "#6F4E37" : "#FFF8F0",
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "#A67B5B";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <Icon size={20} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 text-xs" style={{ borderTop: "1px solid #A67B5B", color: "#ECB176" }}>
          S&D Project © 2026
        </div>
      )}
    </div>
  );
}