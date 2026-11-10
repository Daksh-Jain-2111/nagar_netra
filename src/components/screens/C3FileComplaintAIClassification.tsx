import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { AIIssueAnalysisCard, AIAnalysisState } from '../common/AIIssueAnalysisCard';
import { ApiClient, ApiError } from '../../services/api';
import { preparePhotosForAI, photoSetKey } from '../../utils/imagePrep';
import { CivicIssueClassificationResult, CivicIssuePrediction, ComplaintCategory, DraftAIClassification } from '../../types';
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight, 
  ThumbsUp, 
  ChevronRight,
  Trash2,
  Construction,
  Lightbulb,
  Waves,
  Droplet,
  AlertOctagon,
  Dog,
  ShieldAlert
} from 'lucide-react';

export const C3FileComplaintAIClassification: React.FC = () => {
  const { language, draftComplaint, updateDraft, navigateTo, selectComplaint, categories } = useApp();

  const [selectedCatId, setSelectedCatId] = useState<string>(draftComplaint.categoryId || 'solid_waste');
  const [duplicateDismissed, setDuplicateDismissed] = useState<boolean>(false);

  const selectableCategories = categories.filter(c => c.isActive !== false);

  // --- AI image classification ------------------------------------------------------------
  const photoKey = photoSetKey(draftComplaint.photoUrls);
  const cachedAI = draftComplaint.aiClassification?.photoKey === photoKey ? draftComplaint.aiClassification : undefined;
  const [aiState, setAiState] = useState<AIAnalysisState>(
    cachedAI?.result ? { phase: 'result', result: cachedAI.result, skippedPhotos: 0 } : { phase: 'loading' },
  );
  const [acceptedRank, setAcceptedRank] = useState<number | null>(cachedAI?.acceptedRank ?? null);
  const aiResultRef = useRef<CivicIssueClassificationResult | null>(cachedAI?.result ?? null);
  const abortRef = useRef<AbortController | null>(null);

  const categoryForPrediction = (p: CivicIssuePrediction): ComplaintCategory | undefined =>
    p.app_category_id ? selectableCategories.find(c => c.id === p.app_category_id) : undefined;

  const saveAIToDraft = (patch: Partial<DraftAIClassification>, category?: ComplaintCategory) => {
    const base: DraftAIClassification = draftComplaint.aiClassification?.photoKey === photoKey
      ? draftComplaint.aiClassification
      : { photoKey, result: null, acceptedRank: null, acceptedIssueCode: null, acceptedConfidence: null };
    const ai = { ...base, ...patch };
    updateDraft({
      aiClassification: ai,
      routeChannel: ai.acceptedRank != null ? 'AI' : 'citizen choice',
      ...(category ? {
        categoryId: category.id,
        categoryNameMr: category.nameMr,
        categoryNameEn: category.nameEn,
        departmentMr: category.departmentMr,
        departmentEn: category.department,
        departmentId: category.departmentId,
      } : {}),
    });
  };

  const acceptPrediction = (p: CivicIssuePrediction, result = aiResultRef.current) => {
    const cat = categoryForPrediction(p);
    if (!cat || !result) return;
    setSelectedCatId(cat.id);
    setAcceptedRank(p.rank);
    saveAIToDraft({ result, acceptedRank: p.rank, acceptedIssueCode: p.issue_code, acceptedConfidence: p.confidence }, cat);
  };

  const runAnalysis = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAiState({ phase: 'loading' });
    try {
      if (draftComplaint.photoUrls.length === 0) throw new ApiError('No photo', 400, 'NO_IMAGE');
      const { blobs, skipped } = await preparePhotosForAI(draftComplaint.photoUrls, controller.signal);
      if (blobs.length === 0) throw new ApiError('Photos unreadable', 400, 'PHOTO_UNREADABLE');
      const result = await ApiClient.classifyComplaintImages(
        blobs,
        {
          description: draftComplaint.description || undefined,
          voiceTranscript: draftComplaint.voiceTranscript,
          latitude: draftComplaint.latitude,
          longitude: draftComplaint.longitude,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      aiResultRef.current = result;
      setAiState({ phase: 'result', result, skippedPhotos: skipped.length });
      const top = result.predictions[0];
      if (result.status === 'success' && top?.recommended && categoryForPrediction(top)) {
        acceptPrediction(top, result); // pre-select the recommendation; the citizen can change it
      } else {
        setAcceptedRank(null);
        saveAIToDraft({ result, acceptedRank: null, acceptedIssueCode: null, acceptedConfidence: null });
      }
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === 'AbortError') return;
      const code = err instanceof ApiError && err.code ? err.code : 'AI_UNAVAILABLE';
      console.warn('[NagarNetra AI] classification failed:', code, err?.message);
      aiResultRef.current = null;
      setAcceptedRank(null);
      setAiState({ phase: 'error', code });
      updateDraft({
        routeChannel: 'citizen choice',
        aiClassification: { photoKey, result: null, errorCode: code, acceptedRank: null, acceptedIssueCode: null, acceptedConfidence: null },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);

  useEffect(() => {
    if (!cachedAI?.result) runAnalysis();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Trash2': return <Trash2 className="w-4 h-4 text-[#E0681A]" />;
      case 'Construction': return <Construction className="w-4 h-4 text-[#A86A0C]" />;
      case 'Lightbulb': return <Lightbulb className="w-4 h-4 text-[#0B3D66]" />;
      case 'Waves': return <Waves className="w-4 h-4 text-[#5B3FA6]" />;
      case 'Droplet': return <Droplet className="w-4 h-4 text-[#0B3D66]" />;
      case 'AlertOctagon': return <AlertOctagon className="w-4 h-4 text-[#B42318]" />;
      case 'Dog': return <Dog className="w-4 h-4 text-[#A86A0C]" />;
      case 'ShieldAlert': return <ShieldAlert className="w-4 h-4 text-[#1D7A45]" />;
      default: return <Trash2 className="w-4 h-4" />;
    }
  };

  const handleSelectCategory = (catId: string) => {
    const cat = selectableCategories.find(c => c.id === catId);
    if (!cat) return;
    setSelectedCatId(catId);
    // Picking the category an AI suggestion maps to counts as accepting that suggestion.
    const result = aiResultRef.current;
    const matching = result?.predictions.find(p => p.app_category_id === catId && p.confidence_band !== 'insufficient');
    if (result && matching) {
      setAcceptedRank(matching.rank);
      saveAIToDraft({ result, acceptedRank: matching.rank, acceptedIssueCode: matching.issue_code, acceptedConfidence: matching.confidence }, cat);
    } else {
      setAcceptedRank(null);
      saveAIToDraft({ result: result ?? null, acceptedRank: null, acceptedIssueCode: null, acceptedConfidence: null }, cat);
    }
  };

  const handleProceedToLocation = () => {
    if (aiState.phase === 'loading') abortRef.current?.abort();
    if (draftComplaint.aiClassification?.photoKey !== photoKey || draftComplaint.categoryId !== selectedCatId) {
      handleSelectCategory(selectedCatId);
    }
    navigateTo('C4_LOCATION');
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24">
      <Header 
        title={language === 'mr' ? 'तक्रार नोंदवा (पायरी २/४)' : 'Report Issue (Step 2/4)'} 
        subtitle={language === 'mr' ? 'AI संवर्ग व डुप्लिकेट तपासणी' : 'AI Classification & Triage'}
        showBack
        onBack={() => navigateTo('C2_MEDIA')}
      />

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Step Progress Bar */}
        <div className="flex items-center justify-between text-[11px] font-bold text-[#0B3D66]">
          <span>पायरी २: AI विश्लेषण व संवर्ग</span>
          <span>५०% पूर्ण</span>
        </div>
        <div className="w-full bg-[#D6DFE8] h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#0B3D66] h-full w-2/4 rounded-full" />
        </div>

        {/* NagarNetra Vision AI Classification Card */}
        <AIIssueAnalysisCard
          language={language}
          state={aiState}
          selectedRank={acceptedRank}
          resolveCategory={categoryForPrediction}
          onSelect={p => acceptPrediction(p)}
          onRetry={runAnalysis}
        />

        {/* Nearby Duplicate Detection Alert */}
        {!duplicateDismissed && (
          <div className="bg-[#FFF8E6] border border-[#A86A0C] rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#A86A0C] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-[#16212E]">
                  समान तक्रार आढळली! (Nearby Duplicate Detected)
                </h4>
                <p className="text-[11px] text-[#566475] mt-0.5 leading-relaxed">
                  मारुती चौकात ८५ मीटर अंतरावर याच प्रकारची कचरा तक्रार आज सकाळी नोंदवली गेली आहे. ४ नागरिकांनी दुजोरा दिला आहे.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => selectComplaint('SMKMC-2026-C8492', 'C8_DETAIL')}
                className="py-1.5 px-2 bg-[#A86A0C] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#8e5808]"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>+१ दुजोरा द्या (Upvote)</span>
              </button>
              <button
                type="button"
                onClick={() => setDuplicateDismissed(true)}
                className="py-1.5 px-2 bg-white border border-[#A86A0C] text-[#A86A0C] rounded-lg text-xs font-bold hover:bg-[#FFF8E6]"
              >
                नवीन नोंद सुरू ठेवा
              </button>
            </div>
          </div>
        )}

        {/* Category Override / Confirmation Grid */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#16212E]">
              {language === 'mr' ? 'संवर्ग बदलायचा असल्यास निवडा' : 'Select or Change Category'}
            </h3>
            <span className="text-[10px] text-[#566475]">८ महापालिका विभाग</span>
          </div>

          <div className="space-y-1.5">
            {selectableCategories.map((cat) => {
              const isSelected = selectedCatId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-[#0B3D66]/5 border-[#0B3D66] ring-1 ring-[#0B3D66]'
                      : 'bg-white border-[#D6DFE8] hover:border-[#0B3D66]/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-md bg-[#F4F7FA] border border-[#D6DFE8]/60">
                      {getCategoryIcon(cat.iconName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#16212E] truncate">
                        {language === 'mr' ? cat.nameMr : cat.nameEn}
                      </p>
                      <p className="text-[10px] text-[#566475] truncate">
                        {cat.departmentMr}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <span className="text-[10px] font-mono font-bold text-[#0B3D66]">
                      {cat.slaHours}h
                    </span>
                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-[#0B3D66] mt-0.5 ml-auto" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={handleProceedToLocation}
          className="w-full min-h-[48px] bg-[#0B3D66] text-white font-bold text-sm rounded-lg hover:bg-[#082d4d] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-xs"
        >
          <span>{language === 'mr' ? 'पुढे जा: स्थान व प्रभाग निश्चिती' : 'Next: Location & Ward'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
