import React from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { AppLanguage, UserRole } from '../../types';
import { 
  User, 
  ShieldCheck, 
  Globe, 
  Phone, 
  FileText, 
  LogOut, 
  ChevronRight, 
  Building2, 
  HelpCircle,
  Smartphone
} from 'lucide-react';

export const M5ProfileScreen: React.FC = () => {
  const { 
    language, 
    setLanguage, 
    currentUser, 
    userRole, 
    users,
    switchUser, 
    logout, 
    navigateTo,
    isMobileDeviceFrame,
    setIsMobileDeviceFrame
  } = useApp();

  const handleRoleChange = (role: UserRole) => {
    const targetUser = users.find(u => u.role === role);
    if (targetUser) {
      switchUser(targetUser.id);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24">
      <Header 
        title={language === 'mr' ? 'नागरिक प्रोफाइल व खाते' : 'Profile & Settings'} 
        subtitle="SMKMC सांगली-मिरज-कुपवाड" 
      />

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* User Card */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-full bg-[#0B3D66] text-white flex items-center justify-center font-bold text-lg shrink-0">
            {currentUser?.name ? currentUser.name.charAt(0) : 'ना'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-[#16212E] truncate">
              {currentUser?.name || (userRole === 'officer' ? 'राजेश बी. पाटील' : 'सचिन दत्तात्रय पाटील')}
            </h2>
            <p className="text-xs text-[#566475] font-mono mt-0.5">
              +91 {currentUser?.mobile || '9822154320'}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#0B3D66]/10 text-[#0B3D66] border border-[#0B3D66]/20">
                {userRole === 'officer' ? 'क्षेत्रीय अधिकारी (Field Officer)' : 'नागरिक (Citizen - Ward 7)'}
              </span>
              <span className="text-[11px] text-[#566475]">
                {currentUser?.wardName || 'विश्रामबाग (प्रभाग ७)'}
              </span>
            </div>
          </div>
        </div>

        {/* Demo Persona Switcher (Allows testing all roles seamlessly!) */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#16212E] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0B3D66]" />
              {language === 'mr' ? 'भूमिका बदला (Demo Switch Role)' : 'Switch Role (Demo)'}
            </span>
            <span className="text-[10px] text-[#566475]">One App for All Roles</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleRoleChange('citizen')}
              className={`p-2 rounded-lg text-xs font-bold text-center border transition-all ${
                userRole === 'citizen'
                  ? 'bg-[#0B3D66] text-white border-[#0B3D66]'
                  : 'bg-[#F4F7FA] text-[#16212E] border-[#D6DFE8] hover:bg-slate-100'
              }`}
            >
              नागरिक (Citizen)
            </button>
            <button
              onClick={() => handleRoleChange('officer')}
              className={`p-2 rounded-lg text-xs font-bold text-center border transition-all ${
                userRole === 'officer'
                  ? 'bg-[#0B3D66] text-white border-[#0B3D66]'
                  : 'bg-[#F4F7FA] text-[#16212E] border-[#D6DFE8] hover:bg-slate-100'
              }`}
            >
              क्षेत्रीय अधिकारी (Officer)
            </button>
          </div>
        </div>

        {/* Language Selection */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-3.5 shadow-xs">
          <div className="flex items-center gap-2 mb-2.5">
            <Globe className="w-4 h-4 text-[#0B3D66]" />
            <span className="text-xs font-bold text-[#16212E]">
              {language === 'mr' ? 'अ‍ॅप भाषा (Language)' : 'App Language'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { code: 'mr', label: 'मराठी' },
              { code: 'hi', label: 'हिंदी' },
              { code: 'en', label: 'English' },
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => setLanguage(l.code as AppLanguage)}
                className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                  language === l.code
                    ? 'bg-[#0B3D66] text-white border-[#0B3D66]'
                    : 'bg-white text-[#16212E] border-[#D6DFE8] hover:bg-slate-50'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Toggle: Realistic Mobile Device vs Responsive */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-3.5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#0B3D66]" />
            <div>
              <p className="text-xs font-bold text-[#16212E]">
                {language === 'mr' ? 'मोबाईल फ्रेम दृश्य' : 'Device Frame View'}
              </p>
              <p className="text-[11px] text-[#566475]">
                {isMobileDeviceFrame ? 'Stitch Android Frame (390px)' : 'Full Responsive Web Layout'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileDeviceFrame(!isMobileDeviceFrame)}
            className="px-3 py-1.5 text-xs font-bold text-[#0B3D66] bg-[#F4F7FA] border border-[#D6DFE8] rounded-lg hover:bg-slate-100"
          >
            {isMobileDeviceFrame ? 'Expand Full' : 'Mobile Frame'}
          </button>
        </div>

        {/* Corporation Directory & Help Links */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] divide-y divide-[#D6DFE8] overflow-hidden shadow-xs">
          <button
            onClick={() => navigateTo('C11_DIRECTORY')}
            className="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-[#0B3D66]" />
              <div>
                <p className="text-xs font-bold text-[#16212E]">
                  {language === 'mr' ? 'मनपा प्रभाग कार्यालये व अधिकारी' : 'SMKMC Ward Offices & Directory'}
                </p>
                <p className="text-[11px] text-[#566475]">सांगली, मिरज व कुपवाड कार्यालयांचे संपर्क</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#566475]" />
          </button>

          <a
            href="tel:02332373455"
            className="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-[#1D7A45]" />
              <div>
                <p className="text-xs font-bold text-[#16212E]">
                  {language === 'mr' ? 'मनपा मध्यवर्ती हेल्पलाइन (Helpline)' : 'SMKMC Central Helpline'}
                </p>
                <p className="text-[11px] text-[#566475]">0233-2373455</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#1D7A45]">कॉल करा</span>
          </a>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full min-h-[46px] bg-white border border-[#B42318] text-[#B42318] font-bold text-xs rounded-xl hover:bg-[#B42318]/5 transition-colors flex items-center justify-center gap-2 shadow-2xs"
        >
          <LogOut className="w-4 h-4" />
          <span>{language === 'mr' ? 'खात्यातून बाहेर पडा (Log Out)' : 'Sign Out'}</span>
        </button>

        <p className="text-center text-[10px] text-[#566475] pt-2">
          NagarNetra v2.4 • Sangli-Miraj-Kupwad Municipal Corporation
        </p>
      </div>
    </div>
  );
};
