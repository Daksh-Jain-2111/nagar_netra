import React, { useState } from 'react';
import { useApp, SubmitOverrides } from '../../context/AppContext';
import { Header } from '../common/Header';
import { ApiClient, mediaUrl, toComplaintVoiceNote } from '../../services/api';
import { preparePhotosForAI } from '../../utils/imagePrep';
import { t } from '../../utils/l10n';
import { 
  CheckCircle, 
  Send, 
  MapPin, 
  Clock, 
  AlertCircle, 
  Mic, 
  FileText,
  ShieldCheck,
  Building
} from 'lucide-react';

const QUICK_TAGS = [
  'शाळा परिसर (School Zone)',
  'वाहतूक अडथळा (Traffic Block)',
  'तीव्र दुर्गंधी (Foul Odor)',
  'पावसाचे पाणी साचले (Waterlogged)',
  'आरोग्यास धोका (Health Hazard)',
];

export const C5FileComplaintReview: React.FC = () => {
  const { 
    language, 
    draftComplaint, 
    updateDraft, 
    submitDraftComplaint, 
    navigateTo,
    categories
  } = useApp();

  const [description, setDescription] = useState<string>(
    draftComplaint.description ||
    draftComplaint.voiceTranscript ||
    
    'विश्रामबाग मारुती चौकाजवळ मोठ्या प्रमाणावर कचरा साचला असून त्वरित उचल करावी.'
  );
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(draftComplaint.priority || 'high');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localOnly, setLocalOnly] = useState<boolean>(false);

  const handleAddTag = (tag: string) => {
    if (!description.includes(tag)) {
      setDescription(prev => prev ? `${prev} • ${tag}` : tag);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setLocalOnly(false);
    updateDraft({ description, priority });

    const overrides: SubmitOverrides = { description, priority };
    const category = categories.find(c => c.id === draftComplaint.categoryId);
    // Persist the ticket (photos + voice note + transcript) to the backend; department/SLA are decided
    // there. The app store then holds the same ticket id, voice note and stored photos.
    if (!category?.isRedirectOnly) {
      try {
        const { blobs } = await preparePhotosForAI(draftComplaint.photoUrls);
        const created = await ApiClient.createComplaintWithMedia({
          category_id: draftComplaint.categoryId,
          app_category_id: draftComplaint.categoryId,
          description,
          audio_transcript: draftComplaint.voiceNote ? (draftComplaint.voiceTranscript ?? null) : null,
          latitude: draftComplaint.latitude,
          longitude: draftComplaint.longitude,
          address: draftComplaint.address,
          is_anonymous: !!draftComplaint.isAnonymous,
          citizen_confirmed_category: true,
          channel: 'app',
          voice_note_id: draftComplaint.voiceNote?.id ?? null,
          accepted_ai_issue_code: draftComplaint.aiClassification?.acceptedIssueCode ?? null,
        }, blobs);
        overrides.id = created.id;
        if (created.voice_note) overrides.voiceNote = toComplaintVoiceNote(created.voice_note);
        if (created.photo_urls?.length) overrides.photoUrls = created.photo_urls.map((u: string) => mediaUrl(u));
        const serverAI = created.ai_scores?.image_classification;
        if (serverAI?.predictions?.length) {
          overrides.aiAnalysis = {
            source: 'server',
            acceptedIssueCode: created.ai_scores?.citizen_accepted_issue_code ?? null,
            predictions: serverAI.predictions,
          };
        }
      } catch (err) {
        console.warn('[NagarNetra] complaint could not be saved to the server', err);
        setLocalOnly(true);
        await new Promise(r => setTimeout(r, 1800));
      }
    }

    submitDraftComplaint(overrides);
    setIsSubmitting(false);
    navigateTo('C6_SUCCESS');
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24">
      <Header 
        title={language === 'mr' ? 'तक्रार नोंदवा (पायरी ४/४)' : 'Review & Submit (Step 4/4)'} 
        subtitle={language === 'mr' ? 'वर्णन व अंतिम पडताळणी' : 'Details & Submission'}
        showBack
        onBack={() => navigateTo('C4_LOCATION')}
      />

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Step Progress Bar */}
        <div className="flex items-center justify-between text-[11px] font-bold text-[#0B3D66]">
          <span>पायरी ४: वर्णन व सबमिट</span>
          <span>१००% पूर्ण</span>
        </div>
        <div className="w-full bg-[#D6DFE8] h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#0B3D66] h-full w-full rounded-full" />
        </div>

        {/* Description Textarea */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs space-y-3">
          <label className="block text-xs font-bold text-[#16212E]">
            {language === 'mr' ? 'समस्येचे सविस्तर वर्णन (Description)' : 'Problem Description'}
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="येथे सविस्तर वर्णन लिहा (उदा. कचरा कधीपासून साचला आहे, काय त्रास होत आहे...)"
            className="w-full p-3 text-xs font-medium text-[#16212E] border border-[#D6DFE8] rounded-lg focus:border-[#0B3D66] focus:outline-hidden"
          />

          {/* Quick Tags Buttons */}
          <div>
            <p className="text-[11px] text-[#566475] font-semibold mb-1.5">
              द्रुत टॅग जोडा (Quick Tags):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddTag(tag)}
                  className="px-2 py-1 bg-[#F4F7FA] hover:bg-[#0B3D66]/10 text-[10px] font-semibold text-[#0B3D66] rounded-md border border-[#D6DFE8] transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Voice note indicator */}
          {draftComplaint.voiceNoteUrl && (
            <div className="p-2 rounded-lg bg-[#1D7A45]/10 border border-[#1D7A45]/20 flex items-center gap-2 text-xs text-[#1D7A45] font-bold">
              <Mic className="w-4 h-4" />
              <span>आवाज नोंद जोडली आहे ({draftComplaint.voiceDurationSeconds || 0} से.)</span>
            </div>
          )}
        </div>

        {/* Priority Selector */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs space-y-2">
          <label className="block text-xs font-bold text-[#16212E]">
            {language === 'mr' ? 'तीव्रता स्तर (Priority Level)' : 'Priority Level'}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'medium', label: 'सामान्य (Medium)', color: 'border-[#566475] text-[#566475]' },
              { id: 'high', label: 'उच्च (High)', color: 'border-[#A86A0C] text-[#A86A0C]' },
              { id: 'urgent', label: 'तातडीचे (Urgent)', color: 'border-[#B42318] text-[#B42318]' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPriority(p.id as any)}
                className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition-all ${
                  priority === p.id
                    ? 'bg-[#0B3D66] text-white border-[#0B3D66]'
                    : `bg-white ${p.color} hover:bg-slate-50`
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Official Statutory Review Summary Card */}
        <div className="bg-white rounded-xl border-2 border-[#0B3D66] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#D6DFE8] pb-2">
            <h3 className="text-xs font-bold text-[#0B3D66] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0B3D66]" />
              <span>अंतिम पडताळणी सारांश (Official Review)</span>
            </h3>
            <span className="text-[10px] font-bold text-[#1D7A45] bg-[#1D7A45]/10 px-2 py-0.5 rounded">
              कायदेशीर हमी (RTS)
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-3">
              {draftComplaint.photoUrls[0] && (
                <img
                  src={draftComplaint.photoUrls[0]}
                  alt="Thumb"
                  className="w-12 h-12 rounded-lg object-cover border border-[#D6DFE8] shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="font-bold text-[#16212E] truncate">
                  {language === 'mr' ? draftComplaint.categoryNameMr : draftComplaint.categoryNameEn}
                </p>
                <p className="text-[11px] text-[#566475] truncate">
                  {draftComplaint.departmentMr}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#D6DFE8] space-y-1.5 text-[11px]">
              <div className="flex items-start gap-1.5 text-[#16212E]">
                <MapPin className="w-3.5 h-3.5 text-[#E0681A] shrink-0 mt-0.5" />
                <span>
                  <strong>स्थान: </strong>{draftComplaint.landmark}, {draftComplaint.wardName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[#16212E]">
                <Clock className="w-3.5 h-3.5 text-[#0B3D66] shrink-0" />
                <span>
                  <strong>हमी SLA: </strong>४८ तास (महाराष्ट्र लोकसेवा हक्क अधिनियम २०१५)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Complaint Button */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit}
          className="w-full min-h-[50px] bg-[#E0681A] hover:bg-[#c95914] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all"
        >
          {isSubmitting ? (
            <span>तक्रार नोंदवत आहे...</span>
          ) : (
            <>
              <Send className="w-4 h-4 stroke-[2.2]" />
              <span>{language === 'mr' ? 'तक्रार सबमिट करा (Submit Complaint)' : 'Submit Complaint'}</span>
            </>
          )}
        </button>

        {localOnly && (
          <p role="alert" className="p-2.5 rounded-lg bg-[#FFF8E6] border border-[#A86A0C]/50 text-[11px] font-semibold text-[#16212E]">
            {t('submitLocalOnly', language)}
          </p>
        )}

        <p className="text-center text-[11px] text-[#566475]">
          सबमिट केल्यानंतर तात्काळ अधिकृत टोकन क्रमांक व SMS/अ‍ॅप पावती मिळेल.
        </p>
      </div>
    </div>
  );
};
