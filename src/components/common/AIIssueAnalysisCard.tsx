import React, { useEffect, useState } from 'react';
import { Sparkles, Trophy, CheckCircle, Loader2, AlertTriangle, RefreshCw, Building2, Clock, Info } from 'lucide-react';
import { AppLanguage, CivicIssueClassificationResult, CivicIssuePrediction, ComplaintCategory, AIConfidenceBand } from '../../types';
import { t, tf } from '../../utils/l10n';

export type AIAnalysisState =
  | { phase: 'loading' }
  | { phase: 'error'; code: string }
  | { phase: 'result'; result: CivicIssueClassificationResult; skippedPhotos: number };

interface Props {
  language: AppLanguage;
  state: AIAnalysisState;
  selectedRank: number | null;
  /** Category in the app's category list for a prediction (department & SLA shown from it). */
  resolveCategory: (p: CivicIssuePrediction) => ComplaintCategory | undefined;
  onSelect: (p: CivicIssuePrediction) => void;
  onRetry: () => void;
}

const PHOTO_ERROR_CODES = new Set(['NO_IMAGE', 'INVALID_IMAGE', 'UNSUPPORTED_FORMAT', 'IMAGE_TOO_LARGE', 'PAYLOAD_TOO_LARGE', 'TOO_MANY_IMAGES', 'PHOTO_UNREADABLE']);

const pct = (c: number) => Math.round(c * 100);

const BAND_STYLE: Record<AIConfidenceBand, string> = {
  strong: 'bg-[#1D7A45]/10 text-[#1D7A45] border-[#1D7A45]/20',
  suggestion: 'bg-[#0B3D66]/10 text-[#0B3D66] border-[#0B3D66]/20',
  low: 'bg-[#A86A0C]/10 text-[#A86A0C] border-[#A86A0C]/30',
  insufficient: 'bg-[#566475]/10 text-[#566475] border-[#566475]/20',
};

const bandLabel = (band: AIConfidenceBand, lang: AppLanguage) =>
  band === 'strong' ? t('aiBandStrong', lang) : band === 'suggestion' ? t('aiBandSuggestion', lang) : t('aiBandLow', lang);

function issueName(p: CivicIssuePrediction, lang: AppLanguage) {
  return lang === 'en' ? p.issue_name : p.issue_name_mr || p.issue_name;
}

function departmentAndSla(p: CivicIssuePrediction, cat: ComplaintCategory | undefined, lang: AppLanguage) {
  if (cat) {
    return { department: lang === 'en' ? cat.department : cat.departmentMr, slaHours: cat.slaHours };
  }
  return {
    department: (lang === 'en' ? p.department_name : p.department_name_mr || p.department_name) || '—',
    slaHours: p.sla_hours,
  };
}

const LoadingSteps: React.FC<{ language: AppLanguage }> = ({ language }) => {
  const steps = [t('aiStepDetect', language), t('aiStepDepartment', language), t('aiStepSla', language)];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive(a => Math.min(a + 1, steps.length - 1)), 900);
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <div role="status" aria-live="polite" className="p-3 bg-[#F4F7FA] rounded-lg border border-[#D6DFE8] space-y-2.5">
      <p className="text-xs font-bold text-[#0B3D66] flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[#E0681A]" />
        <span>{t('aiAnalyzingTitle', language)}</span>
      </p>
      <ul className="space-y-1.5">
        {steps.map((label, idx) => (
          <li key={label} className={`flex items-center gap-2 text-[11px] ${idx <= active ? 'text-[#16212E] font-semibold' : 'text-[#566475]/60'}`}>
            {idx < active ? (
              <CheckCircle className="w-3.5 h-3.5 text-[#1D7A45]" />
            ) : idx === active ? (
              <span className="w-3.5 h-3.5 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-[#E0681A] animate-pulse" /></span>
            ) : (
              <span className="w-3.5 h-3.5 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-[#D6DFE8]" /></span>
            )}
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <div className="w-full bg-[#D6DFE8] h-1 rounded-full overflow-hidden">
        <div className="bg-[#0B3D66] h-full rounded-full transition-all duration-700" style={{ width: `${((active + 1) / steps.length) * 90}%` }} />
      </div>
    </div>
  );
};

const Notice: React.FC<{ tone: 'amber' | 'red'; message: string; onRetry?: () => void; retryLabel?: string }> = ({ tone, message, onRetry, retryLabel }) => (
  <div
    role="alert"
    className={`p-3 rounded-lg border flex items-start gap-2.5 ${tone === 'red' ? 'bg-[#B42318]/5 border-[#B42318]/30' : 'bg-[#FFF8E6] border-[#A86A0C]/50'}`}
  >
    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${tone === 'red' ? 'text-[#B42318]' : 'text-[#A86A0C]'}`} />
    <div className="flex-1 min-w-0 space-y-2">
      <p className="text-[11px] font-semibold text-[#16212E] leading-relaxed">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-2.5 py-1 bg-white border border-[#0B3D66] text-[#0B3D66] rounded-md text-[11px] font-bold inline-flex items-center gap-1 hover:bg-[#0B3D66]/5"
        >
          <RefreshCw className="w-3 h-3" />
          <span>{retryLabel}</span>
        </button>
      )}
    </div>
  </div>
);

export const AIIssueAnalysisCard: React.FC<Props> = ({ language, state, selectedRank, resolveCategory, onSelect, onRetry }) => {
  const header = (confidence?: number, band?: AIConfidenceBand) => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B3D66] min-w-0">
        <Sparkles className="w-4 h-4 text-[#E0681A] shrink-0" />
        <span className="truncate">{t('aiVisionTitle', language)}</span>
      </div>
      {confidence !== undefined && band && (
        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border whitespace-nowrap ${BAND_STYLE[band]}`}>
          {tf('aiConfidence', language, { n: pct(confidence) })}
        </span>
      )}
    </div>
  );

  if (state.phase === 'loading') {
    return (
      <div className="bg-white rounded-xl border-2 border-[#0B3D66] p-4 shadow-xs space-y-3" aria-busy="true">
        {header()}
        <LoadingSteps language={language} />
      </div>
    );
  }

  if (state.phase === 'error') {
    const photoProblem = PHOTO_ERROR_CODES.has(state.code);
    return (
      <div className="bg-white rounded-xl border-2 border-[#0B3D66] p-4 shadow-xs space-y-3">
        {header()}
        <Notice
          tone={photoProblem ? 'amber' : 'red'}
          message={photoProblem ? t('aiPhotoProblemMsg', language) : t('aiUnavailableMsg', language)}
          onRetry={photoProblem ? undefined : onRetry}
          retryLabel={t('aiRetry', language)}
        />
      </div>
    );
  }

  const { result, skippedPhotos } = state;
  const preds = result.predictions;
  const top = preds[0];
  const isSuccess = result.status === 'success' && !!top;
  const rejectedPhotos = result.images.filter(i => i.status === 'rejected').length + skippedPhotos;

  const suggestionRow = (p: CivicIssuePrediction) => {
    const cat = resolveCategory(p);
    const { department } = departmentAndSla(p, cat, language);
    const selected = selectedRank === p.rank;
    return (
      <li key={p.issue_code}>
        <button
          type="button"
          onClick={() => onSelect(p)}
          aria-pressed={selected}
          className={`w-full p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
            selected ? 'bg-[#0B3D66]/5 border-[#0B3D66] ring-1 ring-[#0B3D66]' : 'bg-white border-[#D6DFE8] hover:border-[#0B3D66]/40'
          }`}
        >
          <span className="w-5 h-5 shrink-0 rounded-full bg-[#F4F7FA] border border-[#D6DFE8] text-[10px] font-bold text-[#0B3D66] flex items-center justify-center">
            {p.rank}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-bold text-[#16212E] truncate">{issueName(p, language)}</span>
            <span className="block text-[10px] text-[#566475] truncate">{department}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-[11px] font-mono font-bold text-[#0B3D66]">{pct(p.confidence)}%</span>
            {selected && <CheckCircle className="w-3.5 h-3.5 text-[#0B3D66] mt-0.5 ml-auto" />}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="bg-white rounded-xl border-2 border-[#0B3D66] p-4 shadow-xs space-y-3" aria-live="polite">
      {header(isSuccess ? top.confidence : undefined, isSuccess ? top.confidence_band : undefined)}

      {isSuccess ? (
        (() => {
          const cat = resolveCategory(top);
          const { department, slaHours } = departmentAndSla(top, cat, language);
          const selected = selectedRank === top.rank;
          return (
            <div className={`p-3 rounded-lg border-2 space-y-2.5 ${selected ? 'border-[#1D7A45] bg-[#1D7A45]/5' : 'border-[#D6DFE8] bg-[#F4F7FA]'}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-[#0B3D66] flex items-center gap-1.5 min-w-0">
                  <Trophy className="w-4 h-4 text-[#E0681A] shrink-0" aria-hidden="true" />
                  <span className="truncate">{issueName(top, language)}</span>
                </h3>
                <span className="shrink-0 px-2 py-0.5 rounded bg-[#E0681A] text-white text-[9px] font-extrabold tracking-wider">
                  🏆 {t('aiRecommended', language)}
                </span>
              </div>
              <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${BAND_STYLE[top.confidence_band]}`}>
                {bandLabel(top.confidence_band, language)}
              </span>
              <div className="grid grid-cols-[1fr_auto] gap-3 text-[11px]">
                <div className="min-w-0">
                  <p className="text-[#566475] font-semibold flex items-center gap-1"><Building2 className="w-3 h-3" />{t('aiDepartment', language)}</p>
                  <p className="font-bold text-[#16212E] leading-snug">{department}</p>
                </div>
                <div className="text-right">
                  <p className="text-[#566475] font-semibold flex items-center gap-1 justify-end"><Clock className="w-3 h-3" />{t('aiSla', language)}</p>
                  <p className="font-bold text-[#E0681A]">{slaHours != null ? tf('aiHours', language, { n: slaHours }) : '—'}</p>
                </div>
              </div>
              {!top.app_category_id && <p className="text-[10px] text-[#A86A0C] font-semibold">{t('aiNoAppCategory', language)}</p>}
              <button
                type="button"
                onClick={() => onSelect(top)}
                aria-pressed={selected}
                disabled={!top.app_category_id}
                className={`w-full min-h-[36px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  selected ? 'bg-[#1D7A45] text-white' : 'bg-[#0B3D66] text-white hover:bg-[#082d4d] disabled:bg-[#D6DFE8] disabled:text-[#566475]'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{selected ? t('aiSelected', language) : t('aiUseThis', language)}</span>
              </button>
            </div>
          );
        })()
      ) : (
        <Notice
          tone="amber"
          message={result.status === 'no_civic_issue' ? t('aiNoCivicIssueMsg', language) : t('aiLowConfidenceMsg', language)}
        />
      )}

      {isSuccess && preds.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-[#16212E]">{t('aiOtherSuggestions', language)}</p>
          <ul className="space-y-1.5">{preds.slice(1).map(suggestionRow)}</ul>
        </div>
      )}

      {result.status === 'low_confidence' && preds.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-[#566475]">{t('aiPossibleMatches', language)}</p>
          <ul className="space-y-1.5">{preds.map(suggestionRow)}</ul>
        </div>
      )}

      <div className="pt-2 border-t border-[#D6DFE8]/60 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-[#566475]">
        <span className="flex items-center gap-1"><Info className="w-3 h-3" />{t('aiManualOverrideNote', language)}</span>
        <span className="font-mono">
          {result.aggregation.images_analyzed > 1 && isSuccess
            ? tf('aiImagesAgree', language, { a: result.aggregation.top_issue_agreement, b: result.aggregation.images_analyzed })
            : ''}
          {rejectedPhotos > 0 ? ` · ${tf('aiImagesSkipped', language, { n: rejectedPhotos })}` : ''}
        </span>
      </div>
    </div>
  );
};
