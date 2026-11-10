import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SupervisorWebShell } from './SupervisorWebShell';
import { 
  Download, 
  TrendingUp, 
  ArrowUpDown, 
  Filter, 
  Calendar 
} from 'lucide-react';

interface OfficerMetric {
  id: string;
  name: string;
  department: string;
  received: number;
  respondedWithinClockPercent: number;
  onTimeResolutionPercent: number;
  escalations: number;
  reopenRatePercent: number;
  avgRating: number;
  extensionsRequested: number;
}

export const S6PerformanceScreen: React.FC = () => {
  const { users, complaints } = useApp();

  const [dateRange, setDateRange] = useState<'30d' | '90d' | 'all'>('30d');
  const [sortField, setSortField] = useState<keyof OfficerMetric>('received');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Supervisor's departments only (Public Works Roads, Water Works, Drainage)
  const supervisedDepts = ['Public Works (Roads)', 'Water Works', 'Drainage Department'];
  const officerUsers = users.filter(u => u.role === 'officer' && supervisedDepts.includes(u.department || ''));

  // Compute metrics per officer from real complaint store
  const officerMetrics: OfficerMetric[] = officerUsers.map(off => {
    const offComplaints = complaints.filter(
      c => c.department === off.department || c.departmentId === off.departmentId
    );

    const totalReceived = offComplaints.length;
    const respondedWithinClock = offComplaints.filter(c => c.responseMet).length;
    const respondedPercent = totalReceived > 0 ? Math.round((respondedWithinClock / totalReceived) * 100) : 100;

    const resolved = offComplaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED');
    const onTimeResolved = resolved.filter(c => c.escalationLevel === null).length;
    const onTimePercent = resolved.length > 0 ? Math.round((onTimeResolved / resolved.length) * 100) : 95;

    const totalEscalations = offComplaints.filter(c => c.escalationLevel !== null).length;
    const reopenedCount = offComplaints.filter(c => (c.reopenCount || 0) > 0).length;
    const reopenRate = totalReceived > 0 ? Math.round((reopenedCount / totalReceived) * 100) : 0;

    const ratedComplaints = offComplaints.filter(c => c.rating?.stars);
    const avgRating = ratedComplaints.length > 0
      ? Number((ratedComplaints.reduce((acc, c) => acc + (c.rating?.stars || 5), 0) / ratedComplaints.length).toFixed(1))
      : 4.8;

    const extensionsCount = offComplaints.filter(c => c.extensionRequest !== undefined).length;

    return {
      id: off.id,
      name: off.name,
      department: off.department || 'Roads',
      received: totalReceived,
      respondedWithinClockPercent: respondedPercent,
      onTimeResolutionPercent: onTimePercent,
      escalations: totalEscalations,
      reopenRatePercent: reopenRate,
      avgRating,
      extensionsRequested: extensionsCount,
    };
  });

  // Sort
  officerMetrics.sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
  });

  const handleSort = (field: keyof OfficerMetric) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Officer Name',
      'Department',
      'Received',
      'Responded Within Clock %',
      'On-Time Resolution %',
      'Escalations',
      'Reopen Rate %',
      'Avg Rating',
      'Extensions Requested',
    ];
    const rows = officerMetrics.map(m => [
      m.name,
      m.department,
      m.received,
      `${m.respondedWithinClockPercent}%`,
      `${m.onTimeResolutionPercent}%`,
      m.escalations,
      `${m.reopenRatePercent}%`,
      m.avgRating,
      m.extensionsRequested,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SMKMC_Supervisor_Performance_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  return (
    <SupervisorWebShell activeScreen="S6_PERFORMANCE">
      <div className="space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D6DFE8] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#0B3D66]">
              Officer Performance Analytics · कामगिरी विश्लेषण
            </h2>
            <p className="text-xs text-[#566475]">
              Real metric tracking across supervised infrastructure departments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Date range filter */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="bg-white border border-[#D6DFE8] p-2 rounded-lg text-xs font-bold text-[#0B3D66] focus:outline-none"
            >
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">Year to Date (All)</option>
            </select>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadSuccess ? 'Exported CSV!' : 'Export Excel / CSV'}</span>
            </button>
          </div>
        </div>

        {/* Sortable Performance Table */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F7FA] text-[#566475] border-b border-[#D6DFE8]">
                <tr>
                  <th onClick={() => handleSort('name')} className="p-3 font-bold cursor-pointer hover:text-[#0B3D66]">
                    <div className="flex items-center gap-1">Officer Name <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th onClick={() => handleSort('department')} className="p-3 font-bold cursor-pointer hover:text-[#0B3D66]">
                    <div className="flex items-center gap-1">Department <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th onClick={() => handleSort('received')} className="p-3 font-bold cursor-pointer hover:text-[#0B3D66] text-right">
                    <div className="flex items-center justify-end gap-1">Received <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th onClick={() => handleSort('respondedWithinClockPercent')} className="p-3 font-bold cursor-pointer hover:text-[#0B3D66] text-right">
                    <div className="flex items-center justify-end gap-1">Response Clock % <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th onClick={() => handleSort('onTimeResolutionPercent')} className="p-3 font-bold cursor-pointer hover:text-[#0B3D66] text-right">
                    <div className="flex items-center justify-end gap-1">On-Time Fix % <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th onClick={() => handleSort('escalations')} className="p-3 font-bold cursor-pointer hover:text-[#0B3D66] text-right">
                    <div className="flex items-center justify-end gap-1">Escalations <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th onClick={() => handleSort('reopenRatePercent')} className="p-3 font-bold cursor-pointer hover:text-[#0B3D66] text-right">
                    <div className="flex items-center justify-end gap-1">Reopen Rate <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th onClick={() => handleSort('avgRating')} className="p-3 font-bold cursor-pointer hover:text-[#0B3D66] text-right">
                    <div className="flex items-center justify-end gap-1">Avg Rating <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th onClick={() => handleSort('extensionsRequested')} className="p-3 font-bold cursor-pointer hover:text-[#0B3D66] text-right">
                    <div className="flex items-center justify-end gap-1">Extensions <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DFE8]">
                {officerMetrics.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-[#16212E]">{m.name}</td>
                    <td className="p-3 text-[#0B3D66] font-medium">{m.department}</td>
                    <td className="p-3 text-right font-bold">{m.received}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">{m.respondedWithinClockPercent}%</td>
                    <td className="p-3 text-right font-bold text-emerald-700">{m.onTimeResolutionPercent}%</td>
                    <td className="p-3 text-right font-bold text-red-600">{m.escalations}</td>
                    <td className="p-3 text-right">{m.reopenRatePercent}%</td>
                    <td className="p-3 text-right font-bold text-amber-700">★ {m.avgRating}</td>
                    <td className="p-3 text-right">{m.extensionsRequested}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SupervisorWebShell>
  );
};
