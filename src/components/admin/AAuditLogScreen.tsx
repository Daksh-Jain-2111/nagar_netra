import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Activity, 
  Download,
  CheckCircle 
} from 'lucide-react';

export const AAuditLogScreen: React.FC = () => {
  const { auditLogs } = useApp();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const filteredLogs = auditLogs.filter(log => {
    if (roleFilter !== 'ALL' && log.actorRole.toLowerCase() !== roleFilter.toLowerCase()) {
      return false;
    }
    if (actionFilter !== 'ALL' && log.action !== actionFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match = log.actorName.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.refEntity.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    const headers = 'ID,Timestamp,Actor Name,Actor Role,Action,Reference Entity,Details\n';
    const rows = filteredLogs.map(l => 
      `"${l.id}","${l.timestamp}","${l.actorName}","${l.actorRole}","${l.action}","${l.refEntity}","${l.details.replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smkmc_audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            Administrative Audit Trail & Activity Log
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Operational record of all configuration edits, statutory overrides, role grants and SLA approvals
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-3.5 py-1.5 bg-white border border-[#D6DFE8] hover:bg-slate-50 text-xs font-semibold text-[#16212E] rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-[#566475]" />
          <span>Export Audit Log (CSV)</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search action, actor, entity, details..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#D6DFE8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0B3D66]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-1.5 bg-white text-[#16212E] focus:outline-hidden"
          >
            <option value="ALL">All Roles</option>
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="officer">Field Officer</option>
            <option value="helpdesk">Helpdesk</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-1.5 bg-white text-[#16212E] focus:outline-hidden"
          >
            <option value="ALL">All Action Types</option>
            <option value="UPDATE_SYSTEM_RULES">Update Rules</option>
            <option value="APPROVE_TARGET_EXTENSION">Approve Extension</option>
            <option value="APPROVE_REJECTION">Approve Rejection</option>
            <option value="APPROVE_TRANSFER">Approve Transfer</option>
            <option value="APPROVE_OFFICER_JOIN">Approve Join</option>
            <option value="REGENERATE_INVITE">Regenerate Invite</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#D6DFE8] bg-[#F4F7FA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#0B3D66]" />
            <h3 className="text-xs font-bold text-[#16212E] uppercase tracking-wider">
              Recorded Audit Events ({filteredLogs.length})
            </h3>
          </div>
          <span className="text-[11px] text-[#566475]">Chronological log</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor & Role</th>
                <th className="px-4 py-3">Action Type</th>
                <th className="px-4 py-3">Target Entity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DFE8]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono text-[11px] text-[#566475] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>

                  <td className="px-4 py-3">
                    <strong className="text-[#16212E]">{log.actorName}</strong>
                    <span className="block text-[10px] text-[#566475] uppercase font-mono">
                      {log.actorRole}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-50 text-[#0B3D66] border border-blue-200">
                      {log.action}
                    </span>
                  </td>

                  <td className="px-4 py-3 font-semibold text-[#16212E]">
                    {log.refEntity}
                  </td>

                  <td className="px-4 py-3 text-[#566475] max-w-md">
                    {log.details}
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
