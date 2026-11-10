import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PlatformCorporation } from '../../types';
import { 
  Building2, 
  Plus, 
  Key, 
  RefreshCw, 
  CheckCircle, 
  ShieldCheck, 
  Cpu, 
  Power,
  Users,
  Copy,
  Check
} from 'lucide-react';

export const P1CorporationsScreen: React.FC = () => {
  const { 
    platformCorporations, 
    createPlatformCorporation, 
    toggleCorporationStatus, 
    regenerateCorporationInvite 
  } = useApp();

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [nameEn, setNameEn] = useState<string>('');
  const [nameMr, setNameMr] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn.trim() || !code.trim()) return;

    const newCode = createPlatformCorporation(nameEn.trim(), nameMr.trim() || nameEn.trim(), code.trim().toUpperCase());
    setNotice(`Created new corporation tenant "${nameEn}" with admin invite code ${newCode}`);
    setShowAddModal(false);
    setNameEn('');
    setNameMr('');
    setCode('');
    setTimeout(() => setNotice(null), 4000);
  };

  const handleRegenInvite = (id: string, name: string) => {
    const newCode = regenerateCorporationInvite(id);
    setNotice(`New admin invite code generated for ${name}: ${newCode}`);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleCopyCode = (id: string, inviteCode: string) => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            Municipal Corporation Tenants
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Multi-corporation provisioning across urban local bodies in Maharashtra
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 bg-[#0B3D66] hover:bg-[#093254] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Provision Corporation</span>
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Corporations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platformCorporations.map((corp) => (
          <div key={corp.id} className="p-5 bg-white rounded-2xl border border-[#D6DFE8] shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 text-[#0B3D66]">
                    {corp.code}
                  </span>
                  <h3 className="font-bold text-sm text-[#16212E] mt-1">
                    {corp.nameEn}
                  </h3>
                  <p className="text-xs text-[#566475]">{corp.nameMr}</p>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  corp.status === 'Live' ? 'bg-emerald-100 text-[#1D7A45]' :
                  corp.status === 'Draft' ? 'bg-amber-100 text-amber-800' :
                  'bg-red-100 text-red-700'
                }`}>
                  {corp.status}
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 py-3 my-3 border-y border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] text-[#566475] block">Units</span>
                  <strong className="text-sm text-[#16212E]">{corp.unitsCount}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#566475] block">Officers</span>
                  <strong className="text-sm text-[#16212E]">{corp.officersCount}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#566475] block">Volume</span>
                  <strong className="text-sm text-[#0B3D66]">{corp.complaintsThisMonth}</strong>
                </div>
              </div>

              {/* AI & Invite */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-[#566475]">
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-[#E0681A]" />
                    <span>AI Model:</span>
                  </span>
                  <strong className="font-mono text-[#16212E]">{corp.aiModelVersion}</strong>
                </div>

                {corp.adminInviteCode && (
                  <div className="p-2 bg-slate-50 rounded-lg border border-[#D6DFE8] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#566475] block">Admin Invite Code</span>
                      <strong className="font-mono text-xs text-[#0B3D66] font-bold">
                        {corp.adminInviteCode}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyCode(corp.id, corp.adminInviteCode!)}
                        className="p-1 text-slate-500 hover:text-[#0B3D66] rounded"
                        title="Copy Code"
                      >
                        {copiedCodeId === corp.id ? <Check className="w-3.5 h-3.5 text-[#1D7A45]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleRegenInvite(corp.id, corp.nameEn)}
                        className="p-1 text-slate-500 hover:text-[#0B3D66] rounded"
                        title="Regenerate Code"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-[10px] text-slate-400">
                Created: {new Date(corp.createdAt).toLocaleDateString('en-IN')}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleCorporationStatus(
                    corp.id,
                    corp.status === 'Live' ? 'Suspended' : 'Live'
                  )}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                    corp.status === 'Live'
                      ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'bg-emerald-50 text-[#1D7A45] hover:bg-emerald-100'
                  }`}
                >
                  {corp.status === 'Live' ? 'Suspend' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal to Provision Corporation */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#D6DFE8] space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#D6DFE8] pb-3">
              <h3 className="font-bold text-sm text-[#16212E]">Provision New Corporation Tenant</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold text-[#16212E] mb-1">Corporation Name (English)</label>
                <input
                  type="text"
                  required
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Kolhapur Municipal Corporation"
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg focus:ring-2 focus:ring-[#0B3D66] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-[#16212E] mb-1">Corporation Name (Marathi)</label>
                <input
                  type="text"
                  value={nameMr}
                  onChange={(e) => setNameMr(e.target.value)}
                  placeholder="उदा. कोल्हापूर महानगरपालिका"
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg focus:ring-2 focus:ring-[#0B3D66] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-[#16212E] mb-1">Corporation Short Code (e.g. KMC)</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. KMC"
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg font-mono uppercase"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#D6DFE8]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#D6DFE8] rounded-lg text-[#566475]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0B3D66] text-white rounded-lg font-bold hover:bg-[#093254]"
                >
                  Provision Corporation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
