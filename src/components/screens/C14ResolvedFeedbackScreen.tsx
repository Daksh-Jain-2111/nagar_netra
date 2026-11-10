import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { StatusChip, PhotoBadge } from '../common/SharedCivicComponents';
import { 
  Star, 
  Send, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Phone, 
  Check, 
  Clock, 
  MapPin 
} from 'lucide-react';

export const C14ResolvedFeedbackScreen: React.FC = () => {
  const { 
    language, 
    selectedComplaint, 
    navigateTo, 
    simulatedNow, 
    submitComplaintRating, 
    reopenComplaint, 
    escalateToSupervisorDirect 
  } = useApp();

  const [stars, setStars] = useState<number>(selectedComplaint?.rating?.stars || 4);
  const [comment, setComment] = useState<string>(selectedComplaint?.rating?.comment || '');
  const [ratingSaved, setRatingSaved] = useState<boolean>(Boolean(selectedComplaint?.rating));

  // Reopen accordion & reason picker
  const [showReopenAccordion, setShowReopenAccordion] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>('Not repaired at all');
  const [reopenSubmitted, setReopenSubmitted] = useState<boolean>(false);

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

  // Calculate days left to reopen (from 7 days window)
  const reopenDeadlineDate = new Date(c.reopenDeadline);
  const diffMs = reopenDeadlineDate.getTime() - simulatedNow.getTime();
  const daysLeftToReopen = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const canReopen = daysLeftToReopen > 0 && c.status === 'RESOLVED';
  const reopensUsed = c.reopenCount || 0;
  const maxReopensExhausted = reopensUsed >= 2;

  const isFlagged = c.resolvedPhotoBadge === 'FLAGGED';

  const handleRatingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitComplaintRating(c.id, stars, comment);
    setRatingSaved(true);
  };

  const handleReopenSubmit = () => {
    if (maxReopensExhausted) {
      escalateToSupervisorDirect(c.id, reopenReason);
    } else {
      reopenComplaint(c.id, reopenReason);
    }
    setReopenSubmitted(true);
    setTimeout(() => {
      navigateTo('C12_MY_COMPLAINTS');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 text-[#16212E]">
      <Header 
        title={c.trackingNumber} 
        subtitle={language === 'mr' ? 'तक्रार निवारण व अभिप्राय' : 'Resolved & Feedback'}
        showBack
        onBack={() => navigateTo('C12_MY_COMPLAINTS')}
      />

      <div className="max-w-md md:max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* Ticket Header Card */}
        <section className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-[#0B3D66]">{c.trackingNumber}</span>
            <StatusChip status={c.status} />
          </div>

          <h2 className="text-sm font-bold text-[#16212E] leading-snug">
            {c.description}
          </h2>

          <p className="text-xs text-[#566475] flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#E0681A]" />
            <span>{c.wardName}</span>
          </p>
        </section>

        {/* Dual Before / After Photo Comparison */}
        <section className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0B3D66]">Photo Evidence · कामाचा पुरावा</h3>
            <PhotoBadge 
              status={c.resolvedPhotoBadge || 'VERIFIED'} 
              distanceMeters={c.resolvedPhotoDistanceMeters} 
            />
          </div>

          {/* If after-photo was flagged (>200m), show amber note */}
          {isFlagged && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">The officer's photo is being checked by the supervisor.</span>
                <p className="text-[11px] text-amber-900 mt-0.5">
                  Captured {c.resolvedPhotoDistanceMeters || 240}m away from original incident pin.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {/* Before Photo */}
            <div className="flex flex-col rounded-lg overflow-hidden border border-[#D6DFE8] bg-slate-50">
              <div className="relative aspect-square">
                <img 
                  src={c.photoUrls[0]} 
                  alt="Before" 
                  className="w-full h-full object-cover" 
                />
                <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  Before · आधी
                </span>
              </div>
              <div className="p-1.5 text-[10px] text-[#566475]">Citizen Upload</div>
            </div>

            {/* After Photo */}
            <div className="flex flex-col rounded-lg overflow-hidden border border-[#D6DFE8] bg-slate-50">
              <div className="relative aspect-square">
                <img 
                  src={c.resolvedPhotoUrl || c.photoUrls[0]} 
                  alt="After" 
                  className="w-full h-full object-cover" 
                />
                <span className="absolute top-1.5 left-1.5 bg-emerald-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  After · नंतर
                </span>
                {c.resolvedPhotoDistanceMeters !== undefined && (
                  <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded">
                    GPS {c.resolvedPhotoDistanceMeters}m
                  </span>
                )}
              </div>
              <div className="p-1.5 text-[10px] text-emerald-800 font-bold">Field Officer Capture</div>
            </div>
          </div>

          {/* What was done chips */}
          {c.resolvedWhatWasDoneChips && c.resolvedWhatWasDoneChips.length > 0 && (
            <div className="pt-1 space-y-1">
              <span className="text-[11px] font-bold text-[#566475]">Action taken on site:</span>
              <div className="flex flex-wrap gap-1">
                {c.resolvedWhatWasDoneChips.map((chip, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-md bg-[#F4F7FA] border border-[#D6DFE8] text-[11px] text-[#0B3D66] font-medium">
                    ✓ {chip}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Citizen Rating 1–5 + optional comment (saved; allowed also after CLOSED) */}
        <section className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0B3D66]">
              {language === 'mr' ? 'कामाबद्दल आपले समाधान कसे आहे?' : 'Rate Resolution Satisfaction'}
            </h3>
            {ratingSaved && (
              <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
          </div>

          <form onSubmit={handleRatingSubmit} className="space-y-3">
            <div className="flex items-center justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStars(val)}
                  className="p-1 hover:scale-110 active:scale-95 transition-transform"
                >
                  <Star 
                    className={`w-7 h-7 ${
                      val <= stars 
                        ? 'text-[#E0681A] fill-[#E0681A]' 
                        : 'text-slate-300'
                    }`} 
                  />
                </button>
              ))}
            </div>

            <div>
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional feedback comment for the engineering team..."
                className="w-full p-2.5 text-xs rounded-lg border border-[#D6DFE8] focus:border-[#0B3D66] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full h-10 rounded-lg bg-[#0B3D66] text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#082d4d] active:scale-98 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{ratingSaved ? 'Update Rating' : 'Submit Feedback'}</span>
            </button>
          </form>
        </section>

        {/* Reopen Safeguard (Rule: only within 7 days of RESOLVED and max 2 reopens) */}
        <section className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-50 text-red-700 flex items-center justify-center shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-red-900 leading-snug">
                Not resolved properly? · तक्रार निवारणावर असमाधानी?
              </h4>
              <p className="text-[11px] text-[#566475] mt-0.5">
                {daysLeftToReopen > 0 ? (
                  <span>You have <strong>{daysLeftToReopen} days left</strong> to reopen ({reopensUsed}/2 used)</span>
                ) : (
                  <span>Reopen window expired (7 days passed).</span>
                )}
              </p>
            </div>
          </div>

          {canReopen && (
            <div className="space-y-2 pt-1 border-t border-[#D6DFE8]">
              {/* Toggle Reopen Accordion */}
              <button
                type="button"
                onClick={() => setShowReopenAccordion(!showReopenAccordion)}
                className="w-full h-11 px-3 rounded-lg bg-[#F4F7FA] hover:bg-slate-100 text-xs font-bold text-red-900 border border-[#D6DFE8] flex items-center justify-between transition-colors"
              >
                <span>
                  {maxReopensExhausted 
                    ? 'Still not fixed – send to supervisor' 
                    : `Reopen Grievance (${daysLeftToReopen} days left, ${reopensUsed}/2 used)`}
                </span>
                {showReopenAccordion ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {/* Accordion Form */}
              {showReopenAccordion && (
                <div className="p-3 bg-[#F4F7FA] rounded-lg border border-[#D6DFE8] space-y-2.5 text-xs">
                  <span className="font-bold text-[#16212E] block">
                    {maxReopensExhausted ? 'Reason for supervisor escalation:' : 'Select reason for reopening:'}
                  </span>

                  <div className="space-y-1.5">
                    {[
                      'Not repaired at all',
                      'Partly repaired',
                      'Problem came back',
                    ].map((r) => (
                      <label key={r} className="flex items-center gap-2 p-2 rounded bg-white border border-[#D6DFE8] cursor-pointer">
                        <input
                          type="radio"
                          name="reopen_reason"
                          value={r}
                          checked={reopenReason === r}
                          onChange={(e) => setReopenReason(e.target.value)}
                          className="w-4 h-4 text-[#0B3D66]"
                        />
                        <span className="text-xs font-medium text-[#16212E]">{r}</span>
                      </label>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleReopenSubmit}
                    className="w-full h-10 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {maxReopensExhausted 
                        ? 'Escalate to Supervisor (L1)' 
                        : 'Confirm Reopen'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {reopenSubmitted && (
            <p className="text-xs text-emerald-700 font-bold text-center">
              Grievance status updated and routed!
            </p>
          )}
        </section>

        {/* Helpline */}
        <div className="text-center text-xs text-[#566475] pt-2">
          SMKMC Helpline: <strong>0233-2373455</strong>
        </div>
      </div>
    </div>
  );
};
