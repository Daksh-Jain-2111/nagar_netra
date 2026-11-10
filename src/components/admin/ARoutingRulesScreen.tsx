import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RoutingRule } from '../../types';
import { 
  GitBranch, 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Building2, 
  MapPin, 
  Layers, 
  ShieldCheck,
  HelpCircle
} from 'lucide-react';

export const ARoutingRulesScreen: React.FC = () => {
  const { 
    routingRules, 
    categories, 
    orgUnits, 
    addRoutingRule, 
    deleteRoutingRule, 
    testRoute 
  } = useApp();

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedCatId, setSelectedCatId] = useState<string>(categories[0]?.id || '');
  const [selectedUnitId, setSelectedUnitId] = useState<string>(orgUnits[0]?.id || '');
  const [wardFilterInput, setWardFilterInput] = useState<string>('');
  const [isOverride, setIsOverride] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Test Route Simulator State
  const [testCatId, setTestCatId] = useState<string>(categories[0]?.id || '');
  const [testWard, setTestWard] = useState<number>(12);
  const [testResult, setTestResult] = useState<any | null>(null);

  const handleRunTest = () => {
    const res = testRoute(testCatId, testWard);
    setTestResult(res);
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categories.find(c => c.id === selectedCatId);
    const unit = orgUnits.find(u => u.id === selectedUnitId);

    if (!cat || !unit) return;

    let wardNumbers: number[] | undefined = undefined;
    if (wardFilterInput.trim()) {
      wardNumbers = wardFilterInput
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n));
    }

    const res = addRoutingRule({
      categoryId: cat.id,
      categoryNameEn: cat.nameEn,
      unitId: unit.id,
      unitNameEn: unit.nameEn,
      wardNumbers,
      isOverride
    });

    if (res.success) {
      setNotice(`Added routing rule for "${cat.nameEn}" -> "${unit.nameEn}"`);
      setShowAddModal(false);
      setWardFilterInput('');
      setIsOverride(false);
      setTimeout(() => setNotice(null), 3000);
    } else {
      alert(res.error || 'Failed to add rule');
    }
  };

  const handleDeleteRule = (id: string) => {
    deleteRoutingRule(id);
    setNotice('Routing rule removed');
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            Automated Grievance Routing Engine
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Configure Category-to-Unit dispatch rules with ward-level overrides and test execution
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 bg-[#0B3D66] hover:bg-[#093254] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Routing Rule</span>
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Simulator Section */}
      <div className="p-5 bg-white rounded-xl border border-[#0B3D66]/20 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-[#E0681A]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#16212E]">
              Routing Simulator & Verification Test
            </h3>
          </div>
          <span className="text-[11px] text-[#566475]">Dry-run dispatch logic</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-[#16212E] mb-1">Select Category</label>
            <select
              value={testCatId}
              onChange={(e) => setTestCatId(e.target.value)}
              className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg bg-white"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.nameEn} ({c.department})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#16212E] mb-1">Ward Number (1-20)</label>
            <input
              type="number"
              min="1"
              max="20"
              value={testWard}
              onChange={(e) => setTestWard(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleRunTest}
              className="w-full py-2 bg-[#E0681A] hover:bg-[#c95912] text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simulate Route</span>
            </button>
          </div>
        </div>

        {testResult && (
          <div className="p-4 bg-[#F4F7FA] rounded-xl border border-[#D6DFE8] grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-[#566475] uppercase block">Routed Unit</span>
              <strong className="text-sm text-[#0B3D66] font-bold block mt-0.5">
                {testResult.unit ? testResult.unit.nameEn : 'No direct unit'}
              </strong>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#566475] uppercase block">Assigned Officer</span>
              <strong className="text-xs text-[#16212E] font-semibold block mt-0.5">
                {testResult.officerName}
              </strong>
              <span className="text-[10px] text-[#566475]">{testResult.officerRoleTitle}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#566475] uppercase block">Statutory Clocks</span>
              <div className="text-xs font-mono font-bold text-[#1D7A45] mt-0.5">
                Response: {testResult.responseHours}h · Fix: {testResult.fixDays}d
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#566475] uppercase block">Routing Status</span>
              {testResult.isSupervisorToCheck ? (
                <span className="inline-block mt-0.5 px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                  Goes to TO_CHECK (Needs Review)
                </span>
              ) : testResult.isVacant ? (
                <span className="inline-block mt-0.5 px-2 py-0.5 bg-red-100 text-red-700 rounded font-bold text-[10px]">
                  Vacant Unit Alert
                </span>
              ) : (
                <span className="inline-block mt-0.5 px-2 py-0.5 bg-emerald-100 text-[#1D7A45] rounded font-bold text-[10px]">
                  Direct Auto-Dispatch
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#D6DFE8] bg-[#F4F7FA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#0B3D66]" />
            <h3 className="text-xs font-bold text-[#16212E] uppercase tracking-wider">
              Active Routing Rules Table ({routingRules.length})
            </h3>
          </div>
          <span className="text-[11px] text-[#566475]">Evaluated in priority order</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Target Operating Unit</th>
                <th className="px-4 py-3">Ward Scope</th>
                <th className="px-4 py-3">Rule Type</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DFE8]">
              {routingRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-bold text-[#16212E]">
                    {rule.categoryNameEn}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#0B3D66] flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{rule.unitNameEn}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {rule.wardNumbers && rule.wardNumbers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {rule.wardNumbers.map(w => (
                          <span key={w} className="px-1.5 py-0.2 bg-blue-50 text-[#0B3D66] text-[10px] rounded border border-blue-200">
                            W{w}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#566475] italic text-[11px]">All Corporation Wards</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {rule.isOverride ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                        Special Override
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                        Standard Route
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors"
                      title="Remove rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Add Routing Rule */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#D6DFE8] space-y-4">
            <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-3">
              <h3 className="font-bold text-sm text-[#16212E]">Add Routing Rule</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#16212E] mb-1">Complaint Category</label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg bg-white"
                >
                  {categories.filter(c => !c.isRedirectOnly).map(c => (
                    <option key={c.id} value={c.id}>{c.nameEn} ({c.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#16212E] mb-1">Target Municipal Unit</label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg bg-white"
                >
                  {orgUnits.filter(u => u.acceptsComplaints).map(u => (
                    <option key={u.id} value={u.id}>{u.nameEn} ({u.levelType})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#16212E] mb-1">
                  Ward Filter (Optional comma-separated e.g. 1, 2, 12)
                </label>
                <input
                  type="text"
                  value={wardFilterInput}
                  onChange={(e) => setWardFilterInput(e.target.value)}
                  placeholder="Leave empty for city-wide application"
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="ruleOverride"
                  checked={isOverride}
                  onChange={(e) => setIsOverride(e.target.checked)}
                  className="rounded text-[#0B3D66] focus:ring-[#0B3D66] w-4 h-4"
                />
                <label htmlFor="ruleOverride" className="text-xs font-semibold text-[#16212E] cursor-pointer">
                  Mark as High-Priority Override Rule
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
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
