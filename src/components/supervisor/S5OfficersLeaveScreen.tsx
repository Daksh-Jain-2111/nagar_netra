import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SupervisorWebShell } from './SupervisorWebShell';
import { MOCK_CATEGORIES } from '../../data/mockData';
import { 
  Users, 
  UserPlus, 
  Calendar, 
  Copy, 
  Check, 
  AlertCircle, 
  ShieldCheck, 
  Clock 
} from 'lucide-react';

export const S5OfficersLeaveScreen: React.FC = () => {
  const { 
    users, 
    complaints, 
    inviteOfficer, 
    toggleOfficerLeave, 
    simulatedNow 
  } = useApp();

  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteContact, setInviteContact] = useState<string>('');
  const [inviteDept, setInviteDept] = useState<string>('Public Works (Roads)');
  const [inviteTitle, setInviteTitle] = useState<string>('Junior Engineer (Roads)');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Leave modal state
  const [activeLeaveOfficerId, setActiveLeaveOfficerId] = useState<string | null>(null);
  const [leaveUntilDate, setLeaveUntilDate] = useState<string>('2026-10-15');
  const [selectedBackupId, setSelectedBackupId] = useState<string>('usr_officer_backup_roads');

  // Filter officers
  const officers = users.filter(u => u.role === 'officer');

  const handleGenerateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteContact.trim()) return;

    const code = inviteOfficer(inviteName.trim(), inviteContact.trim(), inviteDept, inviteTitle);
    setGeneratedCode(code);
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard?.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSaveLeave = (officerId: string) => {
    toggleOfficerLeave(officerId, true, leaveUntilDate, selectedBackupId);
    setActiveLeaveOfficerId(null);
  };

  const handleReturnFromLeave = (officerId: string) => {
    toggleOfficerLeave(officerId, false);
  };

  return (
    <SupervisorWebShell activeScreen="S5_OFFICERS_LEAVE">
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#0B3D66]">
              Officers & Leave Management · अधिकारी व रजा व्यवस्थापन
            </h2>
            <p className="text-xs text-[#566475]">
              Active departmental officers, temporary leave handovers, and generated invite credentials.
            </p>
          </div>

          <button
            onClick={() => {
              setShowInviteModal(true);
              setGeneratedCode(null);
            }}
            className="px-3.5 py-2 bg-[#0B3D66] hover:bg-[#082d4d] text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Officer</span>
          </button>
        </div>

        {/* Officers Table */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F7FA] text-[#566475] border-b border-[#D6DFE8]">
                <tr>
                  <th className="p-3 font-bold">Officer Name</th>
                  <th className="p-3 font-bold">Department</th>
                  <th className="p-3 font-bold">Role Title</th>
                  <th className="p-3 font-bold">Status</th>
                  <th className="p-3 font-bold">Backup Officer</th>
                  <th className="p-3 font-bold">Open Tickets</th>
                  <th className="p-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DFE8]">
                {officers.map((off) => {
                  const openTicketsCount = complaints.filter(
                    c => (c.department === off.department || c.departmentId === off.departmentId) && 
                    c.status !== 'RESOLVED' && c.status !== 'CLOSED' && c.status !== 'REJECTED'
                  ).length;

                  return (
                    <tr key={off.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-[#16212E]">{off.name}</td>
                      <td className="p-3 font-medium text-[#0B3D66]">{off.department}</td>
                      <td className="p-3 text-[#566475]">{off.roleTitle || 'Field Officer'}</td>
                      <td className="p-3">
                        {off.isOnLeave ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-bold text-[10px] border border-amber-300">
                            On Leave (until {off.leaveUntil ? new Date(off.leaveUntil).toLocaleDateString('en-GB') : 'end'})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-medium text-[#16212E]">
                        {off.isOnLeave ? (off.backupOfficerName || 'Backup Assigned') : '—'}
                      </td>
                      <td className="p-3 font-bold">{openTicketsCount}</td>
                      <td className="p-3 text-right">
                        {off.isOnLeave ? (
                          <button
                            onClick={() => handleReturnFromLeave(off.id)}
                            className="px-2.5 py-1 bg-white border border-[#D6DFE8] text-[#0B3D66] font-bold rounded text-[11px] hover:bg-slate-100"
                          >
                            Return to Duty
                          </button>
                        ) : (
                          <button
                            onClick={() => setActiveLeaveOfficerId(off.id)}
                            className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 font-bold rounded text-[11px] hover:bg-amber-100"
                          >
                            Set Leave
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Set Leave Modal / Panel */}
        {activeLeaveOfficerId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-[#D6DFE8] shadow-2xl space-y-3">
              <h3 className="font-bold text-sm text-[#0B3D66]">
                Set Officer Leave & Assign Backup
              </h3>
              <p className="text-xs text-[#566475]">
                New complaints for this department will be routed to the selected backup officer during leave.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#16212E] block">Leave Until Date:</label>
                <input
                  type="date"
                  value={leaveUntilDate}
                  min={simulatedNow.toISOString().split('T')[0]}
                  onChange={(e) => setLeaveUntilDate(e.target.value)}
                  className="w-full p-2 border border-[#D6DFE8] rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#16212E] block">Choose Backup Officer:</label>
                <select
                  value={selectedBackupId}
                  onChange={(e) => setSelectedBackupId(e.target.value)}
                  className="w-full p-2 border border-[#D6DFE8] rounded-lg text-xs font-bold text-[#0B3D66] bg-white"
                >
                  {officers.filter(u => u.id !== activeLeaveOfficerId).map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.roleTitle || o.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleSaveLeave(activeLeaveOfficerId)}
                  className="flex-1 py-2 bg-[#0B3D66] text-white font-bold rounded-lg text-xs"
                >
                  Confirm Leave
                </button>
                <button
                  onClick={() => setActiveLeaveOfficerId(null)}
                  className="py-2 px-3 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invite Officer Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-[#D6DFE8] shadow-2xl space-y-3">
              <h3 className="font-bold text-sm text-[#0B3D66]">
                Generate Officer Invite Code
              </h3>

              {!generatedCode ? (
                <form onSubmit={handleGenerateInvite} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#16212E] block">Officer Full Name</label>
                    <input
                      type="text"
                      required
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="e.g. Santosh Ghadge"
                      className="w-full p-2 border border-[#D6DFE8] rounded-lg text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#16212E] block">Official Email or Mobile</label>
                    <input
                      type="text"
                      required
                      value={inviteContact}
                      onChange={(e) => setInviteContact(e.target.value)}
                      placeholder="e.g. santosh@smkmc.demo"
                      className="w-full p-2 border border-[#D6DFE8] rounded-lg text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#16212E] block">Department</label>
                    <select
                      value={inviteDept}
                      onChange={(e) => setInviteDept(e.target.value)}
                      className="w-full p-2 border border-[#D6DFE8] rounded-lg text-xs font-bold text-[#0B3D66] bg-white"
                    >
                      {MOCK_CATEGORIES.map(c => (
                        <option key={c.id} value={c.department}>{c.department}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#16212E] block">Role Title</label>
                    <input
                      type="text"
                      value={inviteTitle}
                      onChange={(e) => setInviteTitle(e.target.value)}
                      placeholder="e.g. Junior Engineer (Roads)"
                      className="w-full p-2 border border-[#D6DFE8] rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-[#0B3D66] text-white font-bold rounded-lg text-xs"
                    >
                      Generate Invite Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="py-2 px-3 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center space-y-3 py-2">
                  <span className="text-xs text-[#566475]">Share this code with the officer for activation:</span>
                  <div className="p-3 bg-[#F4F7FA] rounded-xl border border-[#D6DFE8] font-mono text-base font-bold text-[#0B3D66] tracking-widest flex items-center justify-center gap-2">
                    <span>{generatedCode}</span>
                    <button onClick={handleCopyCode} className="p-1 text-[#566475] hover:text-[#0B3D66]">
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#566475]">
                    Officer enters this code on M3 login invite screen.
                  </p>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="w-full py-2 bg-[#0B3D66] text-white font-bold rounded-lg text-xs"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SupervisorWebShell>
  );
};
