import React, { useState } from 'react';
import { useApp, ScreenId } from '../../context/AppContext';
import { SovereignStrip, SmkmcLogo } from '../common/SovereignStrip';
import { 
  Headphones, 
  PlusCircle, 
  Search, 
  History, 
  Bell, 
  LogOut, 
  Menu, 
  X,
  PhoneCall
} from 'lucide-react';

interface HelpdeskWebShellProps {
  activeScreen: ScreenId;
  children: React.ReactNode;
}

export const HelpdeskWebShell: React.FC<HelpdeskWebShellProps> = ({ activeScreen, children }) => {
  const { 
    currentUser, 
    complaints, 
    helpdeskRedirectLogs, 
    navigateTo, 
    logout, 
    unreadNotifCount 
  } = useApp();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // Compute live counts
  const todaysFiled = complaints.filter(c => c.routeChannel === 'helpdesk').length;
  const todaysRedirects = helpdeskRedirectLogs.length;

  const navItems: { id: ScreenId; label: string; icon: any; count?: number; badgeColor?: string }[] = [
    { id: 'H1_NEW_COMPLAINT', label: 'File Grievance (Call Assisted)', icon: PlusCircle },
    { id: 'H2_SEARCH_STATUS', label: 'Grievance Status Search', icon: Search },
    { 
      id: 'H_TODAYS_LOG', 
      label: "Today's Call Log", 
      icon: History, 
      count: todaysFiled + todaysRedirects, 
      badgeColor: 'bg-[#0B3D66]' 
    },
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
              <span>SMKMC Helpdesk Console</span>
              <span className="text-[10px] bg-[#1D7A45] px-2 py-0.5 rounded font-mono uppercase tracking-wider flex items-center gap-1">
                <PhoneCall className="w-3 h-3" />
                Line: 0233-2373455
              </span>
            </h1>
            <p className="text-[11px] text-slate-300">
              Assisted Grievance Registration & Citizen Inquiry Desk
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
              Operator
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
          <div className="flex-1 px-3 py-2 space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold text-[#566475] uppercase tracking-wider">
              Assisted Intake
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

          {/* Quick Helpline banner at bottom */}
          <div className="p-3 border-t border-[#D6DFE8] bg-[#F4F7FA]">
            <div className="p-3 bg-white rounded-lg border border-[#D6DFE8] text-xs space-y-1.5">
              <span className="font-bold text-[#0B3D66] block">Emergency Citizen Redirects:</span>
              <div className="text-[11px] space-y-1 text-[#566475]">
                <div className="flex justify-between">
                  <span>MSEDCL Electricity:</span>
                  <strong className="text-[#16212E] font-mono">1912</strong>
                </div>
                <div className="flex justify-between">
                  <span>Police Emergency:</span>
                  <strong className="text-[#16212E] font-mono">112</strong>
                </div>
                <div className="flex justify-between">
                  <span>SMKMC Helpline:</span>
                  <strong className="text-[#0B3D66] font-mono">0233-2373455</strong>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#F4F7FA] p-4 md:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
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
