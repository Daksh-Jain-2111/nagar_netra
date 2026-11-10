import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { StatusChip, EscalationBadge, CountdownPill, PhotoBadge } from '../common/SharedCivicComponents';
import { 
  Copy, 
  Check, 
  Share2, 
  MapPin, 
  Clock, 
  Calendar, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Phone, 
  Building 
} from 'lucide-react';

export const C13ComplaintDetailScreen: React.FC = () => {
  const { 
    language, 
    selectedComplaint, 
    navigateTo, 
    simulatedNow, 
    complaints, 
    selectComplaint 
  } = useApp();

  const [copied, setCopied] = useState<boolean>(false);
  const [shared, setShared] = useState<boolean>(false);

  if (!selectedComplaint) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] p-8 text-center text-xs">
        <p>Complaint not found.</p>
        <button onClick={() => navigateTo('C12_MY_COMPLAINTS')} className="mt-3 px-4 py-2 bg-[#0B3D66] text-white rounded-lg">
          Back to list
        </button>
      </div>
    );
  }

  const c = selectedComplaint;
  const parentComplaint = c.linkedParentId ? complaints.find(item => item.id === c.linkedParentId) : null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(c.trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `NagarNetra Complaint: ${c.trackingNumber}`,
        text: `Tracking grievance ${c.trackingNumber} in ${c.wardName}`,
      }).catch(() => {});
    } else {
      handleCopy();
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  // Determine active step index: 0: Submitted, 1: Assigned, 2: In Progress / Work Scheduled, 3: Resolved, 4: Closed
  const getStepIndex = () => {
    switch (c.status) {
      case 'SUBMITTED':
      case 'TO_CHECK':
        return 0;
      case 'ASSIGNED':
        return 1;
      case 'IN_PROGRESS':
      case 'WORK_SCHEDULED':
      case 'REOPENED':
      case 'REJECTION_REQUESTED':
        return 2;
      case 'RESOLVED':
        return 3;
      case 'CLOSED':
      case 'REJECTED':
        return 4;
      default:
        return 0;
    }
  };

  const currentStepIdx = getStepIndex();

  const steps = [
    { labelEn: 'Submitted', labelMr: 'नोंदवली' },
    { labelEn: 'Assigned', labelMr: 'नियुक्त' },
    { labelEn: 'In progress', labelMr: 'काम सुरू' },
    { labelEn: 'Resolved', labelMr: 'निवारण' },
    { labelEn: 'Closed', labelMr: 'बंद' },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 text-[#16212E]">
      <Header 
        title={c.trackingNumber} 
        subtitle={language === 'mr' ? c.categoryNameMr : c.categoryNameEn}
        showBack
        onBack={() => navigateTo('C12_MY_COMPLAINTS')}
      />

      <div className="max-w-md md:max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* Token & Share Header Bar */}
        <div className="flex items-center justify-between gap-2 bg-white p-3 rounded-xl border border-[#D6DFE8] shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] text-[#566475] uppercase font-bold tracking-wider shrink-0">Token:</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 font-mono text-xs font-bold text-[#0B3D66] bg-[#F4F7FA] px-2 py-0.5 rounded border border-[#D6DFE8] hover:bg-slate-200 transition-colors"
              title="Copy Token"
            >
              <span>{c.trackingNumber}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#566475]" />}
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleShare}
              className="p-1.5 rounded-lg bg-[#F4F7FA] text-[#0B3D66] border border-[#D6DFE8] hover:bg-slate-200 transition-colors"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Primary Status & Details Card */}
        <section className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#E0681A]">
                {language === 'mr' ? c.departmentMr : c.department}
              </span>
              <StatusChip status={c.status} scheduledDate={c.scheduledTargetDate} />
            </div>

            <h2 className="text-base font-bold text-[#0B3D66] leading-tight mt-1">
              {c.description}
            </h2>

            <p className="text-xs text-[#566475] mt-1.5 flex items-start gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#E0681A] shrink-0 mt-0.5" />
              <span>{c.landmark ? `${c.landmark}, ` : ''}{c.address} ({c.wardName})</span>
            </p>
          </div>

          {/* Rejection Notice if REJECTED */}
          {c.status === 'REJECTED' && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-red-700" />
                <span>तक्रार नाकारली · Reason: {c.rejectedReason || 'Outside corporation area'}</span>
              </div>
              <p className="text-[11px] text-red-800">
                {c.rejectedNote || 'The site falls outside municipal jurisdiction or cannot be serviced by corporation.'}
              </p>
            </div>
          )}

          {/* Linked Parent Information */}
          {c.linkedParentId && (
            <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-600" />
                <span>Follows parent {c.linkedParentId} ({parentComplaint?.status || 'IN_PROGRESS'})</span>
              </div>
              <p className="text-[11px] text-sky-900">
                This report is linked to an existing nearby complaint. It will be resolved together with the main repair work.
              </p>
            </div>
          )}

          {/* Escalation Badge */}
          {c.escalationLevel && (
            <div>
              <EscalationBadge level={c.escalationLevel} reason={c.escalationReason} />
            </div>
          )}

          {/* TWO STATUTORY CLOCK PILLS (Exact requirement) */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#D6DFE8]">
            {/* Clock 1: Response Clock */}
            <div className="bg-[#F4F7FA] p-2.5 rounded-lg border border-[#D6DFE8] flex flex-col justify-between">
              <span className="text-[10px] text-[#566475] font-bold uppercase tracking-wide">First Action</span>
              <div className="mt-1">
                <CountdownPill 
                  deadline={c.responseDeadline} 
                  label="Response" 
                  isMet={c.responseMet} 
                  currentSimulatedNow={simulatedNow} 
                />
              </div>
            </div>

            {/* Clock 2: Resolution Fix Target */}
            <div className="bg-[#F4F7FA] p-2.5 rounded-lg border border-[#D6DFE8] flex flex-col justify-between">
              <span className="text-[10px] text-[#566475] font-bold uppercase tracking-wide">Fix Target</span>
              <div className="mt-1">
                <CountdownPill 
                  deadline={c.scheduledTargetDate || c.resolutionDeadline} 
                  label="Target" 
                  isMet={c.status === 'RESOLVED' || c.status === 'CLOSED'} 
                  currentSimulatedNow={simulatedNow} 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Horizontal Stepper (Progress Bar) */}
        <section className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <h3 className="font-bold text-[#0B3D66]">Resolution Stages · टप्पे</h3>
            <span className="text-[11px] text-[#566475]">Step {currentStepIdx + 1} of 5</span>
          </div>

          <div className="w-full pt-1">
            <div className="flex items-center justify-between relative">
              {steps.map((st, idx) => {
                const isPassed = idx < currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <div key={st.labelEn} className="flex flex-col items-center z-10 w-16 text-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-xs transition-colors ${
                      isPassed ? 'bg-emerald-600 text-white' :
                      isCurrent ? 'bg-[#0B3D66] text-white ring-2 ring-[#0B3D66]/20' :
                      'bg-[#F4F7FA] text-[#566475] border border-[#D6DFE8]'
                    }`}>
                      {isPassed ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    <span className={`text-[11px] mt-1 font-bold leading-tight ${isCurrent ? 'text-[#0B3D66]' : 'text-[#566475]'}`}>
                      {st.labelEn}
                    </span>
                    <span className="text-[10px] text-[#566475] leading-none">
                      {st.labelMr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Evidence Photo Card */}
        <section className="bg-white rounded-xl border border-[#D6DFE8] overflow-hidden shadow-xs">
          <div className="relative aspect-video bg-black/5 overflow-hidden">
            <img 
              src={c.photoUrls[0]} 
              alt="Complaint evidence" 
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2">
              <PhotoBadge status={c.photoBadge || 'VERIFIED'} />
            </div>
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 rounded backdrop-blur-xs">
              Lat: {c.latitude}° N, Lng: {c.longitude}° E
            </div>
          </div>
        </section>

        {/* Real History Events Timeline (Rule: Officers shown by role only, never by name/phone) */}
        <section className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-2">
            <h3 className="font-bold text-xs text-[#0B3D66]">Activity Log & Timeline</h3>
            <span className="text-[10px] text-[#566475]">Real history events</span>
          </div>

          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#D6DFE8]">
            {c.timeline.map((step) => (
              <div key={step.id} className="relative">
                <span className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  step.status === 'RESOLVED' ? 'bg-emerald-600' :
                  step.isInstruction ? 'bg-red-600' :
                  'bg-[#0B3D66]'
                }`} />

                <div>
                  <div className="flex items-baseline justify-between gap-1">
                    <h4 className="text-xs font-bold text-[#16212E]">
                      {language === 'mr' ? step.titleMr : step.titleEn}
                    </h4>
                    <span className="text-[10px] text-[#566475] font-mono shrink-0">
                      {step.timestamp}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#566475] mt-0.5 font-medium">
                    {step.actorRole}
                  </p>

                  {step.comment && (
                    <div className="mt-1 p-2 bg-[#F4F7FA] rounded border border-[#D6DFE8] text-xs text-[#16212E]">
                      {step.comment}
                    </div>
                  )}

                  {step.photoUrl && (
                    <div className="mt-1.5 w-24 h-16 rounded overflow-hidden border border-[#D6DFE8]">
                      <img src={step.photoUrl} alt="Progress" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Municipal Helpline Box (Only phone allowed: helpline 0233-2373455) */}
        <div className="p-3 bg-[#F4F7FA] rounded-xl border border-[#D6DFE8] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#0B3D66] text-white flex items-center justify-center shrink-0">
              <Phone className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold text-[#0B3D66]">SMKMC Helpline: 0233-2373455</p>
              <p className="text-[10px] text-[#566475]">Sangli-Miraj-Kupwad Municipal Corporation</p>
            </div>
          </div>
          <a
            href="tel:02332373455"
            className="px-2.5 py-1 bg-white border border-[#D6DFE8] text-[#0B3D66] font-bold text-[11px] rounded-lg hover:bg-slate-50"
          >
            Call
          </a>
        </div>
      </div>
    </div>
  );
};
