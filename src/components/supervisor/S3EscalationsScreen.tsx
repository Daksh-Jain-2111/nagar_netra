import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SupervisorWebShell } from './SupervisorWebShell';
import { EscalationBadge, CountdownPill } from '../common/SharedCivicComponents';
import { MOCK_CATEGORIES } from '../../data/mockData';
import { 
  AlertTriangle, 
  Send, 
  RotateCcw, 
  Clock, 
  MapPin, 
  User, 
  ShieldAlert,
  ArrowRight 
} from 'lucide-react';

export const S3EscalationsScreen: React.FC = () => {
  const { 
    complaints, 
    supervisorInstruct, 
    transferComplaint, 
    simulatedNow 
  } = useApp();

  const [filterReason, setFilterReason] = useState<'ALL' | 'response missed' | 'deadline missed'>('ALL');
  const [activeInstructId, setActiveInstructId] = useState<string | null>(null);
  const [instructionMessage, setInstructionMessage] = useState<string>('Attend today and post an update by 6 PM.');
  const [instructionHours, setInstructionHours] = useState<number>(6);

  const [activeReassignId, setActiveReassignId] = useState<string | null>(null);
  const [reassignDept, setReassignDept] = useState<string>('roads');

  // Filter complaints with L1
  const l1Complaints = complaints.filter(c => c.escalationLevel === 'L1').filter(c => {
    if (filterReason === 'ALL') return true;
    return c.escalationReason === filterReason;
  });

  const handleSendInstruction = (id: string) => {
    if (!instructionMessage.trim()) return;
    const deadline = new Date(simulatedNow.getTime() + instructionHours * 60 * 60 * 1000).toISOString();
    supervisorInstruct(id, instructionMessage.trim(), deadline);
    setActiveInstructId(null);
  };

  const handleReassign = (id: string) => {
    transferComplaint(id, reassignDept, 'Supervisor reallocated department due to escalation SLA review.');
    setActiveReassignId(null);
  };

  return (
    <SupervisorWebShell activeScreen="S3_ESCALATIONS">
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-3">
          <div>
            <h2 className="text-base font-bold text-red-700">
              Escalation Queue (Level 1) · स्तर १ तक्रारी
            </h2>
            <p className="text-xs text-[#566475]">
              Response clock or resolution target breaches flagged directly to DMC supervisor.
            </p>
          </div>
          <span className="px-3 py-1 bg-red-100 text-red-800 font-bold rounded-full border border-red-300">
            {l1Complaints.length} L1 Escalations
          </span>
        </div>

        {/* Filter Chips: All / Response missed / Deadline missed */}
        <div className="flex gap-2">
          {[
            { id: 'ALL', label: 'All Breaches' },
            { id: 'response missed', label: 'Response missed' },
            { id: 'deadline missed', label: 'Deadline missed' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterReason(f.id as any)}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                filterReason === f.id
                  ? 'bg-red-700 text-white border-red-700 shadow-2xs'
                  : 'bg-white text-[#566475] border-[#D6DFE8] hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Escalation Cards List */}
        {l1Complaints.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-[#D6DFE8] text-center space-y-1">
            <p className="font-bold text-[#16212E] text-sm">No active L1 escalations.</p>
            <p className="text-[#566475]">All complaints are progressing within response and resolution clocks.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {l1Complaints.map(c => {
              // Calculate overdue time since escalatedAt or deadline
              const escTime = c.escalatedAt ? new Date(c.escalatedAt) : new Date(c.responseDeadline);
              const overdueMs = Math.max(0, simulatedNow.getTime() - escTime.getTime());
              const overdueHours = Math.round(overdueMs / (1000 * 60 * 60));
              const isOver72h = overdueHours >= 72;

              return (
                <div key={c.id} className="bg-white rounded-xl border border-red-300 p-4 shadow-xs space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#D6DFE8] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#0B3D66]">{c.trackingNumber}</span>
                      <EscalationBadge level="L1" reason={c.escalationReason} />
                      {isOver72h && (
                        <span className="px-2 py-0.5 rounded bg-red-800 text-white font-bold text-[10px] animate-pulse">
                          Visible to admin as overdue (&gt;72h)
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-red-700 font-bold">
                      Overdue by: {overdueHours} hours
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-[#16212E]">{c.description}</h3>
                    <div className="flex flex-wrap gap-2 text-[11px] text-[#566475]">
                      <span><strong>Department:</strong> {c.department}</span>
                      <span>•</span>
                      <span><strong>Location:</strong> {c.landmark || c.address} (Ward {c.wardNumber})</span>
                      <span>•</span>
                      <span><strong>Reporter:</strong> {c.isAnonymous ? 'Anonymous citizen' : c.citizenName}</span>
                    </div>
                  </div>

                  {c.supervisorInstruction && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-950">
                      <strong>Active Instruction:</strong> "{c.supervisorInstruction.message}" (Deadline: {new Date(c.supervisorInstruction.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </div>
                  )}

                  {/* Operational Supervisor Actions */}
                  <div className="pt-2 border-t border-[#D6DFE8] flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setActiveInstructId(activeInstructId === c.id ? null : c.id)}
                      className="px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Instruct Officer</span>
                    </button>

                    <button
                      onClick={() => setActiveReassignId(activeReassignId === c.id ? null : c.id)}
                      className="px-3.5 py-2 bg-white border border-[#D6DFE8] text-[#0B3D66] font-bold rounded-lg hover:bg-slate-50 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reassign Department</span>
                    </button>
                  </div>

                  {/* Instruction Form Modal/Inline */}
                  {activeInstructId === c.id && (
                    <div className="p-3 bg-[#F4F7FA] rounded-lg border border-[#D6DFE8] space-y-2">
                      <label className="font-bold text-[#16212E] block">
                        Supervisory Directive to Field Officer:
                      </label>
                      <textarea
                        rows={2}
                        value={instructionMessage}
                        onChange={(e) => setInstructionMessage(e.target.value)}
                        className="w-full p-2 bg-white rounded border border-[#D6DFE8] text-xs focus:outline-none"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#566475]">Instruction window:</span>
                          <select
                            value={instructionHours}
                            onChange={(e) => setInstructionHours(Number(e.target.value))}
                            className="bg-white p-1 rounded border border-[#D6DFE8] text-xs font-bold"
                          >
                            <option value={4}>4 hours</option>
                            <option value={6}>6 hours (by 6 PM)</option>
                            <option value={12}>12 hours</option>
                            <option value={24}>24 hours</option>
                          </select>
                        </div>
                        <button
                          onClick={() => handleSendInstruction(c.id)}
                          className="px-4 py-1.5 bg-[#0B3D66] text-white font-bold rounded text-xs hover:bg-[#082d4d]"
                        >
                          Send Instruction
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reassign Form Inline */}
                  {activeReassignId === c.id && (
                    <div className="p-3 bg-[#F4F7FA] rounded-lg border border-[#D6DFE8] space-y-2">
                      <label className="font-bold text-[#16212E] block">
                        Reassign to Department (Clocks restart, total age kept):
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={reassignDept}
                          onChange={(e) => setReassignDept(e.target.value)}
                          className="bg-white p-2 rounded border border-[#D6DFE8] text-xs font-bold flex-1"
                        >
                          {MOCK_CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.departmentId}>
                              {cat.department}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleReassign(c.id)}
                          className="px-4 py-2 bg-[#0B3D66] text-white font-bold rounded text-xs hover:bg-[#082d4d]"
                        >
                          Confirm Reassign
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SupervisorWebShell>
  );
};
