import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Phone, 
  User, 
  Calendar, 
  Star, 
  AlertCircle, 
  Share2, 
  Check, 
  Sparkles,
  RotateCcw
} from 'lucide-react';

export const C8ComplaintDetailScreen: React.FC = () => {
  const { 
    language, 
    selectedComplaint, 
    navigateTo, 
    selectComplaint, 
    reopenComplaint,
    userRole 
  } = useApp();

  const [activePhotoTab, setActivePhotoTab] = useState<'BEFORE' | 'AFTER'>('BEFORE');
  const [reopenReason, setReopenReason] = useState<string>('');
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [shareSuccess, setShareSuccess] = useState<boolean>(false);

  if (!selectedComplaint) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] p-8 text-center">
        <p>तक्रार सापडली नाही.</p>
        <button onClick={() => navigateTo('C7_COMPLAINTS')} className="mt-3 px-4 py-2 bg-[#0B3D66] text-white rounded">
          मागे जा
        </button>
      </div>
    );
  }

  const isResolved = selectedComplaint.status === 'RESOLVED' || selectedComplaint.status === 'CLOSED';

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `NagarNetra Complaint: ${selectedComplaint.trackingNumber}`,
        text: `SMKMC Complaint ${selectedComplaint.trackingNumber} - ${selectedComplaint.categoryNameMr}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(selectedComplaint.trackingNumber);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    }
  };

  const handleConfirmReopen = () => {
    if (!reopenReason.trim()) return;
    reopenComplaint(selectedComplaint.id, reopenReason);
    setShowReopenModal(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24">
      <Header 
        title={selectedComplaint.trackingNumber} 
        subtitle={language === 'mr' ? selectedComplaint.categoryNameMr : selectedComplaint.categoryNameEn}
        showBack
        onBack={() => navigateTo('C7_COMPLAINTS')}
      />

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Top Status Banner */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          isResolved 
            ? 'bg-[#1D7A45]/10 border-[#1D7A45]/30 text-[#1D7A45]' 
            : 'bg-[#0B3D66]/5 border-[#0B3D66]/20 text-[#0B3D66]'
        }`}>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block">
              {language === 'mr' ? 'सद्यस्थिती (Current Status)' : 'Current Status'}
            </span>
            <h3 className="text-sm font-bold flex items-center gap-1.5 mt-0.5">
              {isResolved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#1D7A45]" />
                  <span>निवारण संपन्न (Resolved & Verified)</span>
                </>
              ) : selectedComplaint.status === 'IN_PROGRESS' || selectedComplaint.status === 'WORK_SCHEDULED' ? (
                <>
                  <Clock className="w-4 h-4 text-[#0B3D66]" />
                  <span>प्रत्यक्ष काम सुरू (In Progress)</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-[#A86A0C]" />
                  <span>प्रलंबित (Open & Assigned)</span>
                </>
              )}
            </h3>
          </div>

          <button
            onClick={handleShare}
            className="p-2 bg-white rounded-lg border border-[#D6DFE8] text-[#0B3D66] hover:bg-slate-50 transition-colors"
            title="Share"
          >
            {shareSuccess ? <Check className="w-4 h-4 text-[#1D7A45]" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Photos: Before & After comparison tabs */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-3.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#16212E]">
              {isResolved ? 'आधी व नंतरचा फोटो पुरावा (Before & After)' : 'समस्येचे छायाचित्र'}
            </h3>
            {isResolved && selectedComplaint.resolvedPhotoUrl && (
              <div className="flex rounded-md bg-[#F4F7FA] p-0.5 border border-[#D6DFE8]">
                <button
                  onClick={() => setActivePhotoTab('BEFORE')}
                  className={`px-2 py-1 text-[10px] font-bold rounded ${
                    activePhotoTab === 'BEFORE' ? 'bg-[#0B3D66] text-white' : 'text-[#566475]'
                  }`}
                >
                  आधी (Before)
                </button>
                <button
                  onClick={() => setActivePhotoTab('AFTER')}
                  className={`px-2 py-1 text-[10px] font-bold rounded ${
                    activePhotoTab === 'AFTER' ? 'bg-[#1D7A45] text-white' : 'text-[#566475]'
                  }`}
                >
                  नंतर (Resolved)
                </button>
              </div>
            )}
          </div>

          <div className="relative aspect-video rounded-xl overflow-hidden border border-[#D6DFE8] bg-black">
            <img
              src={
                isResolved && activePhotoTab === 'AFTER' && selectedComplaint.resolvedPhotoUrl
                  ? selectedComplaint.resolvedPhotoUrl
                  : selectedComplaint.photoUrls[0]
              }
              alt="Complaint Evidence"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-xs">
              {isResolved && activePhotoTab === 'AFTER'
                ? 'स्वच्छता पथकाने अपलोड केलेला निवारण फोटो'
                : 'नागरिकाने नोंदवलेला मूळ फोटो'}
            </div>
          </div>
        </div>

        {/* Complaint Details Card */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs space-y-3 text-xs">
          <div>
            <h3 className="font-bold text-[#16212E] text-sm">
              {language === 'mr' ? selectedComplaint.categoryNameMr : selectedComplaint.categoryNameEn}
            </h3>
            <p className="text-[12px] text-[#566475] mt-1 leading-relaxed">
              {selectedComplaint.description}
            </p>
          </div>

          <div className="pt-2 border-t border-[#D6DFE8] space-y-2 text-[11px] text-[#16212E]">
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#E0681A] shrink-0 mt-0.5" />
              <span>
                <strong>स्थान: </strong>{selectedComplaint.landmark}, {selectedComplaint.address}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#0B3D66] shrink-0" />
              <span>
                <strong>नोंदणी वेळ: </strong>{new Date(selectedComplaint.createdAt).toLocaleDateString('mr-IN')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#E0681A] shrink-0" />
              <span>
                <strong>हमी SLA: </strong>४८ तास (महाराष्ट्र लोकसेवा हक्क अधिनियम २०१५)
              </span>
            </div>
          </div>
        </div>

        {/* Department Assigned Card */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-3.5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0B3D66]/10 text-[#0B3D66] flex items-center justify-center font-bold shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-[#566475] font-semibold">नियुक्त विभाग कार्यालय:</p>
              <h4 className="text-xs font-bold text-[#16212E]">
                {selectedComplaint.departmentMr || selectedComplaint.department}
              </h4>
              <p className="text-[10px] text-[#566475]">
                प्रभाग {selectedComplaint.wardNumber} · {selectedComplaint.wardName}
              </p>
            </div>
          </div>

          <a
            href="tel:02332373455"
            className="p-2.5 rounded-lg bg-[#0B3D66] text-white hover:bg-[#082d4d] transition-colors"
            title="SMKMC Helpline"
          >
            <Phone className="w-4 h-4" />
          </a>
        </div>

        {/* Step-by-Step Lifecycle Progress Timeline */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-[#0B3D66] flex items-center gap-1.5 border-b border-[#D6DFE8] pb-2">
            <Clock className="w-4 h-4" />
            <span>तक्रार निवारण जीवनचक्र (Resolution Timeline)</span>
          </h3>

          <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#D6DFE8]">
            {selectedComplaint.timeline.map((step, idx) => {
              const isResolvedStep = step.status === 'RESOLVED';

              return (
                <div key={idx} className="relative">
                  {/* Step Dot */}
                  <span className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                    isResolvedStep 
                      ? 'bg-[#1D7A45] ring-2 ring-[#1D7A45]/30' 
                      : 'bg-[#0B3D66]'
                  }`} />

                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#16212E]">
                        {language === 'mr' ? step.titleMr : step.titleEn}
                      </h4>
                      <span className="text-[9px] text-[#566475] font-mono">
                        {step.timestamp}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#566475] mt-0.5">
                      {step.actorName} ({step.actorRole})
                    </p>

                    {step.comment && (
                      <div className="mt-1.5 p-2 rounded bg-[#F4F7FA] border border-[#D6DFE8]/60 text-[11px] text-[#16212E]">
                        {step.comment}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Citizen Rating Card (If rated) or Rate CTA Button */}
        {isResolved && selectedComplaint.rating ? (
          <div className="bg-[#1D7A45]/10 border border-[#1D7A45]/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1D7A45] flex items-center gap-1">
                <Star className="w-4 h-4 fill-[#1D7A45]" />
                <span>नागरिक समाधान अभिप्राय (Rating Given)</span>
              </span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${
                      s <= selectedComplaint.rating!.stars ? 'text-[#E0681A] fill-[#E0681A]' : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-[#16212E] italic">
              "{selectedComplaint.rating.comment || 'समाधानकारक काम झाले.'}"
            </p>
          </div>
        ) : isResolved ? (
          <div className="space-y-2">
            <button
              onClick={() => selectComplaint(selectedComplaint.id, 'C9_RATE')}
              className="w-full min-h-[46px] bg-[#1D7A45] hover:bg-[#155d34] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Star className="w-4 h-4 fill-white" />
              <span>{language === 'mr' ? 'कामाचे मूल्यमापन व अभिप्राय द्या (Rate Service)' : 'Rate Civic Service'}</span>
            </button>

            {/* Re-open option within 48h */}
            <button
              onClick={() => setShowReopenModal(true)}
              className="w-full py-2 bg-white border border-[#B42318] text-[#B42318] text-xs font-bold rounded-xl hover:bg-[#B42318]/5 transition-colors flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>काम नीट झाले नाही? तक्रार पुन्हा उघडा (Re-open)</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Reopen Complaint Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-[#D6DFE8] shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-[#B42318] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>तक्रार पुन्हा उघडा (Re-open Ticket)</span>
            </h3>
            <p className="text-xs text-[#566475]">
              कृपया काम अपूर्ण असण्याचे कारण सांगा. हे थेट वरिष्ठ अधिकाऱ्यांकडे वर्ग केले जाईल.
            </p>
            <textarea
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="उदा. कचरा पूर्ण उचलला नाही, दुर्गंधी अजूनही आहे..."
              className="w-full p-2.5 text-xs border border-[#D6DFE8] rounded-lg focus:border-[#B42318] focus:outline-hidden"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setShowReopenModal(false)}
                className="py-2 bg-slate-100 text-xs font-bold text-[#566475] rounded-lg hover:bg-slate-200"
              >
                रद्द करा
              </button>
              <button
                disabled={!reopenReason.trim()}
                onClick={handleConfirmReopen}
                className="py-2 bg-[#B42318] text-white text-xs font-bold rounded-lg hover:bg-[#8e1b12] disabled:opacity-50"
              >
                तक्रार पुन्हा उघडा
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
