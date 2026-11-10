import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { Complaint } from '../../types';
import { 
  MapPin, 
  Layers, 
  Filter, 
  ChevronRight, 
  Clock, 
  CheckCircle, 
  Building,
  Navigation
} from 'lucide-react';

export const C10CivicMapExplorerScreen: React.FC = () => {
  const { language, complaints, selectComplaint } = useApp();

  const [activeZone, setActiveZone] = useState<'ALL' | 'SANGLI' | 'MIRAJ' | 'KUPWAD'>('ALL');
  const [activePin, setActivePin] = useState<Complaint | null>(complaints[0] || null);
  const [filterType, setFilterType] = useState<'ALL' | 'waste' | 'road' | 'light'>('ALL');

  const filteredMapComplaints = complaints.filter(c => {
    if (activeZone === 'SANGLI' && !c.address.toLowerCase().includes('sangli')) return false;
    if (activeZone === 'MIRAJ' && !c.address.toLowerCase().includes('miraj')) return false;
    if (activeZone === 'KUPWAD' && !c.address.toLowerCase().includes('kupwad')) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 flex flex-col justify-between">
      <Header 
        title={language === 'mr' ? 'नागरी समस्या नकाशा' : 'Civic Issue Map'} 
        subtitle="सांगली-मिरज-कुपवाड प्रभाग GIS" 
      />

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full p-4 space-y-3">
        {/* Zone Filter Bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'सर्व प्रभाग (All)' },
            { id: 'SANGLI', label: 'सांगली शहर' },
            { id: 'MIRAJ', label: 'मिरज' },
            { id: 'KUPWAD', label: 'कुपवाड' },
          ].map((z) => (
            <button
              key={z.id}
              onClick={() => setActiveZone(z.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors shrink-0 ${
                activeZone === z.id
                  ? 'bg-[#0B3D66] text-white border-[#0B3D66]'
                  : 'bg-white text-[#566475] border-[#D6DFE8] hover:bg-slate-50'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>

        {/* Map Canvas with SVG Geographic Simulation */}
        <div className="relative flex-1 min-h-[340px] bg-[#E8ECEF] rounded-2xl border border-[#D6DFE8] overflow-hidden shadow-xs">
          {/* River Krishna & Municipal Road Network Grid */}
          <div className="absolute inset-0 bg-[#E8ECEF] bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] [background-size:20px_20px]">
            <svg className="w-full h-full opacity-65">
              {/* Krishna River passing through Sangli and Miraj */}
              <path d="M-30 60 Q 180 180 440 90" fill="none" stroke="#93C5FD" strokeWidth="26" />
              {/* Sangli-Miraj Double Road */}
              <line x1="0" y1="160" x2="420" y2="160" stroke="#FFFFFF" strokeWidth="12" />
              <line x1="0" y1="160" x2="420" y2="160" stroke="#94A3B8" strokeWidth="4" />
              {/* Kupwad MIDC connector */}
              <line x1="260" y1="0" x2="310" y2="350" stroke="#FFFFFF" strokeWidth="10" />
              <line x1="260" y1="0" x2="310" y2="350" stroke="#94A3B8" strokeWidth="3" />
            </svg>
          </div>

          {/* Interactive Pins on Map */}
          {filteredMapComplaints.map((c, idx) => {
            // Position pins visually based on coordinates
            const isSelected = activePin?.id === c.id;
            const topOffset = idx === 0 ? '38%' : idx === 1 ? '58%' : idx === 2 ? '24%' : '72%';
            const leftOffset = idx === 0 ? '34%' : idx === 1 ? '68%' : idx === 2 ? '52%' : '40%';

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActivePin(c)}
                style={{ top: topOffset, left: leftOffset }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 p-1 rounded-full transition-transform ${
                  isSelected ? 'scale-125 z-30 ring-4 ring-[#0B3D66]/20' : 'hover:scale-110 z-20'
                }`}
                title={c.trackingNumber}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white ${
                  c.status === 'RESOLVED' || c.status === 'CLOSED'
                    ? 'bg-[#1D7A45]' 
                    : c.status === 'IN_PROGRESS' || c.status === 'WORK_SCHEDULED'
                    ? 'bg-[#0B3D66]' 
                    : 'bg-[#E0681A]'
                }`}>
                  <MapPin className="w-4 h-4 fill-white" />
                </div>
              </button>
            );
          })}

          {/* Map Top Left Badge */}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-[#D6DFE8] text-[10px] font-bold text-[#0B3D66] shadow-2xs">
            {filteredMapComplaints.length} तक्रारी चिन्हांकित
          </div>

          {/* Legend Overlay */}
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs p-2 rounded-lg border border-[#D6DFE8] text-[9px] font-semibold space-y-1 text-[#16212E] shadow-2xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E0681A]" />
              <span>प्रलंबित (Open)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0B3D66]" />
              <span>काम सुरू</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1D7A45]" />
              <span>निवारण संपन्न</span>
            </div>
          </div>
        </div>

        {/* Selected Pin Bottom Info Card */}
        {activePin && (
          <div className="bg-white rounded-xl border border-[#D6DFE8] p-3.5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold text-[#0B3D66]">
                {activePin.trackingNumber}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                activePin.status === 'RESOLVED' || activePin.status === 'CLOSED'
                  ? 'bg-[#1D7A45]/10 text-[#1D7A45]' 
                  : activePin.status === 'IN_PROGRESS' || activePin.status === 'WORK_SCHEDULED'
                  ? 'bg-[#0B3D66] text-white' 
                  : 'bg-[#E0681A]/10 text-[#E0681A]'
              }`}>
                {activePin.status === 'RESOLVED' || activePin.status === 'CLOSED' ? 'निवारण झाले' : (activePin.status === 'IN_PROGRESS' || activePin.status === 'WORK_SCHEDULED') ? 'काम सुरू' : 'प्रलंबित'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={activePin.photoUrls[0]}
                alt="Complaint"
                className="w-14 h-14 rounded-lg object-cover border border-[#D6DFE8] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-[#16212E] truncate">
                  {language === 'mr' ? activePin.categoryNameMr : activePin.categoryNameEn}
                </h4>
                <p className="text-[11px] text-[#566475] truncate mt-0.5">
                  {activePin.landmark || activePin.address}
                </p>
                <p className="text-[10px] text-[#566475]">
                  {activePin.wardName}
                </p>
              </div>
            </div>

            <button
              onClick={() => selectComplaint(activePin.id, 'C8_DETAIL')}
              className="w-full py-2 bg-[#0B3D66] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 hover:bg-[#082d4d] transition-colors"
            >
              <span>{language === 'mr' ? 'तक्रारीचा सविस्तर मागोवा पहा' : 'View Full Details'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
