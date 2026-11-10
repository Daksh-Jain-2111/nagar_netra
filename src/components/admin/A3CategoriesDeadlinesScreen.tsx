import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ComplaintCategory } from '../../types';
import { 
  ListOrdered, 
  Search, 
  Filter, 
  Clock, 
  Check, 
  Edit3, 
  Plus, 
  ExternalLink, 
  CheckCircle, 
  SlidersHorizontal,
  Power
} from 'lucide-react';

export const A3CategoriesDeadlinesScreen: React.FC = () => {
  const { 
    categories, 
    updateCategoryDeadline, 
    toggleCategoryActive, 
    addCategory, 
    editCategory 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [showRedirectOnly, setShowRedirectOnly] = useState<boolean>(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editDaysValue, setEditDaysValue] = useState<number>(3);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Filtered categories
  const filteredCategories = categories.filter(c => {
    if (selectedDeptFilter !== 'ALL' && c.departmentId !== selectedDeptFilter && c.department !== selectedDeptFilter) {
      return false;
    }
    if (showRedirectOnly && !c.isRedirectOnly) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match = c.nameEn.toLowerCase().includes(q) ||
        c.nameMr.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleStartEdit = (cat: ComplaintCategory) => {
    setEditingCatId(cat.id);
    setEditDaysValue(cat.resolutionDays || Math.round(cat.slaHours / 24) || 3);
  };

  const handleSaveDays = (catId: string) => {
    updateCategoryDeadline(catId, editDaysValue);
    setEditingCatId(null);
    setActionNotice('Resolution SLA days updated');
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleToggleActive = (catId: string, name: string) => {
    toggleCategoryActive(catId);
    setActionNotice(`Toggled category "${name}"`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            Grievance Categories & SLA Deadlines
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Configure statutory resolution deadlines, emergency SLA clocks and redirection rules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-white px-3 py-1.5 rounded-lg border border-[#D6DFE8] text-[#566475]">
            Total: <strong className="text-[#16212E]">{categories.length}</strong> categories
          </span>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* SLA Policy Summary Box */}
      <div className="p-4 bg-white rounded-xl border border-[#D6DFE8] shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="border-l-4 border-[#0B3D66] pl-3 space-y-1">
          <span className="font-bold text-[#16212E] block">First Action (Response Clock)</span>
          <p className="text-[#566475]">
            48 hours normal (24 hours urgent). Missed clock triggers automatic L1 escalation to DMC/Supervisor.
          </p>
        </div>
        <div className="border-l-4 border-[#1D7A45] pl-3 space-y-1">
          <span className="font-bold text-[#16212E] block">Resolution Deadline</span>
          <p className="text-[#566475]">
            Category-specific statutory days. Field officers must resolve or seek approved target extension before deadline.
          </p>
        </div>
        <div className="border-l-4 border-[#E0681A] pl-3 space-y-1">
          <span className="font-bold text-[#16212E] block">External Agency Redirects</span>
          <p className="text-[#566475]">
            Non-SMKMC issues (MSEDCL 1912, Police 112, NHAI) provide caller script & do not create open municipal tickets.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search category name or department..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#D6DFE8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0B3D66]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-1.5 bg-white text-[#16212E] focus:outline-hidden"
          >
            <option value="ALL">All Departments</option>
            <option value="roads">Roads & Public Works</option>
            <option value="health">Health & Sanitation</option>
            <option value="water">Water Supply</option>
            <option value="electrical">Street Lighting</option>
            <option value="drainage">Drainage & Sewerage</option>
            <option value="encroachment">Anti-Encroachment</option>
            <option value="gardens">Parks & Gardens</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-[#566475] cursor-pointer bg-slate-50 px-2.5 py-1.5 rounded-lg border border-[#D6DFE8]">
            <input
              type="checkbox"
              checked={showRedirectOnly}
              onChange={(e) => setShowRedirectOnly(e.target.checked)}
              className="rounded text-[#0B3D66] focus:ring-[#0B3D66]"
            />
            <span>Show Redirects Only</span>
          </label>
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#D6DFE8] bg-[#F4F7FA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-[#0B3D66]" />
            <h3 className="text-xs font-bold text-[#16212E] uppercase tracking-wider">
              Category Registry ({filteredCategories.length})
            </h3>
          </div>
          <span className="text-[11px] text-[#566475]">Click edit to change statutory SLA days</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                <th className="px-4 py-3">Category Name</th>
                <th className="px-4 py-3">Department (विभाग)</th>
                <th className="px-4 py-3">Resolution SLA</th>
                <th className="px-4 py-3">Handling Mode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DFE8]">
              {filteredCategories.map((cat) => {
                const isEditing = editingCatId === cat.id;
                const isRedirect = cat.isRedirectOnly;

                return (
                  <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#16212E]">{cat.nameEn}</div>
                      <div className="text-[11px] text-[#566475]">{cat.nameMr}</div>
                      {cat.priority === 'urgent' && (
                        <span className="inline-block mt-1 px-1.5 py-0.2 bg-red-100 text-red-700 text-[10px] font-bold rounded">
                          Urgent SLA
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-medium text-[#16212E]">{cat.department}</span>
                      <div className="text-[10px] text-[#566475]">{cat.departmentMr}</div>
                    </td>

                    <td className="px-4 py-3">
                      {isRedirect ? (
                        <span className="text-slate-400 italic">N/A (External)</span>
                      ) : isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={editDaysValue}
                            onChange={(e) => setEditDaysValue(parseInt(e.target.value) || 1)}
                            className="w-16 px-2 py-1 border border-[#0B3D66] rounded text-xs font-bold"
                          />
                          <span className="text-[11px] text-[#566475]">days</span>
                          <button
                            onClick={() => handleSaveDays(cat.id)}
                            className="p-1 bg-[#1D7A45] text-white rounded hover:bg-emerald-700 ml-1"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#16212E] font-mono">
                            {cat.resolutionDays || Math.round(cat.slaHours / 24) || 3} days
                          </span>
                          <span className="text-[10px] text-[#566475]">
                            ({cat.slaHours || 72}h)
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isRedirect ? (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded flex items-center gap-1 w-fit">
                            <ExternalLink className="w-3 h-3" />
                            Redirect: {cat.redirectAgency}
                          </span>
                          <span className="font-mono text-[10px] text-[#0B3D66] block">
                            Tel: {cat.redirectPhone}
                          </span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-50 text-[#0B3D66] text-[10px] font-semibold rounded border border-blue-200">
                          SMKMC Direct Work Queue
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {cat.isActive !== false ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#1D7A45]">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                          Disabled
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right space-x-1">
                      {!isRedirect && (
                        <button
                          onClick={() => handleStartEdit(cat)}
                          className="px-2 py-1 text-[11px] font-semibold text-[#0B3D66] hover:bg-slate-100 rounded border border-[#D6DFE8] transition-colors"
                        >
                          Change SLA
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleActive(cat.id, cat.nameEn)}
                        className={`p-1 rounded transition-colors ${
                          cat.isActive !== false ? 'text-[#1D7A45] hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                        }`}
                        title={cat.isActive !== false ? 'Disable Category' : 'Enable Category'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
