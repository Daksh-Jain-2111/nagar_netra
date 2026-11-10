import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { 
  AlertTriangle, 
  Send, 
  ArrowRight, 
  Link2, 
  ArrowLeft 
} from 'lucide-react';

export const F8RequestRejectionScreen: React.FC = () => {
  const { 
    language, 
    selectedComplaint, 
    navigateTo, 
    requestRejection 
  } = useApp();

  const [reason, setReason] = useState<'Not a civic issue' | 'Outside corporation area' | 'Fake or invalid' | 'Duplicate' | 'Other'>('Outside corporation area');
  const [note, setNote] = useState<string>('Inspected spot at Kalanagar boundary. Location falls 120m outside Sangli-Miraj-Kupwad Municipal Corporation boundary under Kupwad Gram Panchayat area.');
  const [submitted, setSubmitted] = useState<boolean>(false);

  if (!selectedComplaint) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] p-8 text-center text-xs">
        <p>No complaint selected.</p>
        <button onClick={() => navigateTo('F1_WORK_QUEUE')} className="mt-3 px-4 py-2 bg-[#0B3D66] text-white rounded">
          Back
        </button>
      </div>
    );
  }

  const c = selectedComplaint;

  // Rule: If officer picks 'Duplicate', send them to F6 (link instead of reject)
  const handleReasonChange = (val: any) => {
    if (val === 'Duplicate') {
      navigateTo('F6_DUPLICATES');
      return;
    }
    setReason(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;

    requestRejection(c.id, reason, note.trim());
    setSubmitted(true);
    setTimeout(() => {
      navigateTo('F1_WORK_QUEUE');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 text-[#16212E]">
      <Header 
        title={c.trackingNumber} 
        subtitle="Request Rejection · तक्रार नाकारण्याची विनंती"
        showBack
        onBack={() => navigateTo('F2_OFFICER_DETAIL')}
      />

      <div className="max-w-md md:max-w-xl mx-auto px-4 pt-4 space-y-4">
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-red-900">
              Select Statutory Reason / कारण निवडा <span className="text-red-600">*</span>
            </h2>
            <p className="text-xs text-[#566475] mt-0.5">
              Rejection requires DMC supervisor approval.
            </p>
          </div>

          {/* Reason Radio Options */}
          <div className="space-y-2">
            {[
              { id: 'Not a civic issue', label: 'Not a civic issue / नागरी समस्या नाही', desc: 'Private dispute, non-municipal issue' },
              { id: 'Outside corporation area', label: 'Outside corporation area / मनपा हद्दीबाहेर', desc: 'Gram Panchayat, PWD highway, or MIDC area' },
              { id: 'Duplicate', label: 'Duplicate / दुबार तक्रार (Redirects to Link F6)', desc: 'Clicking this opens Duplicates Linker' },
              { id: 'Fake or invalid', label: 'Fake or invalid / बनावट किंवा अयोग्य फोटो', desc: 'Test report, abusive, or invalid image' },
              { id: 'Other', label: 'Other / इतर प्रशासकीय कारण', desc: 'Specific administrative reason' },
            ].map(item => (
              <label 
                key={item.id} 
                className={`p-3 rounded-lg border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                  reason === item.id 
                    ? 'bg-red-50 border-red-300 ring-1 ring-red-300' 
                    : 'bg-white border-[#D6DFE8] hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="rej_reason"
                  value={item.id}
                  checked={reason === item.id}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  className="w-4 h-4 text-red-700 mt-0.5"
                />
                <div className="flex-1">
                  <span className="font-bold text-[#16212E] block">{item.label}</span>
                  <span className="text-[11px] text-[#566475]">{item.desc}</span>
                </div>
              </label>
            ))}
          </div>

          {/* Justification Note (Required) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#16212E]">
                Mandatory justification note / सविस्तर शेरा <span className="text-red-600">*</span>
              </label>
              <span className="text-[10px] text-[#566475]">{note.length} / 500</span>
            </div>
            <textarea
              rows={3}
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explain ground observation or jurisdictional boundary landmark..."
              className="w-full p-2.5 rounded-lg border border-[#D6DFE8] text-xs text-[#16212E] focus:border-red-600 focus:outline-none"
            />
          </div>

          {/* Supervisor Approval Warning */}
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
            <span className="font-bold">Supervisor Approval Required:</span>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              Rejection needs DMC approval. Until approved, the complaint stays with you and response/resolution clocks remain active.
            </p>
          </div>

          <button
            type="submit"
            disabled={!note.trim()}
            className="w-full h-11 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{submitted ? 'Rejection Requested!' : 'Send for approval / मंजुरीसाठी पाठवा'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
