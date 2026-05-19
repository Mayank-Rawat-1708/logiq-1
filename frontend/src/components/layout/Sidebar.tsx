import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Upload, LogOut, Zap } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';

export const Sidebar: React.FC = () => {
  const { user, refreshToken, logout, addToast } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // ignore
    }
    logout();
    navigate('/auth');
    addToast('info', 'Logged out successfully');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-[#6366F1]/20 text-[#6366F1] border border-[#6366F1]/30'
        : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1A1A24]'
    }`;

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-[#111118] border-r border-[#2A2A3A] px-3 py-4">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 mb-8">
        <div className="w-7 h-7 bg-[#6366F1] rounded-md flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-mono font-bold text-lg text-[#F1F5F9] tracking-tight">LogIQ</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        <NavLink to="/dashboard" className={linkClass}>
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </NavLink>
        <NavLink to="/upload" className={linkClass}>
          <Upload className="w-4 h-4" />
          New Session
        </NavLink>
      </nav>

      {/* User */}
      <div className="border-t border-[#2A2A3A] pt-3 mt-3">
        <div className="px-3 mb-2">
          <p className="text-xs font-medium text-[#F1F5F9] truncate">{user?.full_name}</p>
          <p className="text-xs text-[#475569] truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-[#94A3B8] hover:text-red-400 hover:bg-red-950/20 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
};
