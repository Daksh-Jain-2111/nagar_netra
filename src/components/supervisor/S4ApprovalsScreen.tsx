import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SupervisorWebShell } from './SupervisorWebShell';
import { MOCK_CATEGORIES } from '../../data/mockData';
import { 
  Calendar, 
  AlertTriangle, 
  MoveRight, 
  UserPlus, 
  Check, 
  X, 
  CheckCircle, 
  Clock 
} from 'lucide-react';

export const S4ApprovalsScreen: React.FC = () => {
  const { 
    complaints, 
    officerJoinRequests, 
    approveTargetDate, 
    declineTargetDate, 
    approveRejection, 
    declineRejection, 
    approveTransfer, 
    declineTransfer, 
    approveOfficerJoin, 
    declineOfficerJoin 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'EXTENSIONS' | 'REJECTIONS' | 'TRANSFERS' | 'JOINS'>('EXTENSIONS');
  const [commentInput, setCommentInput] = useState<{ [key: string]: string }>({});

  const pendingExtensions = complaints.filter(c => c.extensionRequest?.status === 'PENDING');
  const pendingRejections = complaints.filter(c => c.rejectionRequest?.status === 'PENDING');
  const pendingTransfers = complaints.filter(c => c.transferRequest?.status === 'PENDING_SUPERVISOR');
  const pendingJoins = officerJoinRequests.filter(r => r.status === 'PENDING');

  const handleCommentChange = (id: string, text: string) => {
    setCommentInput(prev => ({ ...prev, [id]: text }));
  };

  return (
    <SupervisorWebShell activeScreen="S4_APPROVALS">
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-3">
          <div>
            <h2 className="text-base font-bold text-purple-900">
              Administrative Approvals · मंजुरी कक्ष
            </h2>
            <p className="text-xs text-[#566475]">
              Decisions on target date extensions, complaint rejections, second transfers, and officer joins.
            </p>
          </div>
        </div>

        {/* 4 Tabs: Extensions, Rejections, Second transfers, Officer joins */}
        <div className="flex gap-2 overflow-x-auto border-b border-[#D6DFE8] pb-2">
          {[
            { id: 'EXTENSIONS', label: 'Extensions', count: pendingExtensions.length },
            { id: 'REJECTIONS', label: 'Rejections', count: pendingRejections.length },
            { id: 'TRANSFERS', label: 'Second transfers', count: pendingTransfers.length },
            { id: 'JOINS', label: 'Officer joins', count: pendingJoins.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'bg-white text-[#16212E] border border-[#D6DFE8] hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-900'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* TAB 1: EXTENSIONS */}
        {activeTab === 'EXTENSIONS' && (
          <div className="space-y-3">
            {pendingExtensions.length === 0 ? (
              <div className="p-8 bg-white rounded-xl border border-[#D6DFE8] text-center text-[#566475]">
                No pending target date extensions.
              </div>
            ) : (
              pendingExtensions.map(c => {
                const ext = c.extensionRequest!;
                return (
                  <div key={c.id} className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-2">
                      <span className="font-mono font-bold text-sm text-[#0B3D66]">{c.trackingNumber}</span>
                      <span className="font-bold text-purple-900">
                        Proposed: {new Date(ext.requestedDate).toLocaleDateString('en-GB')}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-bold text-[#16212E]">{c.description}</h4>
                      <p className="text-[11px] text-[#566475]">Department: {c.department}</p>
                      <div className="p-2.5 bg-[#F4F7FA] rounded-lg border border-[#D6DFE8] space-y-1">
                        <span className="font-bold text-[#0B3D66]">Reason: {ext.reason}</span>
                        <p className="text-[11px] text-[#16212E]">"{ext.note}"</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => approveTargetDate(c.id, commentInput[c.id])}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg flex items-center gap-1 shadow-xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve Extension</span>
                      </button>
                      <button
                        onClick={() => declineTargetDate(c.id, commentInput[c.id])}
                        className="px-4 py-2 bg-white border border-red-300 text-red-700 hover:bg-red-50 font-bold rounded-lg flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        <span>Decline (Original Target Stays)</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: REJECTIONS */}
        {activeTab === 'REJECTIONS' && (
          <div className="space-y-3">
            {pendingRejections.length === 0 ? (
              <div className="p-8 bg-white rounded-xl border border-[#D6DFE8] text-center text-[#566475]">
                No pending rejection requests.
              </div>
            ) : (
              pendingRejections.map(c => {
                const rej = c.rejectionRequest!;
                return (
                  <div key={c.id} className="bg-white p-4 rounded-xl border border-red-300 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-2">
                      <span className="font-mono font-bold text-sm text-[#0B3D66]">{c.trackingNumber}</span>
                      <span className="font-bold text-red-700">Reason: {rej.reason}</span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-bold text-[#16212E]">{c.description}</h4>
                      <p className="text-[11px] text-[#566475]">Location: {c.landmark || c.address} ({c.wardName})</p>
                      <div className="p-2.5 bg-red-50 rounded-lg border border-red-200">
                        <span className="font-bold text-red-900 block">Officer Justification:</span>
                        <p className="text-[11px] text-red-950 mt-0.5">"{rej.note}"</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => approveRejection(c.id, commentInput[c.id])}
                        className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg flex items-center gap-1 shadow-xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve Rejection (Reject Ticket)</span>
                      </button>
                      <button
                        onClick={() => declineRejection(c.id, commentInput[c.id])}
                        className="px-4 py-2 bg-white border border-[#D6DFE8] text-[#0B3D66] hover:bg-slate-50 font-bold rounded-lg flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        <span>Decline (Send Back to Officer)</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: SECOND TRANSFERS */}
        {activeTab === 'TRANSFERS' && (
          <div className="space-y-3">
            {pendingTransfers.length === 0 ? (
              <div className="p-8 bg-white rounded-xl border border-[#D6DFE8] text-center text-[#566475]">
                No pending second transfer approvals.
              </div>
            ) : (
              pendingTransfers.map(c => {
                const tr = c.transferRequest!;
                return (
                  <div key={c.id} className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-2">
                      <span className="font-mono font-bold text-sm text-[#0B3D66]">{c.trackingNumber}</span>
                      <span className="font-bold text-purple-900">
                        Second Transfer Request: {tr.fromDepartment} → {tr.toDepartment}
                      </span>
                    </div>

                    <p className="font-bold text-[#16212E]">{c.description}</p>
                    <p className="text-[11px] text-[#566475]">Reason: "{tr.reason}"</p>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => approveTransfer(c.id, tr.toDepartment)}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg flex items-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve & Assign to {tr.toDepartment}</span>
                      </button>
                      <button
                        onClick={() => declineTransfer(c.id)}
                        className="px-4 py-2 bg-white border border-[#D6DFE8] text-[#0B3D66] hover:bg-slate-50 font-bold rounded-lg"
                      >
                        Decline (Stays With Current Officer)
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 4: OFFICER JOINS */}
        {activeTab === 'JOINS' && (
          <div className="space-y-3">
            {pendingJoins.length === 0 ? (
              <div className="p-8 bg-white rounded-xl border border-[#D6DFE8] text-center text-[#566475]">
                No pending officer join requests.
              </div>
            ) : (
              pendingJoins.map(req => (
                <div key={req.id} className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-2">
                    <span className="font-bold text-sm text-[#0B3D66]">{req.name}</span>
                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded font-bold">
                      Code: {req.inviteCodeUsed}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-[#16212E]">
                    <p><strong>Department:</strong> {req.department}</p>
                    <p><strong>Role Title:</strong> {req.roleTitle}</p>
                    <p><strong>Email/Mobile:</strong> {req.emailOrMobile}</p>
                    <p><strong>Requested:</strong> {new Date(req.requestedAt).toLocaleDateString('en-GB')}</p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-[#D6DFE8]">
                    <button
                      onClick={() => approveOfficerJoin(req.id)}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg flex items-center gap-1 shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve & Activate Officer</span>
                    </button>
                    <button
                      onClick={() => declineOfficerJoin(req.id)}
                      className="px-4 py-2 bg-white border border-red-300 text-red-700 hover:bg-red-50 font-bold rounded-lg"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </SupervisorWebShell>
  );
};
