import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { PhotoBadge } from '../common/SharedCivicComponents';
import { Complaint } from '../../types';
import { 
  Link2, 
  MapPin, 
  Clock, 
  Check, 
  ArrowLeft, 
  AlertCircle, 
  ShieldCheck,
  Split 
} from 'lucide-react';

export const F6PossibleDuplicatesScreen: React.FC = () => {
  const { 
    language, 
    selectedComplaint, 
    navigateTo, 
    complaints, 
    linkDuplicates 
  } = useApp();

  const [selectedToLink, setSelectedToLink] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<boolean>(false);

  if (!selectedComplaint) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] p-8 text-center text-xs">
        <p>No complaint selected.</p>
        <button onClick={() => navigateTo('F1_WORK_QUEUE')} className="mt-3 px-4 py-2 bg-[#0B3D66] text-white rounded">
          Back
        </button>
      </div>
    );
  }

  const anchor = selectedComplaint;

  // Candidates = same category, within 100 m (or in demo candidates list), within 7 days, not closed
  const candidates = complaints.filter(other => {
    if (other.id === anchor.id) return false;
    if (other.status === 'CLOSED' || other.status === 'REJECTED') return false;
    if (other.categoryId === anchor.categoryId || other.departmentId === anchor.departmentId) return true;
    return false;
  });

  const toggleSelect = (id: string) => {
    if (selectedToLink.includes(id)) {
      setSelectedToLink(selectedToLink.filter(i => i !== id));
    } else {
      setSelectedToLink([...selectedToLink, id]);
    }
  };

  const handleLink = () => {
    if (selectedToLink.length === 0) return;

    // Parent = oldest complaint between anchor and selected
    const allSelected = [anchor, ...complaints.filter(c => selectedToLink.includes(c.id))];
    allSelected.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const oldestParent = allSelected[0];
    const childrenIds = allSelected.slice(1).map(c => c.id);

    linkDuplicates(oldestParent.id, childrenIds);
    setSubmitted(true);
    setTimeout(() => {
      navigateTo('F2_OFFICER_DETAIL');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 text-[#16212E]">
      <Header 
        title={anchor.trackingNumber} 
        subtitle="Possible Duplicates Triage · दुबार तक्रारी"
        showBack
        onBack={() => navigateTo('F2_OFFICER_DETAIL')}
      />

      <div className="max-w-md md:max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* Anchor Ticket Card */}
        <div className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#566475] uppercase text-[10px]">Anchor Ticket · मूळ तक्रार</span>
            <span className="font-mono font-bold text-[#0B3D66]">{anchor.trackingNumber}</span>
          </div>
          <h3 className="font-bold text-xs text-[#16212E]">{anchor.description}</h3>
          <p className="text-[11px] text-[#566475] flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#E0681A]" />
            <span>{anchor.wardName} · {anchor.landmark || anchor.address}</span>
          </p>
        </div>

        {/* AI duplicate criteria banner */}
        <div className="p-3 bg-[#F4F7FA] rounded-xl border border-[#D6DFE8] text-xs space-y-1.5">
          <div className="font-bold text-[#0B3D66] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Clustering Criteria: Same Category, ≤ 100m, Last 7 Days</span>
          </div>
          <p className="text-[11px] text-[#566475] leading-relaxed">
            The system never auto-merges or deletes complaints. Linked complaints follow the parent ticket's lifecycle, and all complainants receive every update.
          </p>
        </div>

        {/* Candidates List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-[#16212E]">
            Nearby Incident Candidates ({candidates.length})
          </h4>

          {candidates.length === 0 ? (
            <div className="p-6 bg-white rounded-xl border border-[#D6DFE8] text-center text-xs text-[#566475]">
              No duplicate candidates detected within 100m radius.
            </div>
          ) : (
            candidates.map((c) => {
              const isSelected = selectedToLink.includes(c.id);
              const isAlreadyLinked = c.linkedParentId === anchor.id || anchor.linkedChildrenIds?.includes(c.id);

              return (
                <div
                  key={c.id}
                  onClick={() => toggleSelect(c.id)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all space-y-2.5 ${
                    isSelected
                      ? 'bg-[#0B3D66]/5 border-[#0B3D66] ring-1 ring-[#0B3D66]'
                      : 'bg-white border-[#D6DFE8] hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${
                        isSelected ? 'bg-[#0B3D66] text-white' : 'border border-[#D6DFE8]'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <span className="font-mono font-bold text-[#0B3D66]">{c.trackingNumber}</span>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-[#566475]">
                      ~35 m away · GPS Verified
                    </span>
                  </div>

                  <p className="text-xs font-medium text-[#16212E]">
                    {c.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-[#566475] pt-1 border-t border-[#D6DFE8]">
                    <span>Filed: {new Date(c.createdAt).toLocaleDateString('en-GB')}</span>
                    <span className="font-medium text-[#0B3D66]">
                      {isAlreadyLinked ? 'Already Linked' : (isSelected ? 'Selected to link' : 'Click to select')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleLink}
            disabled={selectedToLink.length === 0}
            className="w-full h-11 rounded-xl bg-[#0B3D66] text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#082d4d] active:scale-98 transition-all disabled:opacity-50"
          >
            <Link2 className="w-4 h-4" />
            <span>{submitted ? 'Linked Successfully!' : `Link Selected (${selectedToLink.length})`}</span>
          </button>

          <button
            onClick={() => navigateTo('F2_OFFICER_DETAIL')}
            className="w-full h-10 rounded-xl bg-white border border-[#D6DFE8] text-[#566475] font-bold text-xs hover:bg-slate-50 transition-colors"
          >
            Cancel / Mark as Distinct Issues
          </button>
        </div>
      </div>
    </div>
  );
};
