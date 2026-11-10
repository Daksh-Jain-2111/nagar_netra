import React, { useState } from 'react';
import { useApp, ScreenId } from '../../context/AppContext';
import { SovereignStrip, SmkmcLogo } from '../common/SovereignStrip';
import { 
  LayoutDashboard, 
  HelpCircle, 
  AlertTriangle, 
  CheckSquare, 
  Users, 
  TrendingUp, 
  Bell, 
  LogOut, 
  Menu, 
  X,
  Building2 
} from 'lucide-react';

interface SupervisorWebShellProps {
  activeScreen: ScreenId;
  children: React.ReactNode;
}

export const SupervisorWebShell: React.FC<SupervisorWebShellProps> = ({ activeScreen, children }) => {
  const { 
    currentUser, 
    complaints, 
    officerJoinRequests, 
    users, 
    navigateTo, 
    logout, 
    unreadNotifCount 
  } = useApp();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // Compute live badge counts for left nav:
  // To check: TO_CHECK
  const toCheckCount = complaints.filter(c => c.status === 'TO_CHECK').length;
  // Escalations: L1
  const escalationsCount = complaints.filter(c => c.escalationLevel === 'L1').length;
  // Pending Approvals (Extensions + Rejections + Second transfers + Officer joins)
  const pendingExt = complaints.filter(c => c.extensionRequest?.status === 'PENDING').length;
  const pendingRej = complaints.filter(c => c.rejectionRequest?.status === 'PENDING').length;
  const pendingTrans = complaints.filter(c => c.transferRequest?.status === 'PENDING_SUPERVISOR').length;
  const pendingJoins = officerJoinRequests.filter(r => r.status === 'PENDING').length;
  const approvalsCount = pendingExt + pendingRej + pendingTrans + pendingJoins;
  // Officers on leave
  const officersOnLeaveCount = users.filter(u => u.role === 'officer' && u.isOnLeave).length;

  const navItems: { id: ScreenId; label: string; icon: any; count?: number; badgeColor?: string }[] = [
    { id: 'S1_SUPERVISOR_OVERVIEW', label: 'Overview', icon: LayoutDashboard },
    { id: 'S2_TO_CHECK', label: 'To check', icon: HelpCircle, count: toCheckCount, badgeColor: 'bg-amber-600' },
    { id: 'S3_ESCALATIONS', label: 'Escalations', icon: AlertTriangle, count: escalationsCount, badgeColor: 'bg-red-600' },
    { id: 'S4_APPROVALS', label: 'Approvals', icon: CheckSquare, count: approvalsCount, badgeColor: 'bg-purple-600' },
    { id: 'S5_OFFICERS_LEAVE', label: 'Officers', icon: Users, count: officersOnLeaveCount > 0 ? officersOnLeaveCount : undefined, badgeColor: 'bg-amber-500' },
    { id: 'S6_PERFORMANCE', label: 'Performance', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FA] text-[#16212E] flex flex-col">
      <SovereignStrip />

      {/* Top Header Bar */}
      <header className="h-16 bg-[#0B3D66] text-white px-4 md:px-6 flex items-center justify-between shadow-xs sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="md:hidden p-1.5 rounded-lg text-white hover:bg-white/10"
            aria-label="Toggle Navigation Menu"
          >
            {mobileDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <SmkmcLogo size={36} />
          <div>
            <h1 className="text-sm font-bold leading-tight">
              SMKMC Supervisor Portal · {currentUser.supervisorUnit || 'DMC 1'}
            </h1>
            <p className="text-[11px] text-slate-300">
              Sangli-Miraj-Kupwad Municipal Corporation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
              {currentUser.role}
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
        {/* Left Navigation (Desktop static, mobile drawer) */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-[#D6DFE8] flex flex-col justify-between pt-20 md:pt-4 transition-transform duration-200 ease-in-out md:static md:translate-x-0
          ${mobileDrawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="px-3 py-2 space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#566475]">
              Supervisor Navigation
            </div>

            {navItems.map((item) => {
              const isActive = activeScreen === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigateTo(item.id);
                    setMobileDrawerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-[#0B3D66] text-white shadow-xs'
                      : 'text-[#16212E] hover:bg-[#F4F7FA] hover:text-[#0B3D66]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>

                  {item.count !== undefined && item.count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${
                      isActive ? 'bg-white/20' : item.badgeColor || 'bg-[#0B3D66]'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-[#D6DFE8] text-[11px] text-[#566475]">
            <p className="font-bold text-[#0B3D66]">SMKMC Civic Ops</p>
            <p>Control Room: 0233-2373455</p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
