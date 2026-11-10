import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { OrgUnit } from '../../types';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit2, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  FolderTree,
  ShieldCheck
} from 'lucide-react';

export const A2OrganisationScreen: React.FC = () => {
  const { 
    orgUnits, 
    addOrgUnit, 
    updateOrgUnit, 
    deleteOrgUnit, 
    loadMaharashtraTemplateUnits,
    users,
    currentUser
  } = useApp();

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Form states
  const [nameEn, setNameEn] = useState<string>('');
  const [nameMr, setNameMr] = useState<string>('');
  const [levelType, setLevelType] = useState<string>('Department Office');
  const [parentId, setParentId] = useState<string>('');
  const [acceptsComplaints, setAcceptsComplaints] = useState<boolean>(true);
  const [activeOfficerId, setActiveOfficerId] = useState<string>('');
  const [backupOfficerId, setBackupOfficerId] = useState<string>('');

  const officers = users.filter(u => u.role === 'officer');
  const supervisors = users.filter(u => u.role === 'supervisor');

  const handleOpenAdd = () => {
    setEditingUnitId(null);
    setNameEn('');
    setNameMr('');
    setLevelType('Department Office');
    setParentId('');
    setAcceptsComplaints(true);
    setActiveOfficerId('');
    setBackupOfficerId('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (unit: OrgUnit) => {
    setEditingUnitId(unit.id);
    setNameEn(unit.nameEn);
    setNameMr(unit.nameMr);
    setLevelType(unit.levelType);
    setParentId(unit.parentId || '');
    setAcceptsComplaints(unit.acceptsComplaints);
    setActiveOfficerId(unit.activeOfficerId || '');
    setBackupOfficerId(unit.backupOfficerId || '');
    setShowAddModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn.trim()) return;

    if (editingUnitId) {
      updateOrgUnit(editingUnitId, {
        nameEn,
        nameMr: nameMr || nameEn,
        levelType,
        parentId: parentId || null,
        acceptsComplaints,
        activeOfficerId: activeOfficerId || undefined,
        backupOfficerId: backupOfficerId || undefined
      });
      setActionMessage(`Updated organization unit "${nameEn}"`);
    } else {
      addOrgUnit({
        nameEn,
        nameMr: nameMr || nameEn,
        levelType,
        parentId: parentId || null,
        acceptsComplaints,
        activeOfficerId: activeOfficerId || undefined,
        backupOfficerId: backupOfficerId || undefined
      });
      setActionMessage(`Added new organization unit "${nameEn}"`);
    }

    setShowAddModal(false);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleDelete = (id: string, name: string) => {
    const res = deleteOrgUnit(id);
    if (!res.success) {
      alert(res.error || 'Cannot delete unit');
    } else {
      setActionMessage(`Deleted unit "${name}"`);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            Municipal Organisation & Unit Structure
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Configure hierarchy, operational departments, field offices and officer assignments
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadMaharashtraTemplateUnits}
            className="px-3 py-1.5 bg-white border border-[#D6DFE8] hover:bg-slate-50 text-xs font-semibold text-[#16212E] rounded-lg flex items-center gap-1.5 transition-colors"
            title="Reload standard Maharashtra municipal department template"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#566475]" />
            <span>Load Standard Template</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 bg-[#0B3D66] hover:bg-[#093254] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Org Unit</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <span className="text-[11px] font-bold text-[#566475] uppercase">Total Municipal Units</span>
          <div className="text-2xl font-black text-[#0B3D66] mt-1">{orgUnits.length}</div>
          <span className="text-[10px] text-[#566475]">HQ, divisions, and operating branches</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <span className="text-[11px] font-bold text-[#566475] uppercase">Accepts Public Grievances</span>
          <div className="text-2xl font-black text-[#1D7A45] mt-1">
            {orgUnits.filter(u => u.acceptsComplaints).length}
          </div>
          <span className="text-[10px] text-[#566475]">Targeted in routing table</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
          <span className="text-[11px] font-bold text-[#566475] uppercase">Officers Attached</span>
          <div className="text-2xl font-black text-[#E0681A] mt-1">
            {orgUnits.filter(u => u.activeOfficerId).length}
          </div>
          <span className="text-[10px] text-[#566475]">Active primary field officers</span>
        </div>
      </div>

      {/* Units Table */}
      <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#D6DFE8] bg-[#F4F7FA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-[#0B3D66]" />
            <h3 className="text-xs font-bold text-[#16212E] uppercase tracking-wider">
              Organization Directory
            </h3>
          </div>
          <span className="text-[11px] text-[#566475]">{orgUnits.length} units listed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                <th className="px-4 py-3">Unit Name & Level</th>
                <th className="px-4 py-3">Marathi Name</th>
                <th className="px-4 py-3">Complaint Routing</th>
                <th className="px-4 py-3">Primary Officer</th>
                <th className="px-4 py-3">Backup Coverage</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DFE8]">
              {orgUnits.map((unit) => {
                const primaryOfficer = users.find(u => u.id === unit.activeOfficerId);
                const backupOfficer = users.find(u => u.id === unit.backupOfficerId);

                return (
                  <tr key={unit.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#16212E] flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#0B3D66]" />
                        <span>{unit.nameEn}</span>
                      </div>
                      <span className="inline-block mt-0.5 px-2 py-0.2 rounded bg-slate-100 text-[10px] text-[#566475]">
                        {unit.levelType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {unit.nameMr}
                    </td>
                    <td className="px-4 py-3">
                      {unit.acceptsComplaints ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#1D7A45] flex items-center gap-1 w-fit">
                          <CheckCircle className="w-3 h-3" />
                          Accepts
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                          Non-routing HQ
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {primaryOfficer ? (
                        <div>
                          <span className="font-semibold text-[#16212E]">{primaryOfficer.name}</span>
                          {primaryOfficer.isOnLeave && (
                            <span className="ml-1.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] rounded font-medium">
                              On Leave
                            </span>
                          )}
                          <div className="text-[10px] text-[#566475]">{primaryOfficer.roleTitle || 'Field Officer'}</div>
                        </div>
                      ) : (
                        <span className="text-amber-700 italic text-[11px]">Unassigned (Vacant)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {backupOfficer ? (
                        <span className="text-[#16212E] font-medium">{backupOfficer.name}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(unit)}
                        className="p-1 hover:bg-slate-100 rounded text-[#0B3D66] transition-colors"
                        title="Edit unit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(unit.id, unit.nameEn)}
                        className="p-1 hover:bg-red-50 rounded text-red-600 transition-colors"
                        title="Delete unit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Add / Edit */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#D6DFE8] space-y-4">
            <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-3">
              <h3 className="font-bold text-sm text-[#16212E]">
                {editingUnitId ? 'Edit Organization Unit' : 'Add New Organization Unit'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#16212E] mb-1">Unit Name (English)</label>
                <input
                  type="text"
                  required
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Public Works Department (Roads)"
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg focus:ring-2 focus:ring-[#0B3D66] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-[#16212E] mb-1">Unit Name (Marathi)</label>
                <input
                  type="text"
                  value={nameMr}
                  onChange={(e) => setNameMr(e.target.value)}
                  placeholder="उदा. सार्वजनिक बांधकाम विभाग (रस्ते)"
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg focus:ring-2 focus:ring-[#0B3D66] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#16212E] mb-1">Level Type</label>
                  <select
                    value={levelType}
                    onChange={(e) => setLevelType(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg bg-white"
                  >
                    <option value="Headquarters">Headquarters</option>
                    <option value="Department Office">Department Office</option>
                    <option value="Divisional Office">Divisional Office</option>
                    <option value="Field Section">Field Section</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#16212E] mb-1">Parent Unit</label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg bg-white"
                  >
                    <option value="">None (Top Level)</option>
                    {orgUnits.filter(u => u.id !== editingUnitId).map(u => (
                      <option key={u.id} value={u.id}>{u.nameEn}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#16212E] mb-1">Primary Officer</label>
                  <select
                    value={activeOfficerId}
                    onChange={(e) => setActiveOfficerId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg bg-white"
                  >
                    <option value="">Vacant / None</option>
                    {officers.map(o => (
                      <option key={o.id} value={o.id}>{o.name} ({o.department || 'Officer'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#16212E] mb-1">Backup Officer</label>
                  <select
                    value={backupOfficerId}
                    onChange={(e) => setBackupOfficerId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg bg-white"
                  >
                    <option value="">None</option>
                    {officers.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="acceptsComp"
                  checked={acceptsComplaints}
                  onChange={(e) => setAcceptsComplaints(e.target.checked)}
                  className="rounded text-[#0B3D66] focus:ring-[#0B3D66] w-4 h-4"
                />
                <label htmlFor="acceptsComp" className="text-xs font-semibold text-[#16212E] cursor-pointer">
                  Accepts civic complaints for automatic / manual routing
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-[#D6DFE8]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#D6DFE8] rounded-lg text-xs font-semibold text-[#566475] hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0B3D66] text-white rounded-lg text-xs font-semibold hover:bg-[#093254]"
                >
                  Save Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
