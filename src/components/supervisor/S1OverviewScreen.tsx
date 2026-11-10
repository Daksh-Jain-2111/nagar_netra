import React from 'react';
import { useApp } from '../../context/AppContext';
import { SupervisorWebShell } from './SupervisorWebShell';
import { StatusChip, EscalationBadge, PhotoBadge } from '../common/SharedCivicComponents';
import { 
  HelpCircle, 
  AlertTriangle, 
  CheckSquare, 
  Users, 
  Clock, 
  TrendingUp, 
  MapPin, 
  ArrowRight, 
  Check, 
  X,
  Building 
} from 'lucide-react';

export const S1OverviewScreen: React.FC = () => {
  const { 
    complaints, 
    officerJoinRequests, 
    users, 
    navigateTo, 
    selectComplaint, 
    flaggedPhotoDecision 
  } = useApp();

  // Supervisor mapped departments: Public Works (Roads), Water Works, Drainage
  const supervisedDepts = ['Public Works (Roads)', 'Water Works', 'Drainage Department'];
  const supComplaints = complaints.filter(c => supervisedDepts.includes(c.department) || supervisedDepts.includes(c.departmentId));

  // Computed KPIs
  const toCheckCount = complaints.filter(c => c.status === 'TO_CHECK').length;
  const escalatedL1Count = complaints.filter(c => c.escalationLevel === 'L1').length;
  const pendingApprovalsCount = 
    complaints.filter(c => c.extensionRequest?.status === 'PENDING').length +
    complaints.filter(c => c.rejectionRequest?.status === 'PENDING').length +
    complaints.filter(c => c.transferRequest?.status === 'PENDING_SUPERVISOR').length +
    officerJoinRequests.filter(r => r.status === 'PENDING').length;

  const officersOnLeaveCount = users.filter(u => u.role === 'officer' && u.isOnLeave).length;

  // Resolved count & on-time %
  const resolvedList = complaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED');
  const onTimeResolvedCount = resolvedList.filter(c => c.escalationLevel === null).length;
  const onTimePercentage = resolvedList.length > 0 ? Math.round((onTimeResolvedCount / resolvedList.length) * 100) : 92;

  // Flagged after-photos
  const flaggedPhotoComplaints = complaints.filter(c => c.resolvedPhotoBadge === 'FLAGGED');

  return (
    <SupervisorWebShell activeScreen="S1_SUPERVISOR_OVERVIEW">
      <div className="space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div 
            onClick={() => navigateTo('S2_TO_CHECK')}
            className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-2xs hover:border-amber-500 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-amber-700">
              <span className="text-[11px] font-bold uppercase tracking-wider">To check</span>
              <HelpCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-[#16212E] mt-1">{toCheckCount}</div>
            <span className="text-[10px] text-[#566475]">Department triage</span>
          </div>

          <div 
            onClick={() => navigateTo('S3_ESCALATIONS')}
            className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-2xs hover:border-red-500 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-red-600">
              <span className="text-[11px] font-bold uppercase tracking-wider">Escalated (L1)</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-red-600 mt-1">{escalatedL1Count}</div>
            <span className="text-[10px] text-[#566475]">Response/Deadline breach</span>
          </div>

          <div 
            onClick={() => navigateTo('S4_APPROVALS')}
            className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-2xs hover:border-purple-500 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-purple-700">
              <span className="text-[11px] font-bold uppercase tracking-wider">Approvals</span>
              <CheckSquare className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-[#16212E] mt-1">{pendingApprovalsCount}</div>
            <span className="text-[10px] text-[#566475]">Pending decisions</span>
          </div>

          <div 
            onClick={() => navigateTo('S5_OFFICERS_LEAVE')}
            className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-2xs hover:border-amber-500 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-amber-600">
              <span className="text-[11px] font-bold uppercase tracking-wider">On Leave</span>
              <Users className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-[#16212E] mt-1">{officersOnLeaveCount}</div>
            <span className="text-[10px] text-[#566475]">Active backup covered</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-2xs">
            <div className="flex items-center justify-between text-[#0B3D66]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Avg Response</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-[#16212E] mt-1">14.2 h</div>
            <span className="text-[10px] text-emerald-700 font-semibold">Under 48h clock</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-2xs">
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-[11px] font-bold uppercase tracking-wider">On-Time Fix</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-[#16212E] mt-1">{onTimePercentage}%</div>
            <span className="text-[10px] text-[#566475]">Compliance rate</span>
          </div>
        </div>

        {/* NEEDS YOUR ACTION LIST */}
        <section className="bg-white rounded-xl border border-[#D6DFE8] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#0B3D66]">Needs Your Action · तातडीच्या कृती</h2>
              <p className="text-xs text-[#566475]">Grievances requiring supervisor intervention or sign-off</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* 1. Flagged after-photos */}
            {flaggedPhotoComplaints.map(c => (
              <div key={c.id} className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-amber-300 bg-black shrink-0">
                    <img src={c.resolvedPhotoUrl || c.photoUrls[0]} alt="Flagged" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#0B3D66]">{c.trackingNumber}</span>
                      <PhotoBadge status="FLAGGED" distanceMeters={c.resolvedPhotoDistanceMeters} />
                    </div>
                    <p className="font-bold text-[#16212E] mt-0.5">{c.description}</p>
                    <p className="text-[11px] text-amber-900">
                      Officer photo captured {c.resolvedPhotoDistanceMeters || 245}m away from pin (&gt;200m). Review resolution proof.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    onClick={() => flaggedPhotoDecision(c.id, true)}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept Resolution</span>
                  </button>
                  <button
                    onClick={() => flaggedPhotoDecision(c.id, false)}
                    className="px-3 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-50 font-bold rounded-lg flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Send Back (In Progress)</span>
                  </button>
                </div>
              </div>
            ))}

            {/* 2. Escalated L1 complaints */}
            {complaints.filter(c => c.escalationLevel === 'L1').map(c => (
              <div key={c.id} className="p-3.5 rounded-xl border border-red-300 bg-red-50/60 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#0B3D66]">{c.trackingNumber}</span>
                    <EscalationBadge level="L1" reason={c.escalationReason} />
                  </div>
                  <p className="font-bold text-[#16212E] mt-0.5">{c.description}</p>
                  <p className="text-[11px] text-red-900">{c.department} · {c.wardName}</p>
                </div>

                <button
                  onClick={() => {
                    selectComplaint(c.id, 'S3_ESCALATIONS');
                  }}
                  className="px-3 py-1.5 bg-red-700 text-white font-bold rounded-lg hover:bg-red-800 flex items-center gap-1"
                >
                  <span>Instruct Officer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* 3. Pending Extension Requests */}
            {complaints.filter(c => c.extensionRequest?.status === 'PENDING').map(c => (
              <div key={c.id} className="p-3.5 rounded-xl border border-purple-300 bg-purple-50/60 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-mono font-bold text-[#0B3D66]">{c.trackingNumber}</span>
                  <p className="font-bold text-[#16212E]">
                    Extension Request: {new Date(c.extensionRequest!.requestedDate).toLocaleDateString('en-GB')}
                  </p>
                  <p className="text-[11px] text-purple-900">
                    Reason: {c.extensionRequest!.reason} - "{c.extensionRequest!.note}"
                  </p>
                </div>

                <button
                  onClick={() => navigateTo('S4_APPROVALS')}
                  className="px-3 py-1.5 bg-purple-700 text-white font-bold rounded-lg hover:bg-purple-800"
                >
                  Decide in Approvals
                </button>
              </div>
            ))}

            {toCheckCount > 0 && (
              <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/60 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-amber-950">{toCheckCount} complaints in "To check" queue</span>
                  <p className="text-[11px] text-amber-900">Require supervisor department verification before assignment.</p>
                </div>
                <button
                  onClick={() => navigateTo('S2_TO_CHECK')}
                  className="px-3 py-1.5 bg-amber-700 text-white font-bold rounded-lg hover:bg-amber-800"
                >
                  Review Queue
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Department Table with Field Officer Status */}
        <section className="bg-white rounded-xl border border-[#D6DFE8] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-3">
            <h3 className="text-sm font-bold text-[#0B3D66]">Supervised Departments & Active Officers</h3>
            <span className="text-xs text-[#566475]">DMC 1 Roster</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F7FA] text-[#566475] border-b border-[#D6DFE8]">
                <tr>
                  <th className="p-2.5 font-bold">Department</th>
                  <th className="p-2.5 font-bold">Field Officer</th>
                  <th className="p-2.5 font-bold">Status</th>
                  <th className="p-2.5 font-bold">Open Tickets</th>
                  <th className="p-2.5 font-bold">L1 Breaches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DFE8]">
                {supervisedDepts.map((deptName) => {
                  const officer = users.find(u => u.role === 'officer' && u.department === deptName);
                  const openTickets = complaints.filter(c => c.department === deptName && c.status !== 'RESOLVED' && c.status !== 'CLOSED').length;
                  const l1Breaches = complaints.filter(c => c.department === deptName && c.escalationLevel === 'L1').length;

                  return (
                    <tr key={deptName} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-[#0B3D66]">{deptName}</td>
                      <td className="p-2.5 font-medium">
                        {officer ? (
                          officer.isOnLeave ? (
                            <span>{officer.name} <span className="text-amber-700 font-bold">(Backup: {officer.backupOfficerName || 'Assigned'})</span></span>
                          ) : (
                            <span>{officer.name}</span>
                          )
                        ) : 'Pending Roster'}
                      </td>
                      <td className="p-2.5">
                        {officer?.isOnLeave ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-bold text-[10px]">
                            On leave (until {officer.leaveUntil ? new Date(officer.leaveUntil).toLocaleDateString('en-GB') : 'end'})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-bold">{openTickets}</td>
                      <td className="p-2.5 font-bold text-red-600">{l1Breaches}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SupervisorWebShell>
  );
};
