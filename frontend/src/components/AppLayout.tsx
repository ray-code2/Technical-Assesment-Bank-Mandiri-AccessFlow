import {
  CheckSquare2,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Settings2,
  ShieldCheck,
  X,
  ClipboardList,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { initials } from "../lib/format";

const baseNavigation = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/request-access", label: "Request access", icon: PlusCircle },
  { to: "/my-requests", label: "My requests", icon: ClipboardList },
  { to: "/approvals", label: "Approve requests", icon: CheckSquare2 },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = user?.role === "ADMIN"
    ? [...baseNavigation, { to: "/access-catalog", label: "Access catalog", icon: Settings2 }]
    : baseNavigation;

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <div className="brand brand--mobile">
          <span className="brand__mark"><ShieldCheck size={21} /></span>
          <span>AccessFlow</span>
        </div>
        <button className="icon-button" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle menu">
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {menuOpen && <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
      <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
        <div className="brand">
          <span className="brand__mark"><ShieldCheck size={23} /></span>
          <span>AccessFlow</span>
        </div>
        <nav className="nav" aria-label="Primary navigation">
          <span className="nav__label">Workspace</span>
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `nav__link ${isActive ? "nav__link--active" : ""}`}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <div className="user-card">
            <span className="avatar">{initials(user?.fullName ?? "User")}</span>
            <div>
              <strong>{user?.fullName}</strong>
              <span>{user?.role === "ADMIN" ? "Administrator" : user?.role === "MANAGER" ? "Manager" : user?.managerName ? `Reports to ${user.managerName}` : "Team member"}</span>
            </div>
          </div>
          <button className="nav__link nav__link--button" onClick={logout}>
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
