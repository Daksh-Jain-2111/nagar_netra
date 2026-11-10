import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SupervisorWebShell } from './SupervisorWebShell';
import { MOCK_CATEGORIES } from '../../data/mockData';
import { 
  CheckCircle, 
  ArrowRight, 
  X, 
  MapPin, 
  Volume2, 
  HelpCircle, 
  Building 
} from 'lucide-react';

export const S2ToCheckScreen: React.FC = () => {
  const { 
    complaints, 
    supervisorConfirmDepartment, 
    approveRejection 
  } = useApp();

  const toCheckComplaints = complaints.filter(c => c.status === 'TO_CHECK');
  const [forwardingId, setForwardingId] = useState<string | null>(null);
  const [selectedForwardDept, setSelectedForwardDept] = useState<string>('water');

  const handleConfirm = (id: string, deptId: string) => {
    supervisorConfirmDepartment(id, deptId);
  };

  const handleReject = (id: string) => {
    approveRejection(id, 'Not a corporation civic service or outside municipal jurisdiction.');
  };

  return (
    <SupervisorWebShell activeScreen="S2_TO_CHECK">
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#0B3D66]">
              To Check Queue · संवर्ग व विभाग पडताळणी
            </h2>
            <p className="text-xs text-[#566475]">
              Complaints submitted via citizen choice or with low AI confidence requiring DMC department confirmation.
            </p>
          </div>
          <span className="px-3 py-1 bg-amber-100 text-amber-950 font-bold rounded-full border border-amber-300">
            {toCheckComplaints.length} Pending Check
          </span>
        </div>

        {toCheckComplaints.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-[#D6DFE8] text-center space-y-1">
            <p className="font-bold text-[#16212E] text-sm">No complaints pending department verification.</p>
            <p className="text-[#566475]">All incoming civic tickets have been assigned.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {toCheckComplaints.map((c) => (
              <div 
                key={c.id} 
                className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#D6DFE8] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#0B3D66]">{c.trackingNumber}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-bold text-[10px]">
                      Channel: {c.routeChannel}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#566475]">
                    Ward {c.wardNumber} · {new Date(c.createdAt).toLocaleDateString('en-GB')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Photo thumbnail */}
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-[#D6DFE8] bg-slate-100">
                    <img src={c.photoUrls[0]} alt="Incident" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded">
                      GPS: {c.latitude.toFixed(2)}°N
                    </span>
                  </div>

                  {/* Grievance Content & Citizen Choice */}
                  <div className="md:col-span-2 space-y-2">
                    <h3 className="font-bold text-sm text-[#16212E]">{c.description}</h3>
                    
                    {c.voiceTranscript && (
                      <div className="p-2 rounded bg-sky-50 border border-sky-200 text-[11px] text-sky-950 flex items-start gap-1.5">
                        <Volume2 className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Voice Transcript: </span>
                          <span>"{c.voiceTranscript}"</span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="p-1.5 rounded bg-[#F4F7FA] border border-[#D6DFE8]">
                        <strong>Citizen Choice:</strong> {c.department}
                      </span>
                      <span className="p-1.5 rounded bg-[#F4F7FA] border border-[#D6DFE8]">
                        <strong>AI Confidence:</strong> {c.aiConfidence || 58}%
                      </span>
                      <span className="p-1.5 rounded bg-[#F4F7FA] border border-[#D6DFE8]">
                        <strong>Location:</strong> {c.landmark || c.address}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions ONLY: Confirm Department / Forward to another department / Reject */}
                <div className="pt-2 border-t border-[#D6DFE8] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleConfirm(c.id, c.departmentId)}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Confirm Department ({c.department})</span>
                    </button>

                    <button
                      onClick={() => setForwardingId(forwardingId === c.id ? null : c.id)}
                      className="px-3 py-2 bg-white border border-[#D6DFE8] text-[#0B3D66] font-bold rounded-lg hover:bg-slate-50 flex items-center gap-1"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>Forward to Another Department</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleReject(c.id)}
                    className="px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-bold rounded-lg"
                  >
                    Reject as Not Civic / Not Ours
                  </button>
                </div>

                {/* Inline Forwarding Dropdown if toggled */}
                {forwardingId === c.id && (
                  <div className="p-3 bg-[#F4F7FA] rounded-lg border border-[#D6DFE8] space-y-2">
                    <label className="font-bold text-[#16212E] block">
                      Select Department to Forward (Department list only):
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedForwardDept}
                        onChange={(e) => setSelectedForwardDept(e.target.value)}
                        className="bg-white border border-[#D6DFE8] p-2 rounded-lg text-xs font-bold text-[#0B3D66] flex-1"
                      >
                        {MOCK_CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.departmentId}>
                            {cat.department} ({cat.departmentMr})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          handleConfirm(c.id, selectedForwardDept);
                          setForwardingId(null);
                        }}
                        className="px-4 py-2 bg-[#0B3D66] text-white font-bold rounded-lg hover:bg-[#082d4d]"
                      >
                        Forward & Assign
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SupervisorWebShell>
  );
};
