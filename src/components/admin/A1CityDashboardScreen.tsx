import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusChip, EscalationBadge, CountdownPill } from '../common/SharedCivicComponents';
import { 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Building2, 
  MapPin, 
  Search, 
  Filter, 
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  ShieldAlert,
  ChevronRight,
  Calendar
} from 'lucide-react';

export const A1CityDashboardScreen: React.FC = () => {
  const { 
    complaints, 
    orgUnits, 
    supervisorOverdueComplaints, 
    selectComplaint, 
    navigateTo,
    simulatedNow
  } = useApp();

  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewTab, setViewTab] = useState<'OVERVIEW' | 'SUPERVISOR_OVERDUE' | 'WARDS'>('OVERVIEW');

  // Compute live KPIs
  const totalComplaints = complaints.length;
  const resolvedCount = complaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
  const openCount = complaints.filter(c => 
    c.status !== 'RESOLVED' && c.status !== 'CLOSED' && c.status !== 'REJECTED'
  ).length;
  const l1EscalatedCount = complaints.filter(c => c.escalationLevel === 'L1').length;
  const redressalRate = totalComplaints > 0 ? Math.round((resolvedCount / totalComplaints) * 100) : 0;
  
  const overdueCount = complaints.filter(c => {
    if (c.status === 'RESOLVED' || c.status === 'CLOSED' || c.status === 'REJECTED') return false;
    return new Date(c.resolutionDeadline).getTime() < simulatedNow.getTime();
  }).length;

  const toCheckCount = complaints.filter(c => c.status === 'TO_CHECK').length;

  // Filter complaints for list
  const filteredComplaints = complaints.filter(c => {
    if (selectedDeptFilter !== 'ALL' && c.department !== selectedDeptFilter && c.departmentId !== selectedDeptFilter) {
      return false;
    }
    if (selectedWardFilter !== 'ALL' && c.wardNumber.toString() !== selectedWardFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match = c.trackingNumber.toLowerCase().includes(q) ||
        c.categoryNameEn.toLowerCase().includes(q) ||
        c.categoryNameMr.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Group by department for department breakdown
  const departmentsList = [
    { id: 'roads', nameEn: 'Public Works (Roads)', nameMr: 'सार्वजनिक बांधकाम (रस्ते)' },
    { id: 'health', nameEn: 'Health & Sanitation', nameMr: 'आरोग्य व स्वच्छता' },
    { id: 'water', nameEn: 'Water Supply', nameMr: 'पाणी पुरवठा' },
    { id: 'electrical', nameEn: 'Street Lighting & Electrical', nameMr: 'विद्युत व पथदिवे' },
    { id: 'drainage', nameEn: 'Drainage & Sewerage', nameMr: 'मलनिस्सारण व गटारे' },
    { id: 'encroachment', nameEn: 'Anti-Encroachment & Town Planning', nameMr: 'अतिक्रमण व नगररचना' },
    { id: 'gardens', nameEn: 'Parks & Tree Trimming', nameMr: 'उद्यान व वृक्ष संवर्धन' },
  ];

  const deptStats = departmentsList.map(dept => {
    const deptComplaints = complaints.filter(c => 
      c.departmentId === dept.id || 
      c.department.toLowerCase().includes(dept.id) ||
      dept.nameEn.toLowerCase().includes(c.department.toLowerCase())
    );
    const dTotal = deptComplaints.length;
    const dResolved = deptComplaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
    const dEscalated = deptComplaints.filter(c => c.escalationLevel === 'L1').length;
    const dRate = dTotal > 0 ? Math.round((dResolved / dTotal) * 100) : 0;
    return {
      ...dept,
      total: dTotal,
      resolved: dResolved,
      escalated: dEscalated,
      rate: dRate
    };
  });

  // Unique wards present in data
  const uniqueWards = Array.from(new Set(complaints.map(c => c.wardNumber))).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            City Civic Performance Dashboard
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Real-time municipal grievance metrics across Sangli, Miraj & Kupwad divisions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D6DFE8] rounded-lg text-xs text-[#566475]">
            <Calendar className="w-3.5 h-3.5 text-[#0B3D66]" />
            <span>Simulated Date: <strong className="text-[#16212E]">{simulatedNow.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
          </div>

          <button
            onClick={() => navigateTo('A_REPORTS')}
            className="px-3 py-1.5 bg-[#0B3D66] hover:bg-[#093254] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <span>Generate Reports</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <span className="text-[11px] font-bold text-[#566475] uppercase tracking-wider block">Total Filed</span>
          <div className="text-2xl font-black text-[#16212E] mt-1">{totalComplaints}</div>
          <span className="text-[10px] text-[#566475] mt-1 block">SMKMC jurisdiction</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <span className="text-[11px] font-bold text-[#566475] uppercase tracking-wider block">Open / Active</span>
          <div className="text-2xl font-black text-[#E0681A] mt-1">{openCount}</div>
          <span className="text-[10px] text-[#566475] mt-1 block">In field & review</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <span className="text-[11px] font-bold text-[#566475] uppercase tracking-wider block">Resolved</span>
          <div className="text-2xl font-black text-[#1D7A45] mt-1">{resolvedCount}</div>
          <span className="text-[10px] text-[#1D7A45] font-semibold mt-1 block">{redressalRate}% redressal</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <span className="text-[11px] font-bold text-[#566475] uppercase tracking-wider block">L1 Escalations</span>
          <div className="text-2xl font-black text-red-600 mt-1">{l1EscalatedCount}</div>
          <span className="text-[10px] text-red-600 mt-1 block">Response/deadline missed</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <span className="text-[11px] font-bold text-[#566475] uppercase tracking-wider block">Past Target Date</span>
          <div className="text-2xl font-black text-amber-700 mt-1">{overdueCount}</div>
          <span className="text-[10px] text-[#566475] mt-1 block">Overdue SLA</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-red-200 bg-red-50/50 shadow-xs">
          <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider block flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            Sup. Overdue
          </span>
          <div className="text-2xl font-black text-red-700 mt-1">{supervisorOverdueComplaints.length}</div>
          <span className="text-[10px] text-red-600 mt-1 block">&gt;72h inactive after L1</span>
        </div>
      </div>

      {/* Navigation Tabs between Overview, Supervisor Overdue, Wards */}
      <div className="flex border-b border-[#D6DFE8] gap-4">
        <button
          onClick={() => setViewTab('OVERVIEW')}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 ${
            viewTab === 'OVERVIEW'
              ? 'border-[#0B3D66] text-[#0B3D66]'
              : 'border-transparent text-[#566475] hover:text-[#16212E]'
          }`}
        >
          Department Breakdown & Live Queue
        </button>

        <button
          onClick={() => setViewTab('SUPERVISOR_OVERDUE')}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
            viewTab === 'SUPERVISOR_OVERDUE'
              ? 'border-red-600 text-red-700'
              : 'border-transparent text-[#566475] hover:text-red-700'
          }`}
        >
          <span>Supervisor-Overdue Queue</span>
          {supervisorOverdueComplaints.length > 0 && (
            <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px]">
              {supervisorOverdueComplaints.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setViewTab('WARDS')}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 ${
            viewTab === 'WARDS'
              ? 'border-[#0B3D66] text-[#0B3D66]'
              : 'border-transparent text-[#566475] hover:text-[#16212E]'
          }`}
        >
          Prabhag / Ward Performance
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {viewTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Department Performance Table */}
          <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-[#D6DFE8] bg-[#F4F7FA] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0B3D66]" />
                <h3 className="text-xs font-bold text-[#16212E] uppercase tracking-wider">
                  Department-Wise Redressal & Resolution Status
                </h3>
              </div>
              <span className="text-[11px] text-[#566475]">All 7 Operating Municipal Units</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                    <th className="px-4 py-3">Department (विभाग)</th>
                    <th className="px-4 py-3 text-center">Total</th>
                    <th className="px-4 py-3 text-center">Resolved</th>
                    <th className="px-4 py-3 text-center">L1 Escalated</th>
                    <th className="px-4 py-3">Resolution Rate %</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D6DFE8]">
                  {deptStats.map(dept => (
                    <tr key={dept.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#16212E]">{dept.nameEn}</div>
                        <div className="text-[11px] text-[#566475]">{dept.nameMr}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-[#16212E]">
                        {dept.total}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-[#1D7A45]">
                        {dept.resolved}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {dept.escalated > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            {dept.escalated}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 max-w-[180px]">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                dept.rate >= 75 ? 'bg-[#1D7A45]' : dept.rate >= 40 ? 'bg-[#E0681A]' : 'bg-red-500'
                              }`} 
                              style={{ width: `${dept.rate}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold font-mono">{dept.rate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedDeptFilter(dept.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#0B3D66] hover:bg-slate-100 rounded border border-[#D6DFE8] transition-colors"
                        >
                          Filter Queue
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tracking ID, landmark, citizen..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#D6DFE8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0B3D66]"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1 text-xs text-[#566475]">
                <Filter className="w-3.5 h-3.5" />
                <span>Filters:</span>
              </div>

              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-1.5 bg-white text-[#16212E] focus:outline-hidden"
              >
                <option value="ALL">All Departments</option>
                {departmentsList.map(d => (
                  <option key={d.id} value={d.id}>{d.nameEn}</option>
                ))}
              </select>

              <select
                value={selectedWardFilter}
                onChange={(e) => setSelectedWardFilter(e.target.value)}
                className="text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-1.5 bg-white text-[#16212E] focus:outline-hidden"
              >
                <option value="ALL">All Wards</option>
                {uniqueWards.map(w => (
                  <option key={w} value={w.toString()}>Ward {w}</option>
                ))}
              </select>

              {(selectedDeptFilter !== 'ALL' || selectedWardFilter !== 'ALL' || searchTerm) && (
                <button
                  onClick={() => {
                    setSelectedDeptFilter('ALL');
                    setSelectedWardFilter('ALL');
                    setSearchTerm('');
                  }}
                  className="text-xs text-red-600 hover:underline px-2 py-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Live Complaint Queue Table */}
          <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-[#D6DFE8] bg-[#F4F7FA] flex items-center justify-between">
              <span className="text-xs font-bold text-[#16212E]">
                Showing {filteredComplaints.length} of {complaints.length} Complaints
              </span>
              <span className="text-[11px] text-[#566475]">Click row to open details</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                    <th className="px-4 py-2.5">Tracking ID</th>
                    <th className="px-4 py-2.5">Category & Landmark</th>
                    <th className="px-4 py-2.5">Ward</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Clocks & Escalation</th>
                    <th className="px-4 py-2.5">Citizen</th>
                    <th className="px-4 py-2.5 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D6DFE8]">
                  {filteredComplaints.map(c => (
                    <tr 
                      key={c.id} 
                      onClick={() => selectComplaint(c.id, 'C13_COMPLAINT_DETAIL')}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-[#0B3D66]">
                        {c.trackingNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#16212E]">{c.categoryNameEn}</div>
                        <div className="text-[11px] text-[#566475] truncate max-w-xs">{c.landmark || c.address}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-[#16212E] font-medium text-[11px]">
                          Ward {c.wardNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={c.status} />
                      </td>
                      <td className="px-4 py-3 space-y-1">
                        {c.escalationLevel && (
                          <EscalationBadge level={c.escalationLevel} reason={c.escalationReason} />
                        )}
                        <div>
                          <CountdownPill 
                            deadline={c.resolutionDeadline} 
                            isCompleted={c.status === 'RESOLVED' || c.status === 'CLOSED'} 
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        {c.isAnonymous ? (
                          <span className="text-slate-400 italic">Anonymous citizen</span>
                        ) : (
                          <span className="text-[#16212E] font-medium">{c.citizenName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUPERVISOR-OVERDUE (View-Only per Global Rule) */}
      {viewTab === 'SUPERVISOR_OVERDUE' && (
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-red-800">
                Supervisor Inactivity Watchlist (&gt;72 Hours After L1 Escalation)
              </h4>
              <p className="mt-1 leading-relaxed">
                As per SMKMC statutory rule: when an officer misses the 48h response clock or resolution deadline, the complaint escalates to L1 (Supervisor). If the supervisor takes no action within 72 hours of escalation, it appears on this view-only monitoring queue for Corporation Admin review.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-[#D6DFE8] bg-[#F4F7FA] font-bold text-xs text-[#16212E]">
              Overdue Escalations ({supervisorOverdueComplaints.length})
            </div>

            {supervisorOverdueComplaints.length === 0 ? (
              <div className="p-8 text-center text-[#566475] text-xs">
                <CheckCircle2 className="w-8 h-8 text-[#1D7A45] mx-auto mb-2" />
                <p className="font-bold text-sm text-[#16212E]">No Overdue Supervisors</p>
                <p className="mt-1">All escalated complaints have received supervisor instructions or actions within the 72h window.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                      <th className="px-4 py-3">Tracking ID</th>
                      <th className="px-4 py-3">Department & Ward</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Escalated Since</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D6DFE8]">
                    {supervisorOverdueComplaints.map(c => (
                      <tr key={c.id} className="hover:bg-red-50/40">
                        <td className="px-4 py-3 font-mono font-bold text-red-700">
                          {c.trackingNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-[#16212E]">{c.department}</div>
                          <div className="text-[11px] text-[#566475]">Ward {c.wardNumber}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#16212E]">
                          {c.categoryNameEn}
                        </td>
                        <td className="px-4 py-3 text-red-700 font-medium">
                          {c.escalatedAt ? new Date(c.escalatedAt).toLocaleDateString('en-IN') : 'Escalated'}
                          <span className="block text-[10px] text-[#566475]">Reason: {c.escalationReason}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip status={c.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => selectComplaint(c.id, 'C13_COMPLAINT_DETAIL')}
                            className="px-2.5 py-1 bg-[#0B3D66] text-white rounded text-[11px] font-semibold hover:bg-[#093254]"
                          >
                            Inspect Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: WARDS */}
      {viewTab === 'WARDS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {uniqueWards.map(wardNum => {
            const wardComplaints = complaints.filter(c => c.wardNumber === wardNum);
            const wTotal = wardComplaints.length;
            const wResolved = wardComplaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
            const wEscalated = wardComplaints.filter(c => c.escalationLevel === 'L1').length;
            const rate = wTotal > 0 ? Math.round((wResolved / wTotal) * 100) : 0;

            return (
              <div key={wardNum} className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#0B3D66]" />
                    <h4 className="font-bold text-sm text-[#16212E]">Ward / Prabhag {wardNum}</h4>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100">
                    {wTotal} complaints
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#566475]">
                    <span>Resolution Rate:</span>
                    <strong className="text-[#1D7A45]">{rate}% ({wResolved}/{wTotal})</strong>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1D7A45] rounded-full" style={{ width: `${rate}%` }} />
                  </div>
                  <div className="flex justify-between text-[#566475] pt-1">
                    <span>L1 Escalated:</span>
                    <strong className={wEscalated > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}>
                      {wEscalated}
                    </strong>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedWardFilter(wardNum.toString());
                    setViewTab('OVERVIEW');
                  }}
                  className="w-full py-1.5 text-center text-xs font-semibold text-[#0B3D66] bg-[#F4F7FA] hover:bg-slate-100 rounded-lg border border-[#D6DFE8] transition-colors"
                >
                  View Ward Complaints
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
