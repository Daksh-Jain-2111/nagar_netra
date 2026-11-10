import React, { useState } from 'react';
import { useApp, ScreenId } from '../../context/AppContext';
import { SovereignStrip } from '../common/SovereignStrip';
import { 
  Globe2, 
  Building2, 
  Cpu, 
  Boxes, 
  Bell, 
  LogOut, 
  Menu, 
  X,
  ShieldCheck,
  BrainCircuit,
  LayoutDashboard,
  History,
  SlidersHorizontal,
  Workflow
} from 'lucide-react';

interface PlatformWebShellProps {
  activeScreen: ScreenId;
  children: React.ReactNode;
}

export const PlatformWebShell: React.FC<PlatformWebShellProps> = ({ activeScreen, children }) => {
  const { 
    currentUser, 
    platformCorporations, 
    aiModelRegistry, 
    navigateTo, 
    logout, 
    unreadNotifCount 
  } = useApp();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  const navItems: { id: ScreenId; label: string; icon: any; count?: number; badgeColor?: string }[] = [
    { id: 'P1_CORPORATIONS', label: 'Municipal Corporations', icon: Building2, count: platformCorporations.length, badgeColor: 'bg-[#0B3D66]' },
    { id: 'P_AI_MODELS', label: 'AI Model Registry', icon: Cpu, count: aiModelRegistry.length, badgeColor: 'bg-[#E0681A]' },
    { id: 'P_TEMPLATES', label: 'Standard Template Packs', icon: Boxes },
  ];

  // AI & Model Management (platform administrators only; not part of citizen / SI / DMC apps)
  const aiNavItems: { id: ScreenId; label: string; icon: any }[] = [
    { id: 'P_AI_OVERVIEW', label: 'AI Overview', icon: LayoutDashboard },
    { id: 'P_AI_HISTORY', label: 'AI Model History', icon: History },
    { id: 'P_AI_PARAMETERS', label: 'Model Parameters', icon: SlidersHorizontal },
    { id: 'P_AI_RETRAINING', label: 'Retraining History', icon: Workflow },
  ];
  const aiSectionActive = aiNavItems.some(i => i.id === activeScreen);

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

          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-white text-base">
            NN
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight flex items-center gap-2">
              <span>NagarNetra Platform Console</span>
              <span className="text-[10px] bg-purple-500/80 px-2 py-0.5 rounded font-mono uppercase tracking-wider">Multi-Tenant Platform</span>
            </h1>
            <p className="text-[11px] text-slate-300">
              Civic AI Infrastructure for Maharashtra Municipal Corporations
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
            <span className="text-[10px] bg-purple-400/30 px-2 py-0.5 rounded font-mono uppercase">
              Platform Admin
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

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-[#D6DFE8] flex flex-col justify-between pt-20 md:pt-4 transition-transform duration-200 ease-in-out md:static md:translate-x-0
          ${mobileDrawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            <div className="px-3 py-2 text-[11px] font-bold text-[#566475] uppercase tracking-wider">
              Tenant & Model Management
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

            <div className="pt-4 px-3 pb-2 text-[11px] font-bold text-[#566475] uppercase tracking-wider flex items-center gap-1.5">
              <BrainCircuit className={`w-3.5 h-3.5 ${aiSectionActive ? 'text-[#0F8A84]' : 'text-[#566475]'}`} />
              AI & Model Management
            </div>
            <div className="ml-3 pl-2 border-l border-[#D6DFE8] space-y-1">
              {aiNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      navigateTo(item.id);
                      setMobileDrawerOpen(false);
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-[#0B3D66] text-white shadow-xs'
                        : 'text-[#16212E] hover:bg-[#F4F7FA] hover:text-[#0B3D66]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#FFDB99]' : 'text-[#566475]'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 border-t border-[#D6DFE8] bg-[#F4F7FA]">
            <div className="p-3 bg-white rounded-lg border border-[#D6DFE8] text-xs space-y-1 text-[#566475]">
              <span className="font-bold text-[#16212E] block">Lead Corporation:</span>
              <p className="text-[11px]">Sangli-Miraj-Kupwad Municipal Corporation (SMKMC)</p>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-[#F4F7FA] p-4 md:p-6 lg:p-8">
          <div className={`${aiSectionActive ? 'max-w-7xl' : 'max-w-6xl'} mx-auto`}>
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
