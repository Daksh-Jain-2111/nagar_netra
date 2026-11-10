import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AIModelRegistryItem } from '../../types';
import { 
  Cpu, 
  Layers, 
  CheckCircle, 
  AlertTriangle, 
  ArrowUpRight, 
  RotateCcw,
  Sparkles,
  Smartphone,
  Server,
  Mic
} from 'lucide-react';

export const PAIModelsScreen: React.FC = () => {
  const { 
    aiModelRegistry, 
    platformCorporations, 
    setAIModelForCorporation 
  } = useApp();

  const [selectedModel, setSelectedModel] = useState<AIModelRegistryItem | null>(null);
  const [selectedCorpCode, setSelectedCorpCode] = useState<string>('SMKMC');
  const [notice, setNotice] = useState<string | null>(null);

  const handleDeploy = (modelId: string) => {
    setAIModelForCorporation(modelId, selectedCorpCode);
    setNotice(`Deployed model to corporation "${selectedCorpCode}"`);
    setTimeout(() => setNotice(null), 3500);
  };

  const getModelIcon = (type: string) => {
    switch (type) {
      case 'on_device_image': return Smartphone;
      case 'server_vision': return Server;
      default: return Mic;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            AI Model Registry & Edge Inference Deployment
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Manage vision classification weights, on-device quantized models and civic speech transcription
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-[#D6DFE8] rounded-lg text-[#0B3D66]">
            {aiModelRegistry.length} Registered AI Models
          </span>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {aiModelRegistry.map((model) => {
          const Icon = getModelIcon(model.type);

          return (
            <div key={model.id} className="p-5 bg-white rounded-2xl border border-[#D6DFE8] shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#E0681A]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    model.status === 'Active' ? 'bg-emerald-100 text-[#1D7A45]' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {model.status}
                  </span>
                </div>

                <div className="mt-3">
                  <span className="text-[10px] uppercase font-mono font-bold text-[#566475]">
                    {model.type.replace(/_/g, ' ')}
                  </span>
                  <h3 className="font-bold text-sm text-[#16212E] mt-0.5">
                    {model.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono font-bold text-[#0B3D66]">
                      v{model.version}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-xs space-y-1.5">
                  <span className="text-[10px] font-bold text-[#566475] uppercase block">
                    Deployed to Tenants:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {model.usedByCorporations.map(code => (
                      <span key={code} className="px-2 py-0.5 bg-blue-50 text-[#0B3D66] font-mono text-[10px] font-bold rounded border border-blue-200">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Deployment Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-xs">
                <select
                  value={selectedCorpCode}
                  onChange={(e) => setSelectedCorpCode(e.target.value)}
                  className="px-2 py-1.5 border border-[#D6DFE8] rounded-lg text-xs bg-white flex-1"
                >
                  {platformCorporations.map(c => (
                    <option key={c.code} value={c.code}>{c.code} ({c.nameEn})</option>
                  ))}
                </select>

                <button
                  onClick={() => handleDeploy(model.id)}
                  className="px-3 py-1.5 bg-[#0B3D66] hover:bg-[#093254] text-white rounded-lg font-bold text-xs transition-colors shrink-0"
                >
                  Deploy
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
