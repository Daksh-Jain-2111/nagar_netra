import React from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { MOCK_WARD_OFFICES } from '../../data/mockData';
import { 
  Building2, 
  Phone, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  AlertCircle,
  FileText,
  ExternalLink
} from 'lucide-react';

export const C11MunicipalDirectoryScreen: React.FC = () => {
  const { language, navigateTo } = useApp();

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24">
      <Header 
        title={language === 'mr' ? 'मनपा प्रभाग व संपर्क' : 'Municipal Directory'} 
        subtitle="सांगली-मिरज-कुपवाड महानगरपालिका"
      />

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Central Helpline Card */}
        <div className="bg-[#0B3D66] text-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#FFDB99] uppercase tracking-wider">
              २४x७ मध्यवर्ती तक्रार हेल्पलाईन
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
              SMKMC
            </span>
          </div>

          <div>
            <h3 className="text-2xl font-bold font-mono tracking-tight text-[#FFDB99]">
              0233-2373455
            </h3>
            <p className="text-xs text-slate-200 mt-1">
              राजवाडा चौक, मारुती रोड, सांगली मुख्यालय
            </p>
          </div>

          <a
            href="tel:02332373455"
            className="w-full py-2 bg-[#E0681A] hover:bg-[#c95914] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <Phone className="w-4 h-4" />
            <span>थेट हेल्पलाईनवर संपर्क साधा</span>
          </a>
        </div>

        {/* 3 Main Corporation Ward Divisions (Sangli, Miraj, Kupwad) */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-[#16212E]">
            {language === 'mr' ? 'विभागीय कार्यालये (Divisional Offices)' : 'Divisional Offices'}
          </h3>

          {MOCK_WARD_OFFICES.map((off) => (
            <div
              key={off.id}
              className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-[#0B3D66] text-xs">
                  {language === 'mr' ? off.nameMr : off.nameEn}
                </h4>
                <span className="px-2 py-0.5 rounded bg-[#0B3D66]/5 text-[#0B3D66] font-bold text-[10px]">
                  {off.officerInCharge}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] text-[#16212E]">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#566475] shrink-0 mt-0.5" />
                  <span>{language === 'mr' ? off.addressMr : off.addressEn}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#566475]">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>व्याप्ती: {off.zonesCovered}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#D6DFE8] flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#0B3D66]">
                  0233-2373455
                </span>
                <a
                  href="tel:02332373455"
                  className="px-3 py-1 bg-[#F4F7FA] border border-[#D6DFE8] text-[#0B3D66] font-bold text-[11px] rounded-lg hover:bg-slate-100"
                >
                  कॉल करा
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Category Resolution Timelines */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-2">
            <h3 className="text-xs font-bold text-[#0B3D66] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#0B3D66]" />
              <span>सेवा हमी मुदत (Service Timelines)</span>
            </h3>
            <span className="text-[10px] text-[#1D7A45] font-bold bg-[#1D7A45]/10 px-2 py-0.5 rounded">
              निवारण कालावधी
            </span>
          </div>

          <div className="divide-y divide-[#D6DFE8] text-[11px]">
            <div className="flex justify-between py-2">
              <span className="text-[#16212E] font-medium">बंद पथदिवे दुरुस्ती</span>
              <span className="font-bold text-[#0B3D66]">२४ तास</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#16212E] font-medium">घनकचरा व सांडपाणी उचल</span>
              <span className="font-bold text-[#0B3D66]">४८ तास</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#16212E] font-medium">पाणीपुरवठा गळती दुरुस्ती</span>
              <span className="font-bold text-[#0B3D66]">२४ तास</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#16212E] font-medium">रस्त्यावरील खड्डे दुरुस्ती</span>
              <span className="font-bold text-[#0B3D66]">७२ तास</span>
            </div>
          </div>
        </div>

        {/* Official Emergency & Utility Redirects */}
        <div className="bg-[#F4F7FA] rounded-xl border border-[#D6DFE8] p-3 text-xs space-y-2">
          <p className="font-bold text-[#16212E]">
            अधिकृत बाह्य संपर्क व पुनर्निर्देशन:
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <a href="tel:112" className="p-2.5 bg-white rounded-xl border border-[#D6DFE8] flex justify-between items-center font-bold hover:border-[#B42318]">
              <div>
                <p className="text-[10px] text-[#566475]">आपत्कालीन / पोलीस</p>
                <p className="text-[#B42318] text-xs">112</p>
              </div>
              <Phone className="w-3.5 h-3.5 text-[#B42318]" />
            </a>

            <a href="tel:1912" className="p-2.5 bg-white rounded-xl border border-[#D6DFE8] flex justify-between items-center font-bold hover:border-[#0B3D66]">
              <div>
                <p className="text-[10px] text-[#566475]">महावितरण (वीज)</p>
                <p className="text-[#0B3D66] text-xs">1912</p>
              </div>
              <Phone className="w-3.5 h-3.5 text-[#0B3D66]" />
            </a>

            <div className="p-2.5 bg-white rounded-xl border border-[#D6DFE8] flex justify-between items-center font-bold">
              <div>
                <p className="text-[10px] text-[#566475]">ट्रॅफिक पोलीस सांगली</p>
                <p className="text-[#16212E] text-[11px]">वाहतूक शाखा</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[#566475]" />
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-[#D6DFE8] flex justify-between items-center font-bold">
              <div>
                <p className="text-[10px] text-[#566475]">NHAI / PWD रस्ते</p>
                <p className="text-[#16212E] text-[11px]">महामार्ग विभाग</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[#566475]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
