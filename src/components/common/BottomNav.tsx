import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Home, 
  FileText, 
  PlusCircle, 
  MapPin, 
  User, 
  CheckSquare, 
  PhoneCall 
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { currentScreen, navigateTo, language, userRole } = useApp();

  // Hide bottom nav on full wizard/login screens
  const hiddenScreens = [
    'M1_LANGUAGE',
    'M2_CITIZEN_LOGIN',
    'M3_OFFICER_LOGIN',
    'C2_MEDIA',
    'C3_AI_CLASSIFY',
    'C4_LOCATION',
    'C5_REVIEW',
    'C6_SUCCESS',
  ];

  if (hiddenScreens.includes(currentScreen)) {
    return null;
  }

  const isCitizen = userRole !== 'officer';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#D6DFE8] shadow-md max-w-md mx-auto md:max-w-xl">
      <div className="grid grid-cols-5 h-16 items-center px-1">
        {/* Tab 1: Home / Tasks */}
        <button
          onClick={() => navigateTo(isCitizen ? 'C1_HOME' : 'OFFICER_DASHBOARD')}
          className={`flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-colors ${
            (currentScreen === 'C1_HOME' || currentScreen === 'OFFICER_DASHBOARD')
              ? 'text-[#0B3D66]'
              : 'text-[#566475] hover:text-[#16212E]'
          }`}
        >
          {isCitizen ? (
            <Home className={`w-5 h-5 ${currentScreen === 'C1_HOME' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          ) : (
            <CheckSquare className={`w-5 h-5 ${currentScreen === 'OFFICER_DASHBOARD' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          )}
          <span className={`text-[10px] mt-1 font-medium ${
            (currentScreen === 'C1_HOME' || currentScreen === 'OFFICER_DASHBOARD') ? 'font-bold text-[#0B3D66]' : ''
          }`}>
            {isCitizen ? (language === 'mr' ? 'मुख्य' : language === 'hi' ? 'होम' : 'Home') : (language === 'mr' ? 'कार्ये' : 'Tasks')}
          </span>
        </button>

        {/* Tab 2: Complaints / Issues */}
        <button
          onClick={() => navigateTo('C7_COMPLAINTS')}
          className={`flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-colors ${
            currentScreen === 'C7_COMPLAINTS'
              ? 'text-[#0B3D66]'
              : 'text-[#566475] hover:text-[#16212E]'
          }`}
        >
          <FileText className={`w-5 h-5 ${currentScreen === 'C7_COMPLAINTS' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className={`text-[10px] mt-1 font-medium ${
            currentScreen === 'C7_COMPLAINTS' ? 'font-bold text-[#0B3D66]' : ''
          }`}>
            {language === 'mr' ? 'तक्रारी' : language === 'hi' ? 'शिकायतें' : 'Track'}
          </span>
        </button>

        {/* Tab 3: Center Action Button (File Complaint or Quick Action) */}
        {isCitizen ? (
          <button
            onClick={() => navigateTo('C2_MEDIA')}
            className="flex flex-col items-center justify-center -mt-4 relative group"
            aria-label="तक्रार नोंदवा / Report Issue"
          >
            <div className="w-13 h-13 rounded-full bg-[#E0681A] text-white flex items-center justify-center shadow-md border-3 border-white group-active:scale-95 transition-transform">
              <PlusCircle className="w-7 h-7 stroke-[2.2]" />
            </div>
            <span className="text-[10px] font-bold text-[#E0681A] mt-0.5">
              {language === 'mr' ? 'नोंदवा' : language === 'hi' ? 'दर्ज करें' : 'Report'}
            </span>
          </button>
        ) : (
          <button
            onClick={() => navigateTo('C10_MAP')}
            className={`flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-colors ${
              currentScreen === 'C10_MAP' ? 'text-[#0B3D66]' : 'text-[#566475]'
            }`}
          >
            <MapPin className={`w-5 h-5 ${currentScreen === 'C10_MAP' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className={`text-[10px] mt-1 font-medium ${currentScreen === 'C10_MAP' ? 'font-bold text-[#0B3D66]' : ''}`}>
              {language === 'mr' ? 'प्रभाग' : 'Ward'}
            </span>
          </button>
        )}

        {/* Tab 4: Map Explorer (or Helpdesk for Officer) */}
        {isCitizen ? (
          <button
            onClick={() => navigateTo('C10_MAP')}
            className={`flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-colors ${
              currentScreen === 'C10_MAP'
                ? 'text-[#0B3D66]'
                : 'text-[#566475] hover:text-[#16212E]'
            }`}
          >
            <MapPin className={`w-5 h-5 ${currentScreen === 'C10_MAP' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className={`text-[10px] mt-1 font-medium ${
              currentScreen === 'C10_MAP' ? 'font-bold text-[#0B3D66]' : ''
            }`}>
              {language === 'mr' ? 'नकाशा' : language === 'hi' ? 'मानचित्र' : 'Map'}
            </span>
          </button>
        ) : (
          <button
            onClick={() => navigateTo('C11_DIRECTORY')}
            className={`flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-colors ${
              currentScreen === 'C11_DIRECTORY'
                ? 'text-[#0B3D66]'
                : 'text-[#566475] hover:text-[#16212E]'
            }`}
          >
            <PhoneCall className={`w-5 h-5 ${currentScreen === 'C11_DIRECTORY' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className={`text-[10px] mt-1 font-medium ${
              currentScreen === 'C11_DIRECTORY' ? 'font-bold text-[#0B3D66]' : ''
            }`}>
              {language === 'mr' ? 'मनपा' : 'Help'}
            </span>
          </button>
        )}

        {/* Tab 5: Profile / Settings */}
        <button
          onClick={() => navigateTo('M5_PROFILE')}
          className={`flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-colors ${
            currentScreen === 'M5_PROFILE'
              ? 'text-[#0B3D66]'
              : 'text-[#566475] hover:text-[#16212E]'
          }`}
        >
          <User className={`w-5 h-5 ${currentScreen === 'M5_PROFILE' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className={`text-[10px] mt-1 font-medium ${
            currentScreen === 'M5_PROFILE' ? 'font-bold text-[#0B3D66]' : ''
          }`}>
            {language === 'mr' ? 'खाते' : language === 'hi' ? 'प्रोफाइल' : 'Profile'}
          </span>
        </button>
      </div>
    </nav>
  );
};
