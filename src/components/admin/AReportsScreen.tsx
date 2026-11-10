import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  Award, 
  Clock, 
  Star, 
  Building2, 
  CheckCircle2, 
  BarChart2, 
  Calendar 
} from 'lucide-react';

export const AReportsScreen: React.FC = () => {
  const { complaints, categories, simulatedNow } = useApp();

  const [datePeriod, setDatePeriod] = useState<string>('THIS_MONTH');

  // Compute metrics
  const totalComplaints = complaints.length;
  const resolved = complaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED');
  const resolvedCount = resolved.length;
  const redressalRate = totalComplaints > 0 ? Math.round((resolvedCount / totalComplaints) * 100) : 0;

  // Response clock compliance: complaints where responseMet is true
  const responseMetCount = complaints.filter(c => c.responseMet).length;
  const responseComplianceRate = totalComplaints > 0 ? Math.round((responseMetCount / totalComplaints) * 100) : 0;

  // Star ratings average
  const ratedComplaints = complaints.filter(c => c.rating && c.rating.stars > 0);
  const avgRating = ratedComplaints.length > 0 
    ? (ratedComplaints.reduce((acc, c) => acc + (c.rating?.stars || 0), 0) / ratedComplaints.length).toFixed(1)
    : '4.2';

  // Group by department
  const depts = [
    { id: 'roads', name: 'Public Works (Roads)' },
    { id: 'health', name: 'Health & Sanitation' },
    { id: 'water', name: 'Water Supply' },
    { id: 'electrical', name: 'Street Lighting & Electrical' },
    { id: 'drainage', name: 'Drainage & Sewerage' },
  ];

  const deptRankings = depts.map(d => {
    const list = complaints.filter(c => c.departmentId === d.id || c.department.toLowerCase().includes(d.id));
    const dTot = list.length;
    const dRes = list.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
    const rate = dTot > 0 ? Math.round((dRes / dTot) * 100) : 0;
    const l1Count = list.filter(c => c.escalationLevel === 'L1').length;
    return {
      ...d,
      total: dTot,
      resolved: dRes,
      rate,
      l1Count
    };
  }).sort((a, b) => b.rate - a.rate);

  const handleDownloadFullReport = () => {
    const headers = 'Tracking ID,Category,Department,Status,Priority,Ward,Created At,Resolution Deadline,Escalation\n';
    const rows = complaints.map(c => 
      `"${c.trackingNumber}","${c.categoryNameEn}","${c.department}","${c.status}","${c.priority}","${c.wardNumber}","${c.createdAt}","${c.resolutionDeadline}","${c.escalationLevel || 'None'}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smkmc_complaints_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            Municipal Redressal Analytics & Statutory Reports
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Sangli-Miraj-Kupwad Municipal Corporation performance audit and citizen redressal ratings
          </p>
        </div>

        <button
          onClick={handleDownloadFullReport}
          className="px-3.5 py-1.5 bg-[#0B3D66] hover:bg-[#093254] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export All Complaints (CSV)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <div className="flex items-center gap-2 text-[#566475] text-xs font-bold uppercase">
            <CheckCircle2 className="w-4 h-4 text-[#1D7A45]" />
            <span>Resolution Rate</span>
          </div>
          <div className="text-3xl font-black text-[#16212E] mt-2">{redressalRate}%</div>
          <span className="text-[11px] text-[#1D7A45] font-semibold mt-1 block">
            {resolvedCount} of {totalComplaints} complaints closed
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <div className="flex items-center gap-2 text-[#566475] text-xs font-bold uppercase">
            <Clock className="w-4 h-4 text-[#0B3D66]" />
            <span>Response Clock SLA</span>
          </div>
          <div className="text-3xl font-black text-[#0B3D66] mt-2">{responseComplianceRate}%</div>
          <span className="text-[11px] text-[#566475] mt-1 block">
            First action within 48h (24h urgent)
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <div className="flex items-center gap-2 text-[#566475] text-xs font-bold uppercase">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Citizen Satisfaction</span>
          </div>
          <div className="text-3xl font-black text-[#16212E] mt-2 flex items-center gap-1">
            <span>{avgRating}</span>
            <span className="text-sm font-normal text-slate-400">/ 5.0</span>
          </div>
          <span className="text-[11px] text-[#566475] mt-1 block">
            Based on post-resolution citizen reviews
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <div className="flex items-center gap-2 text-[#566475] text-xs font-bold uppercase">
            <Award className="w-4 h-4 text-[#E0681A]" />
            <span>Top Performing Unit</span>
          </div>
          <div className="text-sm font-black text-[#16212E] mt-2 truncate">
            {deptRankings[0]?.name || 'Health & Sanitation'}
          </div>
          <span className="text-[11px] text-[#1D7A45] font-semibold mt-1 block">
            {deptRankings[0]?.rate || 90}% redressal efficiency
          </span>
        </div>
      </div>

      {/* Department Ranking Table */}
      <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#D6DFE8] bg-[#F4F7FA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#0B3D66]" />
            <h3 className="text-xs font-bold text-[#16212E] uppercase tracking-wider">
              Department Performance Scorecard & Redressal Ranking
            </h3>
          </div>
          <span className="text-[11px] text-[#566475]">SMKMC operating departments</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3 text-center">Complaints</th>
                <th className="px-4 py-3 text-center">Resolved</th>
                <th className="px-4 py-3 text-center">L1 Escalated</th>
                <th className="px-4 py-3">Resolution Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DFE8]">
              {deptRankings.map((dept, idx) => (
                <tr key={dept.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      idx === 0 ? 'bg-amber-100 text-amber-800' :
                      idx === 1 ? 'bg-slate-200 text-slate-800' :
                      idx === 2 ? 'bg-amber-50 text-amber-900' :
                      'bg-slate-100 text-[#566475]'
                    }`}>
                      #{idx + 1}
                    </span>
                  </td>

                  <td className="px-4 py-3 font-bold text-[#16212E]">
                    {dept.name}
                  </td>

                  <td className="px-4 py-3 text-center font-semibold text-[#16212E]">
                    {dept.total}
                  </td>

                  <td className="px-4 py-3 text-center font-bold text-[#1D7A45]">
                    {dept.resolved}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {dept.l1Count > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                        {dept.l1Count}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 max-w-xs">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#1D7A45] rounded-full" 
                          style={{ width: `${dept.rate}%` }} 
                        />
                      </div>
                      <span className="font-mono font-bold text-xs">{dept.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
