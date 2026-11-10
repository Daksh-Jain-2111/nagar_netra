import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { 
  Calendar, 
  Send, 
  Clock, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle, 
  ArrowLeft 
} from 'lucide-react';

export const F4RequestNewDateScreen: React.FC = () => {
  const { 
    language, 
    selectedComplaint, 
    navigateTo, 
    requestTargetDate, 
    simulatedNow 
  } = useApp();

  const [proposedDate, setProposedDate] = useState<string>('2026-10-18');
  const [reason, setReason] = useState<'Monsoon' | 'Needs tender or work order' | 'Material awaited' | 'Other'>('Material awaited');
  const [note, setNote] = useState<string>('Bitumen supply batch allocated for weekend dry spell. Compaction requires dry surface.');
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
  const currentTargetStr = c.scheduledTargetDate || c.resolutionDeadline;
  const currentTargetDate = new Date(currentTargetStr);
  const formattedCurrentTarget = currentTargetDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // Has pending request already?
  const isPending = c.extensionRequest?.status === 'PENDING';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedDate || !note.trim()) return;

    // proposedDate must be later than current target
    const proposedDateTime = new Date(`${proposedDate}T18:00:00Z`);
    if (proposedDateTime.getTime() <= currentTargetDate.getTime()) {
      alert('Proposed completion date must be later than current target date.');
      return;
    }

    requestTargetDate(c.id, proposedDateTime.toISOString(), reason, note.trim());
    setSubmitted(true);
    setTimeout(() => {
      navigateTo('F2_OFFICER_DETAIL');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 text-[#16212E]">
      <Header 
        title={c.trackingNumber} 
        subtitle="Request New Target Date · मुदतवाढ विनंती"
        showBack
        onBack={() => navigateTo('F2_OFFICER_DETAIL')}
      />

      <div className="max-w-md md:max-w-xl mx-auto px-4 pt-4 space-y-4">
        {isPending ? (
          <div className="bg-white p-6 rounded-xl border border-amber-300 shadow-xs text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
            <h3 className="font-bold text-sm text-[#0B3D66]">
              New date requested – awaiting supervisor
            </h3>
            <p className="text-xs text-[#566475]">
              You have already requested a new target date of {new Date(c.extensionRequest!.requestedDate).toLocaleDateString('en-GB')}. Cannot send another request while one is pending decision.
            </p>
            <button
              onClick={() => navigateTo('F2_OFFICER_DETAIL')}
              className="mt-2 px-4 py-2 bg-[#0B3D66] text-white rounded-lg text-xs font-bold"
            >
              Back to Complaint Detail
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-4">
            {/* Target Date Comparison Strip */}
            <div className="grid grid-cols-5 items-stretch bg-[#F4F7FA] rounded-xl p-3 gap-2 border border-[#D6DFE8]">
              {/* Current Target */}
              <div className="col-span-2 bg-white rounded-lg p-2.5 flex flex-col justify-between border border-[#D6DFE8]">
                <span className="text-[11px] text-[#566475] font-semibold">Current target</span>
                <div className="mt-1 font-bold text-sm text-[#0B3D66]">{formattedCurrentTarget}</div>
                <span className="text-[10px] text-amber-700 mt-1">Active deadline</span>
              </div>

              {/* Arrow */}
              <div className="col-span-1 flex flex-col items-center justify-center text-[#E0681A]">
                <ArrowRight className="w-5 h-5" />
                <span className="text-[10px] font-bold">Shift</span>
              </div>

              {/* Proposed Target */}
              <div className="col-span-2 bg-[#0B3D66] text-white rounded-lg p-2.5 flex flex-col justify-between shadow-2xs">
                <span className="text-[11px] text-slate-200 font-semibold">Requested target</span>
                <div className="mt-1 font-bold text-sm text-white">
                  {proposedDate ? new Date(`${proposedDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select'}
                </div>
                <span className="text-[10px] text-amber-300 mt-1">Pending Approval</span>
              </div>
            </div>

            {/* Date Picker */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#16212E] block">
                Select Proposed Completion Date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={proposedDate}
                min={new Date(currentTargetDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                onChange={(e) => setProposedDate(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-[#D6DFE8] text-xs font-bold text-[#0B3D66] focus:border-[#0B3D66] focus:outline-none"
              />
              <p className="text-[11px] text-[#566475]">
                Must be later than current target date ({formattedCurrentTarget}).
              </p>
            </div>

            {/* Reason Dropdown (Strict: Monsoon / Needs tender or work order / Material awaited / Other) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#16212E] block">
                Reason for Extension / मुदतवाढ कारण <span className="text-red-600">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as any)}
                className="w-full h-11 px-3 rounded-lg border border-[#D6DFE8] text-xs font-bold text-[#16212E] focus:border-[#0B3D66] focus:outline-none bg-white"
              >
                <option value="Monsoon">Monsoon / अतिवृष्टी व पावसाळा</option>
                <option value="Needs tender or work order">Needs tender or work order / निविदा आवश्यक</option>
                <option value="Material awaited">Material awaited / साहित्याची प्रतीक्षा</option>
                <option value="Other">Other / इतर प्रशासकीय अडचण</option>
              </select>
            </div>

            {/* Note Field (Required) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#16212E] block">
                Officer Remarks Note / शेरा <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explain justification clearly for supervisor review..."
                className="w-full p-2.5 rounded-lg border border-[#D6DFE8] text-xs text-[#16212E] focus:border-[#0B3D66] focus:outline-none"
              />
            </div>

            {/* Supervisory Notice */}
            <div className="p-3 bg-[#F4F7FA] rounded-lg border border-[#D6DFE8] text-xs space-y-1">
              <span className="font-bold text-[#0B3D66] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Sent to supervisor (DMC) for approval</span>
              </span>
              <p className="text-[11px] text-[#566475]">
                Citizen will see the new date once supervisor approves. If declined, original target date stays.
              </p>
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-[#0B3D66] text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#082d4d] active:scale-98 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>{submitted ? 'Request Sent!' : 'Send request / विनंती पाठवा'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
