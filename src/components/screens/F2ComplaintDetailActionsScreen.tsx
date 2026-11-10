import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { StatusChip, EscalationBadge, CountdownPill, PhotoBadge } from '../common/SharedCivicComponents';
import { TicketVoiceNote, TicketIssueImages, TicketAIAnalysis } from '../common/TicketEvidencePanel';
import { 
  ArrowLeft, 
  MapPin, 
  Navigation, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Send, 
  RotateCcw, 
  ExternalLink, 
  Check, 
  Copy, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

export const F2ComplaintDetailActionsScreen: React.FC = () => {
  const { 
    language, 
    selectedComplaint, 
    navigateTo, 
    simulatedNow, 
    acceptComplaint, 
    verifyDangerFlag, 
    complaints,
    categories
  } = useApp();

  const [copied, setCopied] = useState<boolean>(false);

  if (!selectedComplaint) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] p-8 text-center text-xs">
        <p>No complaint selected.</p>
        <button onClick={() => navigateTo('F1_WORK_QUEUE')} className="mt-3 px-4 py-2 bg-[#0B3D66] text-white rounded">
          Back to Queue
        </button>
      </div>
    );
  }

  const c = selectedComplaint;

  // Actions valid check based on status:
  const canAccept = c.status === 'ASSIGNED';
  const canPostUpdate = c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS' || c.status === 'WORK_SCHEDULED' || c.status === 'REOPENED';
  const canRequestNewDate = c.status === 'IN_PROGRESS' || c.status === 'WORK_SCHEDULED' || c.status === 'ASSIGNED';
  const canTransfer = c.status !== 'RESOLVED' && c.status !== 'CLOSED' && c.status !== 'REJECTED';
  const canCheckDuplicates = c.status !== 'CLOSED' && c.status !== 'REJECTED';
  const canResolve = c.status === 'IN_PROGRESS' || c.status === 'WORK_SCHEDULED' || c.status === 'REOPENED' || c.status === 'ASSIGNED';
  const canRequestRejection = c.status !== 'RESOLVED' && c.status !== 'CLOSED' && c.status !== 'REJECTED';

  // Count possible duplicates in same department/category
  const duplicateCandidatesCount = complaints.filter(
    other => other.id !== c.id && other.categoryId === c.categoryId && other.status !== 'CLOSED' && other.status !== 'REJECTED'
  ).length;

  const handleCopy = () => {
    navigator.clipboard?.writeText(c.trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNavigateMap = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 text-[#16212E]">
      <Header 
        title={c.trackingNumber} 
        subtitle={`Field Officer · ${c.department}`}
        showBack
        onBack={() => navigateTo('F1_WORK_QUEUE')} 
      />

      <div className="max-w-md md:max-w-xl mx-auto px-4 pt-3 pb-6 space-y-3.5">
        {/* Top Header Card */}
        <section className="bg-white p-3.5 rounded-xl border border-[#D6DFE8] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#0B3D66]">
              <span>{c.trackingNumber}</span>
              <button onClick={handleCopy} className="p-0.5 text-[#566475] hover:text-[#0B3D66]">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <StatusChip status={c.status} scheduledDate={c.scheduledTargetDate} />
          </div>

          <h2 className="text-sm font-bold text-[#16212E] leading-snug">
            {c.description}
          </h2>

          <div className="flex items-center gap-2 text-xs text-[#566475] flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#E0681A]" />
              {c.landmark || c.address} (Ward {c.wardNumber})
            </span>
            <span>•</span>
            <span className="font-semibold text-emerald-800">
              AI Confidence: {c.aiConfidence || 94}%
            </span>
            <span>•</span>
            <span>Route: {c.routeChannel}</span>
          </div>

          {/* Reporter information (Rule: Anonymous complaints show 'Anonymous citizen') */}
          <div className="p-2 rounded bg-[#F4F7FA] border border-[#D6DFE8] flex items-center justify-between text-xs">
            <span className="text-[#566475]">Reporter:</span>
            <span className="font-bold text-[#16212E]">
              {c.isAnonymous ? 'Anonymous citizen' : c.citizenName}
            </span>
          </div>

          {/* Escalation Badge */}
          {c.escalationLevel && (
            <div>
              <EscalationBadge level={c.escalationLevel} reason={c.escalationReason} />
            </div>
          )}
        </section>

        {/* Citizen evidence: voice note + transcript, issue photos, image-AI analysis */}
        {c.voiceNote && <TicketVoiceNote language={language} voiceNote={c.voiceNote} />}
        <TicketIssueImages language={language} photoUrls={c.photoUrls} />
        <TicketAIAnalysis language={language} complaint={c} category={categories.find(cat => cat.id === c.categoryId)} />

        {/* Supervisor Instruction Card (Red Callout) */}
        {c.supervisorInstruction && (
          <section className="relative overflow-hidden rounded-xl bg-red-50 border border-red-300 p-3.5 text-red-950 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-xs text-red-800 uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-red-700" />
              <span>Supervisor Instruction ({c.supervisorInstruction.supervisorName})</span>
            </div>
            <p className="text-xs font-semibold text-red-900 leading-snug">
              "{c.supervisorInstruction.message}"
            </p>
            <p className="text-[11px] text-red-800">
              Deadline: {new Date(c.supervisorInstruction.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </section>
        )}

        {/* Danger Flag Verification (if marked danger to life) */}
        {c.isDangerToLife && (
          <section className="bg-amber-50 border border-amber-300 p-3 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Citizen marked danger to life / सुरक्षेस धोका</span>
            </div>
            <p className="text-xs text-amber-900">
              Status: {c.dangerVerified ? 'Confirmed Dangerous (Urgent Priority)' : 'Verification Required'}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => verifyDangerFlag(c.id, true)}
                className="py-1.5 px-2 bg-red-700 text-white rounded-lg text-xs font-bold hover:bg-red-800"
              >
                Confirm Danger (Stays Urgent)
              </button>
              <button
                onClick={() => verifyDangerFlag(c.id, false)}
                className="py-1.5 px-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50"
              >
                Not Dangerous (Normal)
              </button>
            </div>
          </section>
        )}

        {/* Two Clock countdown pills */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 bg-white rounded-xl border border-[#D6DFE8] flex flex-col justify-between">
            <span className="text-[10px] text-[#566475] font-bold uppercase tracking-wide">Response Clock</span>
            <div className="mt-1">
              <CountdownPill 
                deadline={c.responseDeadline} 
                label="Response" 
                isMet={c.responseMet} 
                currentSimulatedNow={simulatedNow} 
              />
            </div>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-[#D6DFE8] flex flex-col justify-between">
            <span className="text-[10px] text-[#566475] font-bold uppercase tracking-wide">Resolution Deadline</span>
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

        {/* External Map Navigation Button */}
        <section className="bg-white p-3.5 rounded-xl border border-[#D6DFE8] flex items-center justify-between gap-2 shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#0B3D66] block">Location Spot GPS</span>
            <span className="text-[11px] text-[#566475] font-mono">
              {c.latitude.toFixed(4)}° N, {c.longitude.toFixed(4)}° E
            </span>
          </div>
          <button
            onClick={handleNavigateMap}
            className="px-3 py-2 bg-[#E0681A] hover:bg-[#c95914] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Navigate to Spot</span>
          </button>
        </section>

        {/* ACTION BUTTONS GRID - Strict status enforcement */}
        <section className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-[#0B3D66] border-b border-[#D6DFE8] pb-1.5">
            Field Officer Actions
          </h3>

          {/* Priority Action: Resolve with Photo (F7) */}
          <button
            disabled={!canResolve}
            onClick={() => navigateTo('F7_RESOLVE')}
            className={`w-full h-12 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all ${
              canResolve 
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-98' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Resolve with Photo (F7) {canResolve ? '' : '(Must be In Progress)'}</span>
          </button>

          {/* Accept button (only ASSIGNED -> IN_PROGRESS) */}
          {canAccept && (
            <button
              onClick={() => acceptComplaint(c.id)}
              className="w-full h-11 rounded-xl bg-[#0B3D66] hover:bg-[#082d4d] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>Accept Complaint (Meets Response Clock)</span>
            </button>
          )}

          {/* Other action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={!canPostUpdate}
              onClick={() => navigateTo('F3_POST_UPDATE')}
              className="h-10 px-2 rounded-lg bg-[#F4F7FA] border border-[#D6DFE8] text-[#0B3D66] font-bold text-xs flex items-center justify-center gap-1 hover:bg-slate-100 disabled:opacity-50"
            >
              <span>Post Update (F3)</span>
            </button>

            <button
              disabled={!canRequestNewDate}
              onClick={() => navigateTo('F4_REQUEST_DATE')}
              className="h-10 px-2 rounded-lg bg-[#F4F7FA] border border-[#D6DFE8] text-[#0B3D66] font-bold text-xs flex items-center justify-center gap-1 hover:bg-slate-100 disabled:opacity-50"
            >
              <span>Request New Date (F4)</span>
            </button>

            <button
              disabled={!canTransfer}
              onClick={() => navigateTo('F5_TRANSFER')}
              className="h-10 px-2 rounded-lg bg-[#F4F7FA] border border-[#D6DFE8] text-[#0B3D66] font-bold text-xs flex items-center justify-center gap-1 hover:bg-slate-100 disabled:opacity-50"
            >
              <span>Transfer (F5)</span>
            </button>

            <button
              disabled={!canCheckDuplicates}
              onClick={() => navigateTo('F6_DUPLICATES')}
              className="h-10 px-2 rounded-lg bg-[#F4F7FA] border border-[#D6DFE8] text-[#0B3D66] font-bold text-xs flex items-center justify-center gap-1 hover:bg-slate-100 disabled:opacity-50"
            >
              <span>Duplicates ({duplicateCandidatesCount})</span>
            </button>
          </div>

          <button
            disabled={!canRequestRejection}
            onClick={() => navigateTo('F8_REJECT')}
            className="w-full h-10 rounded-lg bg-red-50 text-red-700 border border-red-200 font-bold text-xs flex items-center justify-center gap-1 hover:bg-red-100 disabled:opacity-50"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Request Rejection (F8)</span>
          </button>
        </section>

        {/* History Timeline */}
        <section className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-3">
          <h3 className="font-bold text-xs text-[#0B3D66] border-b border-[#D6DFE8] pb-1.5">
            Audit Trail & History Timeline
          </h3>

          <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#D6DFE8]">
            {c.timeline.map((step) => (
              <div key={step.id} className="relative text-xs">
                <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-[#0B3D66] border-2 border-white" />
                <div className="flex items-baseline justify-between gap-1">
                  <h4 className="font-bold text-[#16212E]">{step.titleEn}</h4>
                  <span className="text-[10px] text-[#566475] font-mono">{step.timestamp}</span>
                </div>
                <p className="text-[11px] text-[#566475]">{step.actorRole}</p>
                {step.comment && (
                  <p className="mt-1 p-2 bg-[#F4F7FA] rounded border border-[#D6DFE8] text-[11px] text-[#16212E]">
                    {step.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
