import React, { useState } from 'react';
import { useApp, ScreenId } from '../../context/AppContext';
import { SovereignStrip, SmkmcLogo } from '../common/SovereignStrip';
import { 
  BarChart3, 
  Building2, 
  ListOrdered, 
  GitBranch, 
  Users, 
  Sliders, 
  FileText, 
  ShieldAlert, 
  Bell, 
  LogOut, 
  Menu, 
  X,
  AlertTriangle,
  Clock
} from 'lucide-react';

interface AdminWebShellProps {
  activeScreen: ScreenId;
  children: React.ReactNode;
}

export const AdminWebShell: React.FC<AdminWebShellProps> = ({ activeScreen, children }) => {
  const { 
    currentUser, 
    complaints, 
    officerJoinRequests, 
    supervisorOverdueComplaints,
    navigateTo, 
    logout, 
    unreadNotifCount 
  } = useApp();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // Compute live badges
  const pendingJoinsCount = officerJoinRequests.filter(r => r.status === 'PENDING').length;
  const overdueCount = complaints.filter(c => {
    if (c.status === 'RESOLVED' || c.status === 'CLOSED' || c.status === 'REJECTED') return false;
    return new Date(c.resolutionDeadline).getTime() < Date.now();
  }).length;
  const supervisorOverdueCount = supervisorOverdueComplaints.length;

  const navItems: { id: ScreenId; label: string; icon: any; count?: number; badgeColor?: string }[] = [
    { id: 'A1_CITY_DASHBOARD', label: 'City Dashboard', icon: BarChart3 },
    { id: 'A2_ORGANISATION', label: 'Organisation Units', icon: Building2 },
    { id: 'A3_CATEGORIES_DEADLINES', label: 'Categories & Deadlines', icon: ListOrdered },
    { id: 'A_ROUTING', label: 'Routing Rules', icon: GitBranch },
    { 
      id: 'A4_USERS', 
      label: 'Users & Join Requests', 
      icon: Users, 
      count: pendingJoinsCount > 0 ? pendingJoinsCount : undefined, 
      badgeColor: 'bg-purple-600' 
    },
    { id: 'A6_RULES', label: 'System Rules & SLA', icon: Sliders },
    { id: 'A_REPORTS', label: 'Performance Reports', icon: FileText },
    { id: 'A_AUDIT', label: 'Audit Log', icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FA] text-[#16212E] flex flex-col font-sans">
      <SovereignStrip />

      {/* Top Header Bar */}
      <header className="h-16 bg-[#0B3D66] text-white px-4 md:px-6 flex items-center justify-between shadow-xs sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="md:hidden p-1.5 rounded-lg text-white hover:bg-white/10"
            aria-label="Toggle Navigation Menu"
          >
            {mobileDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <SmkmcLogo size={36} />
          <div>
            <h1 className="text-sm font-bold leading-tight flex items-center gap-2">
              <span>SMKMC Admin Portal</span>
              <span className="text-[10px] bg-[#E0681A] px-2 py-0.5 rounded font-mono uppercase tracking-wider">Corporation HQ</span>
            </h1>
            <p className="text-[11px] text-slate-300">
              Sangli-Miraj-Kupwad Municipal Corporation · Head Office
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {supervisorOverdueCount > 0 && (
            <div 
              onClick={() => navigateTo('A1_CITY_DASHBOARD')}
              className="cursor-pointer hidden lg:flex items-center gap-1.5 bg-red-900/60 border border-red-400/40 px-2.5 py-1 rounded text-xs text-red-100 hover:bg-red-800/80 transition-colors"
              title="Supervisor inactive >72h after L1 escalation"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-300 animate-pulse" />
              <span>{supervisorOverdueCount} Supervisor Overdue</span>
            </div>
          )}

          <button
            onClick={() => navigateTo('M4_NOTIFICATIONS')}
            className="relative p-2 rounded-lg text-white hover:bg-white/10"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#E0681A]" />
            )}
          </button>

          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/20">
            <span className="text-xs font-bold">{currentUser.name}</span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono uppercase">
              Admin
            </span>
          </div>

          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Split Layout: Left Navigation + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-[#D6DFE8] flex flex-col justify-between pt-20 md:pt-4 transition-transform duration-200 ease-in-out md:static md:translate-x-0
          ${mobileDrawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            <div className="px-3 py-2 text-[11px] font-bold text-[#566475] uppercase tracking-wider">
              Administration
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigateTo(item.id);
                    setMobileDrawerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#0B3D66] text-white shadow-xs'
                      : 'text-[#16212E] hover:bg-[#F4F7FA] hover:text-[#0B3D66]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#FFDB99]' : 'text-[#566475]'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.count !== undefined && item.count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${item.badgeColor || 'bg-[#0B3D66]'}`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom stats summary */}
          <div className="p-3 border-t border-[#D6DFE8] bg-[#F4F7FA]">
            <div className="p-2.5 bg-white rounded-lg border border-[#D6DFE8] text-[11px] space-y-1">
              <div className="flex justify-between text-[#566475]">
                <span>Total Complaints:</span>
                <span className="font-bold text-[#16212E]">{complaints.length}</span>
              </div>
              <div className="flex justify-between text-[#566475]">
                <span>Overdue Deadlines:</span>
                <span className="font-bold text-red-600">{overdueCount}</span>
              </div>
              <div className="flex justify-between text-[#566475]">
                <span>Helpline:</span>
                <span className="font-mono text-[#0B3D66]">0233-2373455</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#F4F7FA] p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {mobileDrawerOpen && (
        <div 
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
        />
      )}
    </div>
  );
};
