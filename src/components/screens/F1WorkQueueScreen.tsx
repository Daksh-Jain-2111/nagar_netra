import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { StatusChip, EscalationBadge, CountdownPill, PhotoBadge } from '../common/SharedCivicComponents';
import { Complaint } from '../../types';
import { 
  Shield, 
  Map, 
  List, 
  Search, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  MapPin, 
  ArrowRight, 
  QrCode, 
  Filter, 
  Copy, 
  Check, 
  ExternalLink,
  Mic
} from 'lucide-react';
import { formatClock } from '../../hooks/useVoiceRecorder';

export const F1WorkQueueScreen: React.FC = () => {
  const { 
    language, 
    complaints, 
    currentUser, 
    selectComplaint, 
    simulatedNow,
    syncBackendTickets
  } = useApp();

  // Load tickets submitted by citizens (with voice notes / photos / AI) from the backend.
  useEffect(() => {
    syncBackendTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeTab, setActiveTab] = useState<'NEW' | 'IN_PROGRESS' | 'SCHEDULED' | 'ESCALATED' | 'DONE'>('NEW');
  const [selectedWard, setSelectedWard] = useState<number | 'ALL'>('ALL');
  const [urgentOnly, setUrgentOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Officer department filter: Only this officer's department complaints are shown
  const officerDept = currentUser.department || 'Public Works (Roads)';
  const officerDeptId = currentUser.departmentId || 'roads';
  const supervisorUnit = currentUser.supervisorUnit || 'DMC 1 – Public Works & Infrastructure';

  const deptComplaints = complaints.filter(c => {
    // If officer department is set, match department or departmentId
    if (c.department === officerDept || c.departmentId === officerDeptId) return true;
    // Or if officer roads, include roads complaints
    if (officerDeptId === 'roads' && (c.categoryId === 'roads_potholes' || c.departmentId === 'roads')) return true;
    if (officerDeptId === 'swm' && (c.categoryId === 'solid_waste' || c.departmentId === 'swm')) return true;
    return false;
  });

  // Unique wards present in this officer's complaints (from GPS / wardNumber)
  const availableWards = Array.from(new Set(deptComplaints.map(c => c.wardNumber))).sort((a, b) => a - b);

  // Filter into tabs:
  // New (ASSIGNED)
  const newComplaints = deptComplaints.filter(c => c.status === 'ASSIGNED');
  // In progress (IN_PROGRESS + REOPENED)
  const inProgressComplaints = deptComplaints.filter(c => c.status === 'IN_PROGRESS' || c.status === 'REOPENED');
  // Scheduled (WORK_SCHEDULED)
  const scheduledComplaints = deptComplaints.filter(c => c.status === 'WORK_SCHEDULED');
  // Escalated (has L1)
  const escalatedComplaints = deptComplaints.filter(c => c.escalationLevel === 'L1');
  // Done (RESOLVED / CLOSED / REJECTED)
  const doneComplaints = deptComplaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED' || c.status === 'REJECTED');

  let activeList: Complaint[] = [];
  switch (activeTab) {
    case 'NEW': activeList = newComplaints; break;
    case 'IN_PROGRESS': activeList = inProgressComplaints; break;
    case 'SCHEDULED': activeList = scheduledComplaints; break;
    case 'ESCALATED': activeList = escalatedComplaints; break;
    case 'DONE': activeList = doneComplaints; break;
  }

  // Apply filters: Ward, Urgent, Search
  let displayedComplaints = activeList.filter(c => {
    if (selectedWard !== 'ALL' && c.wardNumber !== selectedWard) return false;
    if (urgentOnly && c.priority !== 'urgent') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchToken = c.trackingNumber.toLowerCase().includes(q);
      const matchLandmark = c.landmark.toLowerCase().includes(q) || c.address.toLowerCase().includes(q);
      const matchDesc = c.description.toLowerCase().includes(q);
      if (!matchToken && !matchLandmark && !matchDesc) return false;
    }
    return true;
  });

  // Sort by nearest deadline (response deadline if ASSIGNED, resolution deadline otherwise)
  displayedComplaints.sort((a, b) => {
    const aDate = new Date(a.status === 'ASSIGNED' ? a.responseDeadline : (a.scheduledTargetDate || a.resolutionDeadline)).getTime();
    const bDate = new Date(b.status === 'ASSIGNED' ? b.responseDeadline : (b.scheduledTargetDate || b.resolutionDeadline)).getTime();
    return aDate - bDate;
  });

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 text-[#16212E]">
      {/* Header Bar */}
      <Header 
        title={`Field officer · ${officerDept}`} 
        subtitle={`Supervisor: ${supervisorUnit}`} 
      />

      <div className="max-w-md md:max-w-xl mx-auto px-4 pt-3 pb-6 space-y-3.5">
        {/* Supervisory Info & Map/List View Toggle */}
        <div className="flex items-center justify-between gap-2 bg-white p-3 rounded-xl border border-[#D6DFE8] shadow-2xs">
          <div className="min-w-0">
            <span className="text-[11px] text-[#566475] block truncate">अधीक्षक / Supervisor:</span>
            <span className="font-bold text-xs text-[#0B3D66] truncate block">{supervisorUnit}</span>
          </div>

          <div className="flex rounded-lg bg-[#F4F7FA] p-0.5 border border-[#D6DFE8] shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                viewMode === 'list' ? 'bg-white text-[#0B3D66] shadow-2xs' : 'text-[#566475]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                viewMode === 'map' ? 'bg-white text-[#0B3D66] shadow-2xs' : 'text-[#566475]'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Map</span>
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#566475] absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search token, landmark, street... (शोध)"
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-white border border-[#D6DFE8] text-xs focus:border-[#0B3D66] focus:outline-none shadow-2xs"
          />
        </div>

        {/* Status Tabs with Real Counts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {[
            { id: 'NEW', label: 'New', count: newComplaints.length, countClass: 'bg-[#0B3D66] text-white' },
            { id: 'IN_PROGRESS', label: 'In progress', count: inProgressComplaints.length, countClass: 'bg-amber-600 text-white' },
            { id: 'SCHEDULED', label: 'Scheduled', count: scheduledComplaints.length, countClass: 'bg-purple-600 text-white' },
            { id: 'ESCALATED', label: 'Escalated', count: escalatedComplaints.length, countClass: 'bg-red-600 text-white' },
            { id: 'DONE', label: 'Done', count: doneComplaints.length, countClass: 'bg-slate-200 text-[#16212E]' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#0B3D66] text-white shadow-xs'
                  : 'bg-white text-[#16212E] border border-[#D6DFE8] hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === tab.id ? 'bg-white/20 text-white' : tab.countClass}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filter Chips: Ward Present (from GPS) + Urgent Only */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedWard('ALL')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                selectedWard === 'ALL' ? 'bg-[#0B3D66] text-white' : 'bg-white border border-[#D6DFE8] text-[#566475]'
              }`}
            >
              All wards
            </button>
            {availableWards.map(w => (
              <button
                key={w}
                onClick={() => setSelectedWard(w)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                  selectedWard === w ? 'bg-[#0B3D66] text-white' : 'bg-white border border-[#D6DFE8] text-[#566475]'
                }`}
              >
                Ward {w}
              </button>
            ))}
            <button
              onClick={() => setUrgentOnly(!urgentOnly)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1 ${
                urgentOnly ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              <span>Urgent only</span>
            </button>
          </div>

          <span className="text-[11px] text-[#566475] shrink-0 font-medium">
            Sort: Nearest deadline
          </span>
        </div>

        {/* MAP VIEW TOGGLE */}
        {viewMode === 'map' ? (
          <div className="bg-white rounded-xl border border-[#D6DFE8] overflow-hidden shadow-xs">
            <div className="p-3 bg-[#F4F7FA] border-b border-[#D6DFE8] flex items-center justify-between">
              <span className="text-xs font-bold text-[#0B3D66]">Ward Map Pin View ({displayedComplaints.length} markers)</span>
              <span className="text-[11px] text-[#566475]">GPS Coordinates</span>
            </div>
            <div className="h-64 bg-slate-100 relative p-4 flex flex-col justify-between">
              <div className="space-y-2">
                {displayedComplaints.map(c => (
                  <div 
                    key={c.id}
                    onClick={() => selectComplaint(c.id, 'F2_OFFICER_DETAIL')}
                    className="p-2 bg-white rounded-lg border border-[#D6DFE8] flex items-center justify-between text-xs cursor-pointer hover:border-[#0B3D66]"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-[#E0681A] shrink-0" />
                      <span className="font-bold text-[#0B3D66]">{c.trackingNumber}</span>
                      <span className="text-[#566475] truncate">{c.landmark || c.address}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {c.latitude.toFixed(2)}°N
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* LIST VIEW */
          <div className="space-y-3.5">
            {displayedComplaints.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#D6DFE8] p-8 text-center space-y-1 text-xs">
                <p className="font-bold text-[#16212E]">No complaints in this queue.</p>
                <p className="text-[#566475]">Check other tabs or remove active filters.</p>
              </div>
            ) : (
              displayedComplaints.map(c => {
                const isAssigned = c.status === 'ASSIGNED';
                const isUrgent = c.priority === 'urgent';
                const hasDuplicates = (c.linkedChildrenIds && c.linkedChildrenIds.length > 0) || Boolean(c.linkedParentId);

                return (
                  <article
                    key={c.id}
                    onClick={() => selectComplaint(c.id, 'F2_OFFICER_DETAIL')}
                    className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden hover:border-[#0B3D66] transition-all cursor-pointer flex flex-col"
                  >
                    {/* Top Statutory Countdown Strip */}
                    <div className="px-3 py-1.5 flex items-center justify-between border-b border-[#D6DFE8] bg-[#F4F7FA]">
                      <div className="flex items-center gap-1.5">
                        <CountdownPill 
                          deadline={isAssigned ? c.responseDeadline : (c.scheduledTargetDate || c.resolutionDeadline)}
                          label={isAssigned ? 'Response' : 'Target'}
                          isMet={isAssigned ? c.responseMet : c.status === 'RESOLVED' || c.status === 'CLOSED'}
                          currentSimulatedNow={simulatedNow}
                        />
                      </div>
                      <span className="text-[11px] text-[#566475] font-mono">
                        Ward {c.wardNumber}
                      </span>
                    </div>

                    <div className="p-3.5 flex flex-col gap-2.5">
                      <div className="flex items-start gap-3">
                        {/* Thumbnail with GPS verify chip */}
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-slate-100 border border-[#D6DFE8]">
                          <img 
                            src={c.photoUrls[0]} 
                            alt="Incident" 
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute bottom-1 left-1">
                            <PhotoBadge status={c.photoBadge || 'VERIFIED'} />
                          </div>
                        </div>

                        {/* Metadata content */}
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-xs font-bold text-[#0B3D66]">
                              {c.trackingNumber}
                            </span>
                            <button
                              onClick={(e) => handleCopy(c.trackingNumber, e)}
                              className="text-[#566475] hover:text-[#0B3D66] p-0.5"
                              title="Copy"
                            >
                              {copiedId === c.trackingNumber ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>

                          <h3 className="text-xs font-bold text-[#16212E] truncate mt-0.5">
                            {c.description}
                          </h3>

                          <p className="text-[11px] text-[#566475] truncate mt-0.5">
                            {c.landmark || c.address}
                          </p>

                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#566475]">
                            <span className="font-semibold text-emerald-800">
                              AI {c.aiConfidence || 94}%
                            </span>
                            <span>•</span>
                            <span className="truncate">{c.routeChannel}</span>
                            {c.voiceNote && (
                              <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded bg-[#E0681A]/10 text-[#E0681A] text-[10px] font-bold flex items-center gap-1">
                                <Mic className="w-3 h-3" />
                                {formatClock(c.voiceNote.durationSeconds)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Badges Cluster */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {isUrgent && (
                          <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold uppercase">
                            URGENT
                          </span>
                        )}

                        {c.escalationLevel && (
                          <EscalationBadge level={c.escalationLevel} reason={c.escalationReason} />
                        )}

                        {hasDuplicates && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 text-[10px] font-semibold border border-amber-300">
                            1 duplicate pair
                          </span>
                        )}

                        {c.supervisorInstruction && (
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-900 text-[10px] font-bold border border-red-300">
                            Directive: {c.supervisorInstruction.message}
                          </span>
                        )}
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#D6DFE8]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            selectComplaint(c.id, 'F2_OFFICER_DETAIL');
                          }}
                          className="h-9 px-2 rounded-lg bg-[#0B3D66] text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#082d4d]"
                        >
                          <span>Open Detail</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            selectComplaint(c.id, 'F3_POST_UPDATE');
                          }}
                          className="h-9 px-2 rounded-lg bg-[#F4F7FA] text-[#0B3D66] text-xs font-bold border border-[#D6DFE8] flex items-center justify-center gap-1 hover:bg-slate-100"
                        >
                          <span>Post Update</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
