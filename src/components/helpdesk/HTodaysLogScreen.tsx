import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusChip } from '../common/SharedCivicComponents';
import { 
  History, 
  PhoneCall, 
  ExternalLink, 
  FileText, 
  CheckCircle2, 
  Calendar,
  Building2,
  Download
} from 'lucide-react';

export const HTodaysLogScreen: React.FC = () => {
  const { 
    complaints, 
    helpdeskRedirectLogs, 
    selectComplaint, 
    simulatedNow 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'REGISTERED' | 'REDIRECTS'>('REGISTERED');

  const helpdeskComplaints = complaints.filter(c => c.routeChannel === 'helpdesk');
  const totalCalls = helpdeskComplaints.length + helpdeskRedirectLogs.length;

  const handleExportCSV = () => {
    const headers = 'Type,ID/Time,Category,Agency/Department,Details\n';
    const compRows = helpdeskComplaints.map(c => 
      `"Registered Grievance","${c.trackingNumber}","${c.categoryNameEn}","${c.department}","Ward ${c.wardNumber}: ${c.address}"`
    );
    const redirRows = helpdeskRedirectLogs.map(r => 
      `"External Redirect","${r.timestamp}","${r.categoryName}","${r.redirectAgency}","Phone ${r.redirectPhone}: ${r.notes || ''}"`
    );
    const blob = new Blob([[headers, ...compRows, ...redirRows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smkmc_helpdesk_calls_${simulatedNow.toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            Today's Telephonic & Facilitation Desk Log
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Log of assisted grievance registrations and external agency redirects for {simulatedNow.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-3.5 py-1.5 bg-white border border-[#D6DFE8] hover:bg-slate-50 text-xs font-semibold text-[#16212E] rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-[#566475]" />
          <span>Export Call Log (CSV)</span>
        </button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <span className="text-[10px] font-bold text-[#566475] uppercase block">Total Citizen Calls</span>
          <div className="text-3xl font-black text-[#16212E] mt-1">{totalCalls}</div>
          <span className="text-[11px] text-[#566475] mt-1 block">Handled via line 0233-2373455</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <span className="text-[10px] font-bold text-[#566475] uppercase block">Municipal Tickets Created</span>
          <div className="text-3xl font-black text-[#0B3D66] mt-1">{helpdeskComplaints.length}</div>
          <span className="text-[11px] text-[#1D7A45] font-semibold mt-1 block">Assigned to field departments</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <span className="text-[10px] font-bold text-[#566475] uppercase block">Utility Redirects Advised</span>
          <div className="text-3xl font-black text-amber-700 mt-1">{helpdeskRedirectLogs.length}</div>
          <span className="text-[11px] text-[#566475] mt-1 block">MSEDCL, Traffic, NHAI/PWD</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#D6DFE8] gap-4">
        <button
          onClick={() => setActiveTab('REGISTERED')}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 ${
            activeTab === 'REGISTERED'
              ? 'border-[#0B3D66] text-[#0B3D66]'
              : 'border-transparent text-[#566475] hover:text-[#16212E]'
          }`}
        >
          Assisted Grievances Registered ({helpdeskComplaints.length})
        </button>

        <button
          onClick={() => setActiveTab('REDIRECTS')}
          className={`pb-2.5 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'REDIRECTS'
              ? 'border-amber-600 text-amber-800'
              : 'border-transparent text-[#566475] hover:text-amber-800'
          }`}
        >
          <span>External Redirection Log</span>
          <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px]">
            {helpdeskRedirectLogs.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Registered */}
      {activeTab === 'REGISTERED' && (
        <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                  <th className="px-4 py-3">Tracking ID</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Department & Ward</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Citizen Contact</th>
                  <th className="px-4 py-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DFE8]">
                {helpdeskComplaints.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0B3D66]">
                      {c.trackingNumber}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#16212E]">{c.categoryNameEn}</div>
                      <div className="text-[11px] text-[#566475] truncate max-w-xs">{c.address}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-[#16212E]">{c.department}</div>
                      <span className="text-[10px] text-[#566475]">Ward {c.wardNumber}</span>
                    </td>

                    <td className="px-4 py-3">
                      <StatusChip status={c.status} />
                    </td>

                    <td className="px-4 py-3 text-[11px]">
                      {c.isAnonymous ? (
                        <span className="text-slate-400 italic">Anonymous</span>
                      ) : (
                        <div>
                          <span className="text-[#16212E] font-medium">{c.citizenName || 'Caller'}</span>
                          <span className="block text-[10px] font-mono text-[#566475]">{c.citizenMobile}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => selectComplaint(c.id, 'C13_COMPLAINT_DETAIL')}
                        className="px-2 py-1 text-[11px] text-[#0B3D66] font-semibold hover:bg-slate-100 rounded border border-[#D6DFE8]"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Redirects */}
      {activeTab === 'REDIRECTS' && (
        <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Inquired Issue</th>
                  <th className="px-4 py-3">Redirected Agency</th>
                  <th className="px-4 py-3">Official Agency Helpline</th>
                  <th className="px-4 py-3">Operator Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DFE8]">
                {helpdeskRedirectLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-[#566475]">
                      {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="px-4 py-3 font-bold text-[#16212E]">
                      {log.categoryName}
                    </td>

                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded text-[10px]">
                        {log.redirectAgency}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-mono font-bold text-[#0B3D66]">
                      {log.redirectPhone}
                    </td>

                    <td className="px-4 py-3 text-[#566475] text-[11px]">
                      {log.notes || 'Provided caller guidance'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
