import React from 'react';
import { useApp } from '../../context/AppContext';
import { SovereignStrip, SmkmcLogo } from './SovereignStrip';
import { Bell, ArrowLeft, Shield } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, showBack, onBack }) => {
  const { language, setLanguage, unreadNotifCount, navigateTo, currentScreen, userRole } = useApp();

  const handleLanguageToggle = () => {
    if (language === 'mr') {
      setLanguage('en');
    } else if (language === 'en') {
      setLanguage('hi');
    } else {
      setLanguage('mr');
    }
  };

  const getLanguageLabel = () => {
    if (language === 'mr') return 'मराठी / EN';
    if (language === 'hi') return 'हिंदी / EN';
    return 'EN / मराठी';
  };

  const isAuthScreen = currentScreen === 'M1_LANGUAGE' || currentScreen === 'M2_CITIZEN_LOGIN' || currentScreen === 'M3_OFFICER_LOGIN';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#D6DFE8] shadow-xs">
      <SovereignStrip />
      
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        {/* Left Section: Back button or Logo + Corporation Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          {showBack ? (
            <button
              onClick={onBack || (() => navigateTo('C1_HOME'))}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#0B3D66] hover:bg-[#F4F7FA] active:bg-[#D6DFE8] transition-colors"
              aria-label="मागे जा / Go back"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </button>
          ) : (
            <button 
              onClick={() => navigateTo(userRole === 'officer' ? 'OFFICER_DASHBOARD' : 'C1_HOME')} 
              className="flex items-center gap-2 text-left focus:outline-hidden"
            >
              <SmkmcLogo size={36} />
            </button>
          )}

          <div className="min-w-0">
            {title ? (
              <>
                <h1 className="text-[15px] font-bold text-[#0B3D66] leading-tight truncate">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-[11px] text-[#566475] leading-tight truncate">
                    {subtitle}
                  </p>
                )}
              </>
            ) : (
              <>
                <h1 className="text-[13px] sm:text-[14px] font-bold text-[#0B3D66] leading-tight truncate">
                  सांगली, मिरज व कुपवाड मनपा
                </h1>
                <p className="text-[10px] text-[#566475] font-medium leading-tight truncate">
                  {userRole === 'officer' ? 'अधिकारी पोर्टल • Field Officer Portal' : 'नगरनेत्र • AI नागरी तक्रार निवारण'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Right Section: Language Toggle & Notifications Bell */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Official Outline Pill Language Switcher */}
          <button
            onClick={handleLanguageToggle}
            className="min-h-[38px] px-2.5 py-1 text-[12px] font-bold text-[#0B3D66] bg-white border border-[#0B3D66] rounded-full hover:bg-[#F4F7FA] active:bg-[#D6DFE8] transition-all flex items-center gap-1 shadow-2xs"
            title="भाषा बदला / Switch Language"
          >
            <span>{getLanguageLabel()}</span>
          </button>

          {!isAuthScreen && (
            <button
              onClick={() => navigateTo('M4_NOTIFICATIONS')}
              className="relative min-h-[44px] min-w-[40px] flex items-center justify-center rounded-lg text-[#0B3D66] hover:bg-[#F4F7FA] active:bg-[#D6DFE8] transition-colors"
              aria-label="सूचना / Notifications"
            >
              <Bell className="w-5 h-5 stroke-[2]" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-2 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E0681A] text-white text-[10px] font-bold flex items-center justify-center border border-white">
                  {unreadNotifCount}
                </span>
              )}
            </button>
          )}

          {userRole === 'officer' && !isAuthScreen && (
            <div 
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-[#0B3D66]/10 text-[#0B3D66] text-[11px] font-semibold border border-[#0B3D66]/20"
              title="Field Officer Logged In"
            >
              <Shield className="w-3.5 h-3.5 text-[#0B3D66]" />
              <span>प्रभाग ७</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
