import React from 'react';
import { AuthUser } from '../types';
import { Logo } from './Logo';
import { 
  FileText, 
  Mail, 
  ShieldCheck, 
  Plus, 
  LogOut, 
  User as UserIcon,
  HardDrive
} from 'lucide-react';

interface HeaderProps {
  user: AuthUser;
  activeTab: 'dashboard' | 'outbox' | 'audit' | 'drive';
  onSelectTab: (tab: 'dashboard' | 'outbox' | 'audit' | 'drive') => void;
  onOpenCreate: () => void;
  onOpenCategories: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  onSelectTab,
  onOpenCreate,
  onOpenCategories,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#060b1e] border-b border-[#14204c] text-white shadow-lg">
      <div className="bg-[#ff1e27] h-0.5 w-full" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-lg px-2.5 py-1.5 flex items-center shadow-md shadow-red-500/20">
            <Logo size="sm" variant="dark" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-extrabold tracking-tight text-white uppercase flex items-center gap-1.5">
              <span>IGNITE VISION</span>
              <span className="text-[#ff1e27] font-bold">DOCUMENTATION DASHBOARD</span>
            </span>
          </div>
        </div>

        {/* Center: Navigation tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#0c1536] p-1 rounded-lg border border-[#162354]">
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'dashboard'
                ? 'bg-[#ff1e27] text-white shadow-md shadow-red-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>CONTRACTS</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('outbox')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'outbox'
                ? 'bg-[#ff1e27] text-white shadow-md shadow-red-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>EMAIL OUTBOX</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('audit')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'bg-[#ff1e27] text-white shadow-md shadow-red-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AUDIT VAULT</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('drive')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'drive'
                ? 'bg-[#ff1e27] text-white shadow-md shadow-red-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span>GOOGLE DRIVE</span>
          </button>
        </nav>

        {/* Right: Actions & User */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenCategories}
            title="Manage Contract Categories"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white bg-[#0c1536] hover:bg-white/10 rounded-lg transition-colors border border-[#162354] cursor-pointer"
          >
            <span>Categories</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white bg-[#ff1e27] hover:bg-[#e0121b] rounded-lg transition-all whitespace-nowrap shadow-lg shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98] border border-white/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span className="hidden xs:inline">NEW CONTRACT</span>
          </button>

          <div className="h-4 w-px bg-[#162354] hidden sm:block" />

          <div className="hidden sm:flex items-center gap-2 text-xs px-2.5 py-1 rounded bg-[#0c1536] border border-[#162354]">
            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-slate-200 text-[11px] truncate max-w-[130px]" title={user.username}>
              {user.username}
            </span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            title="Log out of documentation dashboard"
            className="p-2 text-slate-400 hover:text-[#ff1e27] hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-[#162354] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
