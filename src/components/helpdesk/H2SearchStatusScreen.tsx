import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusChip, EscalationBadge, CountdownPill } from '../common/SharedCivicComponents';
import { Complaint } from '../../types';
import { 
  Search, 
  Phone, 
  Clock, 
  MapPin, 
  MessageSquarePlus, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Calendar,
  User,
  ShieldCheck
} from 'lucide-react';

export const H2SearchStatusScreen: React.FC = () => {
  const { 
    complaints, 
    helpdeskAddNote, 
    helpdeskReopenComplaint, 
    selectComplaint,
    simulatedNow 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchedComplaint, setSearchedComplaint] = useState<Complaint | null>(null);
  const [searchAttempted, setSearchAttempted] = useState<boolean>(false);
  
  // Follow-up note form
  const [followupNote, setFollowupNote] = useState<string>('');
  const [showNoteModal, setShowNoteModal] = useState<boolean>(false);

  // Reopen form
  const [reopenReason, setReopenReason] = useState<string>('');
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    setSearchAttempted(true);
    const found = complaints.find(c => 
      c.trackingNumber.toLowerCase() === query ||
      c.id.toLowerCase() === query ||
      (c.citizenMobile && c.citizenMobile.includes(query))
    );

    setSearchedComplaint(found || null);
  };

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchedComplaint || !followupNote.trim()) return;

    helpdeskAddNote(searchedComplaint.id, followupNote.trim());
    setActionNotice('Citizen inquiry note added to complaint timeline.');
    setFollowupNote('');
    setShowNoteModal(false);
    // Refresh searched complaint
    const updated = complaints.find(c => c.id === searchedComplaint.id);
    if (updated) setSearchedComplaint(updated);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleReopenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchedComplaint || !reopenReason.trim()) return;

    const res = helpdeskReopenComplaint(searchedComplaint.id, reopenReason.trim());
    if (res.success) {
      setActionNotice('Complaint successfully reopened based on citizen telephonic request.');
      setShowReopenModal(false);
      setReopenReason('');
      const updated = complaints.find(c => c.id === searchedComplaint.id);
      if (updated) setSearchedComplaint(updated);
    } else {
      alert(res.error || 'Cannot reopen complaint');
    }
    setTimeout(() => setActionNotice(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            Citizen Grievance Status Desk
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Real-time status lookup by tracking number or caller mobile number
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-white border border-[#D6DFE8] px-2.5 py-1 rounded-lg text-[#566475]">
            Helpline: <strong className="text-[#0B3D66] font-mono">0233-2373455</strong>
          </span>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="p-5 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Tracking ID (e.g. NN-2026-000101) or 10-digit mobile number..."
              className="w-full pl-9 pr-3 py-2.5 text-xs border border-[#D6DFE8] rounded-xl focus:ring-2 focus:ring-[#0B3D66] focus:outline-hidden font-medium"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-[#0B3D66] hover:bg-[#093254] text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            Search Status
          </button>
        </form>

        <div className="flex flex-wrap gap-2 mt-3 text-[11px] text-[#566475]">
          <span>Quick Samples:</span>
          {complaints.slice(0, 3).map(c => (
            <button
              key={c.id}
              onClick={() => {
                setSearchQuery(c.trackingNumber);
                setSearchedComplaint(c);
                setSearchAttempted(true);
              }}
              className="font-mono text-[#0B3D66] hover:underline bg-slate-50 px-2 py-0.5 rounded border border-[#D6DFE8]"
            >
              {c.trackingNumber}
            </button>
          ))}
        </div>
      </div>

      {/* Search Results Display */}
      {searchedComplaint ? (
        <div className="bg-white rounded-2xl border border-[#D6DFE8] shadow-md overflow-hidden space-y-4">
          {/* Top Status Header */}
          <div className="p-5 bg-slate-50 border-b border-[#D6DFE8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-lg text-[#0B3D66]">
                  {searchedComplaint.trackingNumber}
                </span>
                <StatusChip status={searchedComplaint.status} />
                {searchedComplaint.escalationLevel && (
                  <EscalationBadge 
                    level={searchedComplaint.escalationLevel} 
                    reason={searchedComplaint.escalationReason} 
                  />
                )}
              </div>
              <p className="text-xs text-[#566475] mt-1">
                Filed on: {new Date(searchedComplaint.createdAt).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })} via {searchedComplaint.routeChannel}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNoteModal(true)}
                className="px-3 py-1.5 bg-white border border-[#D6DFE8] text-[#0B3D66] rounded-lg text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 shadow-xs"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>Add Citizen Inquiry Note</span>
              </button>

              {(searchedComplaint.status === 'RESOLVED' || searchedComplaint.status === 'CLOSED') && (
                <button
                  onClick={() => setShowReopenModal(true)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reopen Grievance</span>
                </button>
              )}
            </div>
          </div>

          {/* Details Body */}
          <div className="p-5 space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-[#F4F7FA] rounded-xl border border-[#D6DFE8]">
                <span className="text-[10px] font-bold text-[#566475] uppercase block">
                  Category & Department
                </span>
                <strong className="text-[#16212E] mt-0.5 block font-bold">
                  {searchedComplaint.categoryNameEn}
                </strong>
                <span className="text-[11px] text-[#566475]">{searchedComplaint.department}</span>
              </div>

              <div className="p-3 bg-[#F4F7FA] rounded-xl border border-[#D6DFE8]">
                <span className="text-[10px] font-bold text-[#566475] uppercase block">
                  Location & Ward
                </span>
                <strong className="text-[#16212E] mt-0.5 block font-bold">
                  Ward {searchedComplaint.wardNumber}
                </strong>
                <span className="text-[11px] text-[#566475] truncate block">
                  {searchedComplaint.landmark || searchedComplaint.address}
                </span>
              </div>

              <div className="p-3 bg-[#F4F7FA] rounded-xl border border-[#D6DFE8]">
                <span className="text-[10px] font-bold text-[#566475] uppercase block">
                  Statutory Clocks
                </span>
                <div className="mt-0.5">
                  <CountdownPill 
                    deadline={searchedComplaint.resolutionDeadline} 
                    isCompleted={searchedComplaint.status === 'RESOLVED' || searchedComplaint.status === 'CLOSED'} 
                  />
                </div>
                <span className="text-[10px] text-[#566475] block mt-1">
                  First action: {searchedComplaint.responseMet ? 'Acknowledged' : 'Pending'}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="p-3 bg-white rounded-xl border border-[#D6DFE8]">
              <span className="text-[10px] font-bold text-[#566475] uppercase block">
                Citizen Issue Description
              </span>
              <p className="text-[#16212E] mt-1 leading-relaxed">
                {searchedComplaint.description}
              </p>
            </div>

            {/* Timeline History */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#16212E]">
                Recent Timeline Activity
              </h4>
              <div className="divide-y divide-[#D6DFE8] border border-[#D6DFE8] rounded-xl overflow-hidden bg-white">
                {searchedComplaint.timeline.map((step) => (
                  <div key={step.id} className="p-3 text-xs flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#0B3D66] mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <strong className="text-[#16212E]">{step.titleEn}</strong>
                        <span className="text-[10px] text-[#566475] font-mono">{step.timestamp}</span>
                      </div>
                      <div className="text-[11px] text-[#566475] mt-0.5">
                        By {step.actorName} ({step.actorRole})
                      </div>
                      {step.comment && (
                        <p className="text-[#16212E] mt-1 text-[11px] bg-slate-50 p-2 rounded">
                          &ldquo;{step.comment}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : searchAttempted ? (
        <div className="p-8 bg-white rounded-xl border border-[#D6DFE8] text-center text-xs text-[#566475] space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <h4 className="font-bold text-sm text-[#16212E]">No Grievance Record Found</h4>
          <p>
            No complaint matched &ldquo;{searchQuery}&rdquo;. Please verify tracking ID or mobile number.
          </p>
        </div>
      ) : null}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#D6DFE8] space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#D6DFE8] pb-2">
              <h3 className="font-bold text-sm text-[#16212E]">Add Citizen Call Inquiry Note</h3>
              <button onClick={() => setShowNoteModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleAddNoteSubmit} className="space-y-3">
              <div>
                <label className="block font-bold text-[#16212E] mb-1">Inquiry / Citizen Remarks</label>
                <textarea
                  rows={3}
                  required
                  value={followupNote}
                  onChange={(e) => setFollowupNote(e.target.value)}
                  placeholder="e.g. Citizen phoned inquiring about road asphalt patch progress; informed of 48h work schedule..."
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg focus:ring-2 focus:ring-[#0B3D66] focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-3 py-1.5 border border-[#D6DFE8] rounded-lg text-[#566475]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0B3D66] text-white rounded-lg font-bold"
                >
                  Save Note to Timeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#D6DFE8] space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#D6DFE8] pb-2">
              <h3 className="font-bold text-sm text-red-700 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                <span>Reopen Grievance</span>
              </h3>
              <button onClick={() => setShowReopenModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleReopenSubmit} className="space-y-3">
              <p className="text-[#566475]">
                Citizen reports the issue is unresolved or of substandard quality. This will reset status to <strong>REOPENED</strong> and notify the supervisor.
              </p>

              <div>
                <label className="block font-bold text-[#16212E] mb-1">Citizen's Reason for Reopen</label>
                <textarea
                  rows={3}
                  required
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Record citizen's explanation (e.g. garbage only partially cleared, pothole caved in again)..."
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg focus:ring-2 focus:ring-[#0B3D66] focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-3 py-1.5 border border-[#D6DFE8] rounded-lg text-[#566475]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700"
                >
                  Confirm Reopen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
