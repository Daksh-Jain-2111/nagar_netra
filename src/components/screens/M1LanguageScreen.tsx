import React from 'react';
import { useApp } from '../../context/AppContext';
import { AppLanguage } from '../../types';
import { SovereignStrip, SmkmcLogo } from '../common/SovereignStrip';
import { PhoneCall, CheckCircle2 } from 'lucide-react';

export const M1LanguageScreen: React.FC = () => {
  const { language, setLanguage, navigateTo, currentUser } = useApp();

  const handleSelectLanguage = (lang: AppLanguage) => {
    setLanguage(lang);
  };

  const handleContinue = () => {
    if (currentUser) {
      navigateTo('C1_HOME');
    } else {
      navigateTo('M2_CITIZEN_LOGIN');
    }
  };

  const languages = [
    {
      code: 'mr' as AppLanguage,
      name: 'मराठी',
      subtitle: 'महाराष्ट्र राज्यभाषा (प्राधान्य)',
      description: 'सर्व माहिती, शासकीय पत्रे व तक्रार स्थिती मराठीतून.',
      nativeTitle: 'सांगली-मिरज-कुपवाड मनपा',
    },
    {
      code: 'hi' as AppLanguage,
      name: 'हिंदी',
      subtitle: 'Hindi',
      description: 'नागरिक सेवा और शिकायत निवारण हिंदी में।',
      nativeTitle: 'सांगली-मिरज-कुपवाड़ मनपा',
    },
    {
      code: 'en' as AppLanguage,
      name: 'English',
      subtitle: 'English Language',
      description: 'Official municipal services and issue reporting in English.',
      nativeTitle: 'Sangli-Miraj-Kupwad Municipal Corp',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex flex-col justify-between">
      <div>
        <SovereignStrip />
        
        {/* Emergency Call 112 Banner (Functional Rule) */}
        <div className="bg-[#B42318] text-white px-4 py-2.5 flex items-center justify-between text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 shrink-0 text-white animate-pulse" />
            <span>तातडीच्या आणीबाणीसाठी 112 वर कॉल करा • Call 112 for Police/Disaster Emergency</span>
          </div>
          <a 
            href="tel:112" 
            className="px-2.5 py-1 bg-white text-[#B42318] rounded-md font-bold text-[11px] hover:bg-slate-100 shrink-0"
          >
            112
          </a>
        </div>

        {/* Municipal Header Lockup */}
        <div className="px-5 pt-8 pb-4 text-center">
          <div className="flex justify-center mb-3">
            <SmkmcLogo size={64} className="shadow-sm" />
          </div>
          <h1 className="text-xl font-bold text-[#0B3D66] leading-snug">
            सांगली, मिरज आणि कुपवाड<br />शहर महानगरपालिका
          </h1>
          <p className="text-xs text-[#566475] mt-1 font-medium">
            नगरनेत्र • AI नागरी तक्रार निवारण व्यासपीठ
          </p>
          <div className="inline-block mt-2 px-3 py-0.5 rounded-full bg-[#0B3D66]/8 text-[#0B3D66] text-[11px] font-semibold border border-[#0B3D66]/15">
            Sangli-Miraj-Kupwad Municipal Corporation
          </div>
        </div>

        {/* Language Selection Card Options */}
        <div className="px-4 py-3 max-w-md mx-auto">
          <div className="mb-3 text-left">
            <h2 className="text-sm font-bold text-[#16212E]">
              कृपया तुमची भाषा निवडा / Choose Language
            </h2>
            <p className="text-[12px] text-[#566475]">
              ही निवड नंतर प्रोफाइल किंवा वरून कधीही बदलता येईल.
            </p>
          </div>

          <div className="space-y-3">
            {languages.map((item) => {
              const isSelected = language === item.code;
              return (
                <button
                  key={item.code}
                  onClick={() => handleSelectLanguage(item.code)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-start justify-between min-h-[72px] ${
                    isSelected
                      ? 'bg-white border-[#0B3D66] ring-2 ring-[#0B3D66]/20 shadow-xs'
                      : 'bg-white border-[#D6DFE8] hover:border-[#0B3D66]/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-[#0B3D66]">{item.name}</span>
                      <span className="text-xs text-[#566475] font-medium">({item.subtitle})</span>
                    </div>
                    <p className="text-xs text-[#16212E] mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-0.5 shrink-0 ml-3">
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-[#0B3D66] fill-[#0B3D66]/15" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-[#D6DFE8]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="p-4 bg-white border-t border-[#D6DFE8] max-w-md mx-auto w-full">
        <button
          onClick={handleContinue}
          className="w-full min-h-[48px] bg-[#0B3D66] text-white font-bold text-sm rounded-lg hover:bg-[#082d4d] active:scale-[0.99] transition-all flex items-center justify-center shadow-xs"
        >
          {language === 'mr' ? 'पुढे जा (Continue)' : language === 'hi' ? 'आगे बढ़ें (Continue)' : 'Continue'}
        </button>
        <p className="text-center text-[11px] text-[#566475] mt-2">
          महाराष्ट्र लोकसेवा हक्क अधिनियम (RTS 2015) अंतर्गत प्रमाणित
        </p>
      </div>
    </div>
  );
};
