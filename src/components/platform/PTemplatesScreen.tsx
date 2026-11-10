import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Boxes, 
  CheckCircle, 
  Layers, 
  Copy, 
  ArrowRight,
  ShieldCheck,
  Building2
} from 'lucide-react';

export const PTemplatesScreen: React.FC = () => {
  const { categories, loadMaharashtraTemplateUnits } = useApp();
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  const templatePacks = [
    {
      id: 'maha_standard',
      name: 'Maharashtra Municipal Standard (7 Core Departments)',
      description: 'Standard operational template used by Sangli-Miraj-Kupwad, Solapur and Kolhapur. Covers Roads, Water, Sanitation, Drainage, Electrical, Encroachment and Gardens.',
      departmentsCount: 7,
      categoriesCount: categories.length,
      defaultResponseHours: 48,
      recommendedFor: 'Tier 1 & Tier 2 Municipal Corporations (Maha ULBs)'
    },
    {
      id: 'monsoon_emergency',
      name: 'Monsoon Accelerated Emergency Protocol',
      description: 'Fast-tracked 24-hour response timers for water logging, open manholes, tree falls and flood prone drain clearance.',
      departmentsCount: 4,
      categoriesCount: 6,
      defaultResponseHours: 24,
      recommendedFor: 'June - September Monsoon Operations'
    },
    {
      id: 'solid_waste_focus',
      name: 'Solid Waste & Cleanliness Action Pack',
      description: 'Dedicated waste collection spot monitoring, daily garbage vehicle route failure alerts and commercial market sweeping.',
      departmentsCount: 2,
      categoriesCount: 5,
      defaultResponseHours: 24,
      recommendedFor: 'Swachh Survekshan Audit Drive'
    }
  ];

  const handleApply = (packName: string) => {
    loadMaharashtraTemplateUnits();
    setAppliedNotice(`Template pack "${packName}" synced with active corporation data store.`);
    setTimeout(() => setAppliedNotice(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            Municipal Blueprint Template Packs
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Pre-configured grievance schemas, SLA statutory timers and routing hierarchies for Maharashtra ULBs
          </p>
        </div>
      </div>

      {appliedNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{appliedNotice}</span>
        </div>
      )}

      {/* Packs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templatePacks.map((pack) => (
          <div key={pack.id} className="p-5 bg-white rounded-2xl border border-[#D6DFE8] shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0B3D66]">
                <Boxes className="w-5 h-5" />
              </div>

              <h3 className="font-bold text-sm text-[#16212E] mt-3">
                {pack.name}
              </h3>

              <p className="text-xs text-[#566475] mt-1.5 leading-relaxed">
                {pack.description}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 text-xs space-y-1.5">
                <div className="flex justify-between text-[#566475]">
                  <span>Operational Departments:</span>
                  <strong className="text-[#16212E]">{pack.departmentsCount} Units</strong>
                </div>
                <div className="flex justify-between text-[#566475]">
                  <span>Pre-Configured Categories:</span>
                  <strong className="text-[#16212E]">{pack.categoriesCount} Categories</strong>
                </div>
                <div className="flex justify-between text-[#566475]">
                  <span>Statutory Response Clock:</span>
                  <strong className="text-[#1D7A45] font-mono">{pack.defaultResponseHours}h Max</strong>
                </div>
                <div className="flex justify-between text-[#566475]">
                  <span>Target ULBs:</span>
                  <span className="text-[11px] font-medium text-[#0B3D66]">{pack.recommendedFor}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleApply(pack.name)}
              className="w-full py-2 bg-[#0B3D66] hover:bg-[#093254] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <span>Apply to SMKMC Live Tenant</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
