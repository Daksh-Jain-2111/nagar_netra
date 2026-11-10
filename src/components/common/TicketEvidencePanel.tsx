import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Sparkles, Trophy, Building2, Clock, X } from 'lucide-react';
import { AppLanguage, Complaint, ComplaintCategory, ComplaintVoiceNote } from '../../types';
import { t, tf } from '../../utils/l10n';
import { ApiClient, toComplaintVoiceNote } from '../../services/api';
import { VoiceNotePlayer } from './VoiceNotePlayer';

const LANG_LABEL: Record<string, string> = { mr: 'मराठी', hi: 'हिंदी', en: 'English' };
const TRANSCRIPT_PREVIEW_CHARS = 140;

/** Citizen voice note on a ticket. Refreshes from the backend (source of truth) when reachable. */
export const TicketVoiceNote: React.FC<{ language: AppLanguage; voiceNote: ComplaintVoiceNote }> = ({ language, voiceNote }) => {
  const [note, setNote] = useState<ComplaintVoiceNote>(voiceNote);
  const [expanded, setExpanded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    setNote(voiceNote);
    let cancelled = false;
    ApiClient.getVoiceNote(voiceNote.id)
      .then(v => { if (!cancelled) setNote(toComplaintVoiceNote(v)); })
      .catch(() => { /* offline: keep the copy stored on the ticket */ });
    return () => { cancelled = true; };
  }, [voiceNote]);

  const transcript = note.transcript || '';
  const long = transcript.length > TRANSCRIPT_PREVIEW_CHARS;
  const shown = expanded || !long ? transcript : `${transcript.slice(0, TRANSCRIPT_PREVIEW_CHARS).trimEnd()}…`;
  const edited = note.transcriptOriginal != null && note.transcriptOriginal !== note.transcript;

  return (
    <section className="bg-white p-3.5 rounded-xl border border-[#D6DFE8] shadow-xs space-y-2.5">
      <div className="flex items-center justify-between gap-2 border-b border-[#D6DFE8] pb-1.5">
        <h3 className="text-xs font-bold text-[#0B3D66] flex items-center gap-1.5">
          <span>{t('officerVoiceNote', language)}</span>
        </h3>
        {note.language && (
          <span className="px-1.5 py-0.5 rounded bg-[#F4F7FA] border border-[#D6DFE8] text-[10px] font-bold text-[#566475]">
            {LANG_LABEL[note.language] || note.language}
          </span>
        )}
      </div>

      <VoiceNotePlayer
        src={note.audioUrl}
        fallbackDuration={note.durationSeconds}
        title={t('officerVoiceComplaint', language)}
        errorLabel={t('officerAudioError', language)}
      />

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#566475]">{t('officerTranscript', language)}</p>
        {transcript ? (
          <p lang={note.language || undefined} className="p-2.5 rounded-lg bg-[#F4F7FA] border border-[#D6DFE8] text-xs text-[#16212E] leading-relaxed">
            “{shown}”
          </p>
        ) : (
          <p className="text-[11px] text-[#A86A0C] font-semibold">{t('voiceErrTranscription', language)}</p>
        )}
        <div className="flex flex-wrap gap-3">
          {long && (
            <button type="button" onClick={() => setExpanded(!expanded)} className="text-[11px] font-bold text-[#0B3D66] hover:underline">
              {expanded ? t('officerShowLess', language) : `[${t('officerViewFull', language)}]`}
            </button>
          )}
          {edited && (
            <button type="button" onClick={() => setShowOriginal(!showOriginal)} className="text-[11px] font-bold text-[#566475] hover:underline">
              {t('officerOriginalStt', language)}
            </button>
          )}
        </div>
        {edited && showOriginal && (
          <p lang={note.language || undefined} className="p-2 rounded border border-dashed border-[#D6DFE8] text-[11px] text-[#566475]">
            “{note.transcriptOriginal}”
          </p>
        )}
      </div>
    </section>
  );
};

export const TicketIssueImages: React.FC<{ language: AppLanguage; photoUrls: string[] }> = ({ language, photoUrls }) => {
  const [open, setOpen] = useState<string | null>(null);
  if (!photoUrls.length) return null;
  return (
    <section className="bg-white p-3.5 rounded-xl border border-[#D6DFE8] shadow-xs space-y-2.5">
      <h3 className="text-xs font-bold text-[#0B3D66] flex items-center gap-1.5 border-b border-[#D6DFE8] pb-1.5">
        <ImageIcon className="w-4 h-4 text-[#E0681A]" />
        <span>{t('officerIssueImage', language)}</span>
      </h3>
      <div className={`grid gap-2 ${photoUrls.length > 1 ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {photoUrls.map((url, i) => (
          <button key={url + i} type="button" onClick={() => setOpen(url)}
            className={`rounded-lg overflow-hidden border border-[#D6DFE8] bg-slate-100 ${photoUrls.length > 1 ? 'aspect-square' : 'aspect-video'}`}>
            <img src={url} alt={`Issue photo ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <button type="button" aria-label="Close" className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white"><X className="w-5 h-5" /></button>
          <img src={open} alt="Issue photo" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </section>
  );
};

export const TicketAIAnalysis: React.FC<{ language: AppLanguage; complaint: Complaint; category?: ComplaintCategory }> = ({ language, complaint, category }) => {
  const analysis = complaint.aiAnalysis;
  if (!analysis || !analysis.predictions.length) return null;
  const name = (p: { issue_name: string; issue_name_mr: string }) => (language === 'en' ? p.issue_name : p.issue_name_mr || p.issue_name);
  const top = analysis.predictions[0];
  return (
    <section className="bg-white p-3.5 rounded-xl border border-[#D6DFE8] shadow-xs space-y-2.5">
      <div className="flex items-center justify-between gap-2 border-b border-[#D6DFE8] pb-1.5">
        <h3 className="text-xs font-bold text-[#0B3D66] flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#E0681A]" />
          <span>{t('officerAIAnalysis', language)}</span>
        </h3>
        {top.recommended && (
          <span className="px-2 py-0.5 rounded-full bg-[#1D7A45]/10 text-[#1D7A45] border border-[#1D7A45]/20 text-[10px] font-bold">
            {tf('aiConfidence', language, { n: Math.round(top.confidence * 100) })}
          </span>
        )}
      </div>
      <ol className="space-y-1.5">
        {analysis.predictions.map(p => (
          <li key={p.issue_code}
            className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${p.recommended ? 'border-[#1D7A45] bg-[#1D7A45]/5' : 'border-[#D6DFE8] bg-white'}`}>
            <span className="w-5 h-5 shrink-0 rounded-full bg-[#F4F7FA] border border-[#D6DFE8] text-[10px] font-bold text-[#0B3D66] flex items-center justify-center">{p.rank}</span>
            {p.recommended && <Trophy className="w-3.5 h-3.5 text-[#E0681A] shrink-0" aria-hidden="true" />}
            <span className="flex-1 min-w-0 font-bold text-[#16212E] truncate">{name(p)}</span>
            {p.recommended && (
              <span className="px-1.5 py-0.5 rounded bg-[#E0681A] text-white text-[9px] font-extrabold tracking-wider shrink-0">
                {t('aiRecommended', language)}
              </span>
            )}
            <span className="font-mono font-bold text-[#0B3D66] shrink-0">{Math.round(p.confidence * 100)}%</span>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-[1fr_auto] gap-3 text-[11px] pt-1">
        <div className="min-w-0">
          <p className="text-[#566475] font-semibold flex items-center gap-1"><Building2 className="w-3 h-3" />{t('aiDepartment', language)}</p>
          <p className="font-bold text-[#16212E]">{language === 'en' ? complaint.department : complaint.departmentMr || complaint.department}</p>
        </div>
        <div className="text-right">
          <p className="text-[#566475] font-semibold flex items-center gap-1 justify-end"><Clock className="w-3 h-3" />{t('aiSla', language)}</p>
          <p className="font-bold text-[#E0681A]">{category ? tf('aiHours', language, { n: category.slaHours }) : '—'}</p>
        </div>
      </div>
      {analysis.source === 'seed_sample' && (
        <p className="text-[10px] text-[#566475]">AI values: {t('officerSampleData', language)}</p>
      )}
    </section>
  );
};
