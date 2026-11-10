import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { StatusChip, EscalationBadge } from '../common/SharedCivicComponents';
import { ComplaintStatus } from '../../types';
import { 
  Search, 
  ChevronRight, 
  MapPin, 
  Plus
} from 'lucide-react';

export const C7ComplaintsListScreen: React.FC = () => {
  const { 
    language, 
    complaints, 
    selectComplaint, 
    navigateTo, 
    currentUser 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'MY' | 'WARD'>('MY');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ComplaintStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredComplaints = complaints.filter((c) => {
    // Status filter
    if (statusFilter !== 'ALL' && c.status !== statusFilter) {
      return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchToken = c.trackingNumber.toLowerCase().includes(q);
      const matchCat = c.categoryNameMr.toLowerCase().includes(q) || c.categoryNameEn.toLowerCase().includes(q);
      const matchAddr = c.address.toLowerCase().includes(q) || c.landmark.toLowerCase().includes(q);
      if (!matchToken && !matchCat && !matchAddr) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 text-[#16212E]">
      <Header 
        title={language === 'mr' ? 'तक्रार निवारण यादी' : 'Complaints List'} 
        subtitle="सांगली-मिरज-कुपवाड महानगरपालिका"
      />

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'mr' ? 'टोकन क्रमांक किंवा पत्ता शोधा...' : 'Search token or address...'}
            className="w-full h-11 pl-10 pr-4 bg-white border border-[#D6DFE8] rounded-xl text-xs placeholder:text-[#566475] focus:outline-none focus:border-[#0B3D66]"
          />
          <Search className="w-4 h-4 text-[#566475] absolute left-3.5 top-3.5" />
        </div>

        {/* Complaints Stream */}
        <div className="space-y-3">
          {filteredComplaints.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#D6DFE8] p-8 text-center space-y-2">
              <p className="text-sm font-bold text-[#16212E]">कोणतीही तक्रार आढळली नाही</p>
              <p className="text-xs text-[#566475]">निवडलेल्या फिल्टरनुसार तक्रारी उपलब्ध नाहीत.</p>
              <button
                onClick={() => navigateTo('C2_MEDIA')}
                className="mt-3 px-4 py-2 bg-[#0B3D66] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>नवीन तक्रार नोंदवा</span>
              </button>
            </div>
          ) : (
            filteredComplaints.map((c) => {
              const isResolved = c.status === 'RESOLVED';

              return (
                <div
                  key={c.id}
                  onClick={() => selectComplaint(c.id, 'C8_DETAIL')}
                  className="bg-white rounded-xl border border-[#D6DFE8] p-3.5 shadow-2xs hover:border-[#0B3D66]/50 transition-all cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-[#0B3D66]">
                      {c.trackingNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {c.escalationLevel && (
                        <EscalationBadge level={c.escalationLevel} reason={c.escalationReason} />
                      )}
                      <StatusChip status={c.status} />
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <img
                      src={isResolved && c.resolvedPhotoUrl ? c.resolvedPhotoUrl : c.photoUrls[0]}
                      alt="Thumbnail"
                      className="w-16 h-16 rounded-lg object-cover border border-[#D6DFE8] shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-bold text-[#16212E] truncate">
                        {language === 'mr' ? c.categoryNameMr : c.categoryNameEn}
                      </h3>
                      <p className="text-[11px] text-[#566475] line-clamp-2 mt-0.5 leading-tight">
                        {c.description}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#566475] mt-1.5">
                        <MapPin className="w-3 h-3 text-[#E0681A] shrink-0" />
                        <span className="truncate">{c.landmark || c.address}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#D6DFE8]/60 text-xs">
                    <span className="text-[10px] text-[#566475]">
                      प्रभाग {c.wardNumber} · {c.wardName}
                    </span>
                    <div className="flex items-center text-[11px] font-bold text-[#0B3D66]">
                      <span>{language === 'mr' ? 'तपशील पहा' : 'View Details'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
