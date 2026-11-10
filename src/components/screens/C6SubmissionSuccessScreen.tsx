import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SovereignStrip, SmkmcLogo } from '../common/SovereignStrip';
import { 
  CheckCircle, 
  Copy, 
  Check, 
  ArrowRight, 
  FileDown, 
  Home, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  UserCheck 
} from 'lucide-react';

export const C6SubmissionSuccessScreen: React.FC = () => {
  const { language, selectedComplaint, selectComplaint, navigateTo } = useApp();

  const [copied, setCopied] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const token = selectedComplaint?.trackingNumber || 'SMKMC-2026-C8492';

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReceipt = () => {
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-12 flex flex-col justify-between">
      <div>
        <SovereignStrip />

        {/* Top Header */}
        <div className="px-5 pt-8 pb-4 text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-[#1D7A45]/10 text-[#1D7A45] rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-[#1D7A45]/30">
            <CheckCircle className="w-10 h-10 stroke-[2.2]" />
          </div>

          <h1 className="text-lg font-bold text-[#1D7A45] leading-tight">
            {language === 'mr' ? 'तक्रार यशस्वीरीत्या नोंदवली गेली!' : 'Complaint Successfully Registered!'}
          </h1>
          <p className="text-xs text-[#566475] mt-1">
            सांगली, मिरज आणि कुपवाड महानगरपालिका (SMKMC)
          </p>
        </div>

        {/* Official Receipt Card */}
        <div className="px-4 max-w-md mx-auto">
          <div className="bg-white rounded-2xl border-2 border-[#0B3D66] p-5 shadow-sm space-y-4">
            {/* Sovereign 3px strip inside receipt header */}
            <SovereignStrip />

            {/* Token ID Box */}
            <div className="p-3 bg-[#F4F7FA] rounded-xl border border-[#D6DFE8] text-center space-y-1">
              <span className="text-[11px] text-[#566475] font-semibold">
                अधिकृत तक्रार टोकन क्रमांक (Tracking Token):
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-base font-bold text-[#0B3D66] tracking-wider">
                  {token}
                </span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="p-1.5 rounded-md hover:bg-slate-200 text-[#0B3D66] transition-colors"
                  title="Copy Token"
                >
                  {copied ? <Check className="w-4 h-4 text-[#1D7A45]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Receipt Details Table */}
            <div className="text-xs space-y-2.5 pt-1 text-[#16212E]">
              <div className="flex justify-between py-1 border-b border-[#D6DFE8]">
                <span className="text-[#566475]">संवर्ग (Category):</span>
                <span className="font-bold text-right">
                  {language === 'mr' ? selectedComplaint?.categoryNameMr : selectedComplaint?.categoryNameEn || 'घनकचरा व स्वच्छता'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#D6DFE8]">
                <span className="text-[#566475]">प्रभाग (Ward):</span>
                <span className="font-bold text-right">
                  प्रभाग ७ • विश्रामबाग (सांगली)
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#D6DFE8]">
                <span className="text-[#566475]">निवारण मुदत (SLA):</span>
                <span className="font-bold text-[#E0681A] text-right">
                  ४८ तास (०९ ऑक्टो २०२६ पर्यंत)
                </span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-[#566475]">नियुक्त अधिकारी:</span>
                <span className="font-bold text-right">
                  राजेश बी. पाटील (आरोग्य निरीक्षक)
                </span>
              </div>
            </div>

            {/* Statutory Guarantee Badge */}
            <div className="p-2.5 rounded-lg bg-[#0B3D66]/5 border border-[#0B3D66]/20 flex items-center gap-2 text-[11px] text-[#0B3D66]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                महाराष्ट्र लोकसेवा हक्क अधिनियम २०१५ अन्वये वेळेत निवारणाची कायदेशीर हमी.
              </span>
            </div>

            {/* Download PDF button */}
            <button
              type="button"
              onClick={handleDownloadReceipt}
              className="w-full py-2.5 bg-[#F4F7FA] hover:bg-slate-100 border border-[#D6DFE8] rounded-xl text-xs font-bold text-[#0B3D66] flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              <span>
                {downloadSuccess ? 'पावती डाऊनलोड झाली (PDF Saved)' : 'अधिकृत पावती डाऊनलोड करा (PDF)'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pt-6 max-w-md mx-auto w-full space-y-2.5">
        <button
          type="button"
          onClick={() => selectComplaint(token, 'C8_DETAIL')}
          className="w-full min-h-[48px] bg-[#0B3D66] hover:bg-[#082d4d] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all"
        >
          <span>{language === 'mr' ? 'तक्रारीची सद्यस्थिती पहा (Track Status)' : 'Track Issue Status'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => navigateTo('C1_HOME')}
          className="w-full min-h-[44px] bg-white border border-[#D6DFE8] text-[#16212E] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors"
        >
          <Home className="w-4 h-4 text-[#566475]" />
          <span>{language === 'mr' ? 'मुख्यपृष्ठावर परत जा' : 'Back to Home'}</span>
        </button>
      </div>
    </div>
  );
};
