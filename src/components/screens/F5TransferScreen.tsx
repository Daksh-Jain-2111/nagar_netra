import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { MOCK_CATEGORIES } from '../../data/mockData';
import { 
  Search, 
  Send, 
  AlertTriangle, 
  ArrowRight, 
  Check, 
  ShieldCheck, 
  ArrowLeft 
} from 'lucide-react';

export const F5TransferScreen: React.FC = () => {
  const { 
    language, 
    selectedComplaint, 
    navigateTo, 
    transferComplaint, 
    currentUser 
  } = useApp();

  const [searchDept, setSearchDept] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('drainage');
  const [reason, setReason] = useState<string>('Issue caused by underground drainage pipeline collapse beneath road crust. Needs Drainage Dept pipeline replacement.');
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
  const isFirstTransfer = !c.transferRequest || c.transferRequest.transferCount === 0;

  // Filter department list: exclude own department
  const eligibleDepartments = MOCK_CATEGORIES.filter(
    cat => cat.departmentId !== c.departmentId && cat.department !== c.department
  ).filter(cat => {
    if (!searchDept.trim()) return true;
    const q = searchDept.toLowerCase();
    return cat.nameEn.toLowerCase().includes(q) || cat.department.toLowerCase().includes(q) || cat.nameMr.includes(q);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !reason.trim()) return;

    transferComplaint(c.id, selectedDeptId, reason.trim());
    setSubmitted(true);
    setTimeout(() => {
      navigateTo('F1_WORK_QUEUE');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 text-[#16212E]">
      <Header 
        title={c.trackingNumber} 
        subtitle="Transfer Complaint · विभाग हस्तांतरण"
        showBack
        onBack={() => navigateTo('F2_OFFICER_DETAIL')}
      />

      <div className="max-w-md md:max-w-xl mx-auto px-4 pt-4 space-y-4">
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-4">
          {/* Originating Unit */}
          <div className="p-3 rounded-lg bg-[#F4F7FA] border border-[#D6DFE8] flex items-center justify-between text-xs">
            <div>
              <span className="text-[11px] text-[#566475] block">Originating Unit / मूळ विभाग</span>
              <span className="font-bold text-[#0B3D66]">{c.department}</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-white text-[10px] font-bold border border-[#D6DFE8]">
              {isFirstTransfer ? '1st Transfer (Direct)' : '2nd Transfer (Supervisor)'}
            </span>
          </div>

          {/* Search Departments */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#16212E] block">
              Target Department / नवीन विभाग निवडा <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#566475] absolute left-3 top-3" />
              <input
                type="text"
                value={searchDept}
                onChange={(e) => setSearchDept(e.target.value)}
                placeholder="Search department / विभाग शोधा..."
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#D6DFE8] text-xs focus:border-[#0B3D66] focus:outline-none"
              />
            </div>
          </div>

          {/* Department Choice Cards */}
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {eligibleDepartments.map((cat) => {
              const isSelected = selectedDeptId === cat.departmentId;
              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedDeptId(cat.departmentId)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between ${
                    isSelected 
                      ? 'bg-[#0B3D66]/5 border-[#0B3D66] ring-1 ring-[#0B3D66]' 
                      : 'bg-white border-[#D6DFE8] hover:border-slate-400'
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-[#0B3D66]">{cat.department}</h4>
                    <p className="text-[11px] text-[#566475] mt-0.5">{cat.descriptionEn}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-slate-100 text-[10px] text-[#566475]">
                      SLA: {cat.slaHours}h
                    </span>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-2 ${
                    isSelected ? 'bg-[#0B3D66] text-white' : 'border border-[#D6DFE8]'
                  }`}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reason (Required) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#16212E] block">
              Reason for Transfer / हस्तांतरणाचे कारण <span className="text-red-600">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain technical reason why this falls under recipient department scope..."
              className="w-full p-2.5 rounded-lg border border-[#D6DFE8] text-xs text-[#16212E] focus:border-[#0B3D66] focus:outline-none"
            />
          </div>

          {/* Transfer Policy Rule Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-1">
            <span className="font-bold">
              {isFirstTransfer 
                ? 'Direct Transfer (First Transfer)' 
                : 'Second Transfer Requires Supervisor Approval'}
            </span>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              {isFirstTransfer 
                ? 'Routes directly to that department\'s active officer. Clocks restart for new officer while total age since filing is preserved.' 
                : 'A subsequent transfer requires DMC supervisor approval. The complaint remains in your queue until decided.'}
            </p>
          </div>

          <button
            type="submit"
            disabled={!reason.trim()}
            className="w-full h-11 rounded-xl bg-[#0B3D66] text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#082d4d] active:scale-98 transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{submitted ? 'Transferred!' : (isFirstTransfer ? 'Transfer Directly / हस्तांतरित करा' : 'Request Second Transfer')}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
