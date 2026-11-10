import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, RotateCcw, Loader2, AlertTriangle, CheckCircle, Pencil, RefreshCw, Upload } from 'lucide-react';
import { AppLanguage, ComplaintVoiceNote } from '../../types';
import { t, tf } from '../../utils/l10n';
import { useVoiceRecorder, formatClock, RecorderError, recordingBlocker } from '../../hooks/useVoiceRecorder';
import { ApiClient, ApiError, toComplaintVoiceNote } from '../../services/api';
import { VoiceNotePlayer } from './VoiceNotePlayer';

const MAX_SECONDS = 60;
const SPOKEN_LANGUAGES: Array<{ code: 'mr' | 'hi' | 'en'; label: string }> = [
  { code: 'mr', label: 'मराठी' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'en', label: 'English' },
];

export interface VoiceDraftUpdate {
  voiceNote?: ComplaintVoiceNote;
  voiceNoteUrl?: string;
  voiceTranscript?: string;
  voiceDurationSeconds?: number;
  description?: string;
}

interface Props {
  language: AppLanguage;
  voiceNote?: ComplaintVoiceNote;
  transcript: string;
  description: string;
  onChange: (update: VoiceDraftUpdate) => void;
}

const RECORDER_ERROR_KEY: Record<RecorderError, Parameters<typeof t>[0]> = {
  permission_denied: 'voiceErrPermission',
  no_microphone: 'voiceErrNoMic',
  unsupported: 'voiceErrUnsupported',
  insecure_context: 'voiceErrInsecure',
  recording_failed: 'voiceErrFailed',
  empty_recording: 'voiceErrEmpty',
};

/** Real voice complaint capture: record -> preview -> server storage + speech-to-text -> editable transcript. */
export const VoiceComplaintRecorder: React.FC<Props> = ({ language, voiceNote, transcript, description, onChange }) => {
  const recorder = useVoiceRecorder(MAX_SECONDS);
  const [spokenLang, setSpokenLang] = useState<'mr' | 'hi' | 'en'>(
    (voiceNote?.language as any) || (language === 'en' ? 'en' : language === 'hi' ? 'hi' : 'mr'));
  const [upload, setUpload] = useState<'idle' | 'uploading' | 'failed'>('idle');
  const [uploadErrorCode, setUploadErrorCode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [blocker] = useState(() => recordingBlocker());
  const [retrying, setRetrying] = useState(false);
  const uploadedBlobRef = useRef<Blob | null>(null);
  const savedTranscriptRef = useRef<string>(voiceNote?.transcript ?? '');

  const uploadRecording = async (blob: Blob) => {
    uploadedBlobRef.current = blob;
    setUploadErrorCode(null);
    setUpload('uploading');
    try {
      const res = await ApiClient.uploadVoiceNote(blob, spokenLang);
      const note = toComplaintVoiceNote(res);
      const text = note.transcript ?? '';
      savedTranscriptRef.current = text;
      setUpload('idle');
      onChange({
        voiceNote: note,
        voiceNoteUrl: note.audioUrl,
        voiceDurationSeconds: Math.round(note.durationSeconds),
        voiceTranscript: text,
        description: text || description,
      });
    } catch (err) {
      console.warn('[NagarNetra voice] upload failed', err instanceof ApiError ? err.code : err);
      setUploadErrorCode(err instanceof ApiError ? err.code || null : null);
      setUpload('failed');
    }
  };

  // Upload + transcribe as soon as a recording is finished
  useEffect(() => {
    if (recorder.status === 'recorded' && recorder.blob && recorder.blob !== uploadedBlobRef.current) {
      uploadRecording(recorder.blob);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.status, recorder.blob]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    const done = (secs: number) => { URL.revokeObjectURL(url); uploadedBlobRef.current = null; recorder.loadFile(file, secs); };
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : 0);
    probe.onerror = () => done(0);
    probe.src = url;
  };

  const recordAgain = () => {
    recorder.reset();
    uploadedBlobRef.current = null;
    setUpload('idle');
    onChange({ voiceNote: undefined, voiceNoteUrl: undefined, voiceDurationSeconds: undefined, voiceTranscript: '' });
  };

  const saveTranscript = async () => {
    if (!voiceNote || transcript === savedTranscriptRef.current) return;
    try {
      await ApiClient.updateVoiceTranscript(voiceNote.id, transcript);
      savedTranscriptRef.current = transcript;
    } catch {
      /* the final transcript is also sent with the complaint; nothing is lost */
    }
  };

  const retryTranscription = async () => {
    if (!voiceNote) return;
    setRetrying(true);
    try {
      const note = toComplaintVoiceNote(await ApiClient.retryVoiceTranscription(voiceNote.id, spokenLang));
      const text = note.transcript ?? '';
      savedTranscriptRef.current = text;
      onChange({ voiceNote: note, voiceTranscript: text, description: text || description });
    } catch {
      /* stays in "unavailable" state */
    } finally {
      setRetrying(false);
    }
  };

  const hasSavedNote = !!voiceNote && recorder.status !== 'recording';
  const previewUrl = voiceNote?.audioUrl || recorder.blobUrl;
  const transcriptionFailed = !!voiceNote && voiceNote.transcriptionStatus !== 'completed';
  const showTextBox = hasSavedNote || upload === 'failed' || recorder.status === 'error';
  const textValue = hasSavedNote ? transcript : description;

  return (
    <div className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-[#16212E] flex items-center gap-1.5">
          <Mic className="w-4 h-4 text-[#E0681A]" />
          <span>{t('voiceTitle', language)}</span>
        </h3>
        <span className="text-[10px] text-[#566475]">मराठी / हिंदी / English</span>
      </div>

      {/* Spoken language (sent to speech-to-text; transcript is kept in this language, not translated) */}
      <div className="flex items-center gap-1.5 flex-wrap" role="radiogroup" aria-label={t('voiceSpokenLanguage', language)}>
        <span className="text-[10px] font-semibold text-[#566475] mr-1">{t('voiceSpokenLanguage', language)}:</span>
        {SPOKEN_LANGUAGES.map(l => (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={spokenLang === l.code}
            disabled={recorder.status === 'recording' || upload === 'uploading'}
            onClick={() => setSpokenLang(l.code)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
              spokenLang === l.code ? 'bg-[#0B3D66] text-white border-[#0B3D66]' : 'bg-white text-[#0B3D66] border-[#D6DFE8] hover:border-[#0B3D66]'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="p-3 bg-[#F4F7FA] rounded-xl border border-[#D6DFE8] space-y-2.5">
        {recorder.status === 'recording' ? (
          <div className="flex items-center justify-between gap-3" aria-live="polite">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-[#B42318]">{t('voiceRecording', language)}</span>
              <span className="text-xs font-mono font-bold text-[#16212E] tabular-nums">{formatClock(recorder.elapsed)}</span>
              {/* live microphone input level (real signal) */}
              <span className="flex items-end gap-0.5 h-4 ml-1" aria-hidden="true">
                {[0.2, 0.45, 0.7, 0.45, 0.2].map((w, i) => (
                  <span key={i} className="w-1 rounded-sm bg-[#E0681A]" style={{ height: `${Math.max(15, Math.min(100, recorder.level * 100 * (0.6 + w)))}%` }} />
                ))}
              </span>
            </div>
            <button
              type="button"
              onClick={recorder.stop}
              className="px-3 py-1.5 bg-[#B42318] text-white text-xs font-bold rounded-lg flex items-center gap-1 shrink-0"
            >
              <Square className="w-3 h-3 fill-white" />
              <span>{t('voiceStop', language)}</span>
            </button>
          </div>
        ) : hasSavedNote || (recorder.status === 'recorded' && previewUrl) ? (
          <div className="space-y-2">
            {previewUrl && (
              <VoiceNotePlayer
                src={previewUrl}
                fallbackDuration={voiceNote?.durationSeconds || recorder.elapsed}
                title={t('voiceYourRecording', language)}
                subtitle={hasSavedNote ? t('voiceSaved', language) : undefined}
                compact
              />
            )}
            <button
              type="button"
              onClick={recordAgain}
              disabled={upload === 'uploading'}
              className="text-[11px] font-bold text-[#0B3D66] flex items-center gap-1 hover:underline disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('voiceRecordAgain', language).replace('↻ ', '')}</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={recorder.start}
            disabled={recorder.status === 'requesting' || !!blocker}
            className="w-full py-2.5 bg-white border border-[#E0681A] text-[#E0681A] rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#E0681A]/5 transition-colors disabled:opacity-60"
          >
            {recorder.status === 'requesting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            <span>
              {recorder.status === 'requesting'
                ? t('voiceRequesting', language)
                : `${t('voiceTapToRecord', language)} (${tf('voiceMaxHint', language, { n: MAX_SECONDS })})`}
            </span>
          </button>
        )}

        {!hasSavedNote && recorder.status !== 'recording' && upload !== 'uploading' && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-1.5 text-[11px] font-bold text-[#0B3D66] flex items-center justify-center gap-1.5 hover:underline"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t('voiceUploadFile', language)}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.webm,.m4a,.mp3,.wav,.ogg,.aac"
              capture
              className="hidden"
              onChange={handleFile}
            />
          </>
        )}

        {upload === 'uploading' && (
          <div role="status" className="flex items-start gap-2 text-[11px] text-[#0B3D66]">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5 text-[#E0681A]" />
            <span><strong>{t('voiceProcessing', language)}</strong> {t('voiceProcessingHint', language)}</span>
          </div>
        )}
      </div>

      {recorder.status === 'idle' && blocker && !hasSavedNote && (
        <p role="alert" className="p-2.5 rounded-lg bg-[#FFF8E6] border border-[#A86A0C]/50 text-[11px] font-semibold text-[#16212E] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#A86A0C] shrink-0" />
          <span>{t(RECORDER_ERROR_KEY[blocker], language)}</span>
        </p>
      )}

      {recorder.status === 'error' && recorder.error && (
        <p role="alert" className="p-2.5 rounded-lg bg-[#FFF8E6] border border-[#A86A0C]/50 text-[11px] font-semibold text-[#16212E] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#A86A0C] shrink-0" />
          <span>{t(RECORDER_ERROR_KEY[recorder.error], language)}</span>
        </p>
      )}

      {upload === 'failed' && (
        <div role="alert" className="p-2.5 rounded-lg bg-[#B42318]/5 border border-[#B42318]/30 text-[11px] font-semibold text-[#16212E] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#B42318] shrink-0" />
          <div className="space-y-1.5">
            <p>{t(uploadErrorCode === 'AUDIO_DECODER_MISSING' ? 'voiceErrDecoder' : 'voiceErrUpload', language)}</p>
            {uploadedBlobRef.current && (
              <button type="button" onClick={() => uploadRecording(uploadedBlobRef.current!)}
                className="px-2 py-0.5 bg-white border border-[#0B3D66] text-[#0B3D66] rounded text-[10px] font-bold inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />{t('voiceRetry', language)}
              </button>
            )}
          </div>
        </div>
      )}

      {transcriptionFailed && (
        <div role="alert" className="p-2.5 rounded-lg bg-[#FFF8E6] border border-[#A86A0C]/50 text-[11px] font-semibold text-[#16212E] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#A86A0C] shrink-0" />
          <div className="space-y-1.5">
            <p>{t('voiceErrTranscription', language)}</p>
            <button type="button" onClick={retryTranscription} disabled={retrying}
              className="px-2 py-0.5 bg-white border border-[#0B3D66] text-[#0B3D66] rounded text-[10px] font-bold inline-flex items-center gap-1 disabled:opacity-50">
              {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}{t('voiceRetry', language)}
            </button>
          </div>
        </div>
      )}

      {showTextBox && (
        <div className="space-y-1">
          <label htmlFor="voice-transcript" className="text-[11px] font-bold text-[#0B3D66] flex items-center gap-1.5">
            {hasSavedNote && !transcriptionFailed ? <CheckCircle className="w-3.5 h-3.5 text-[#1D7A45]" /> : <Pencil className="w-3.5 h-3.5" />}
            <span>{hasSavedNote ? t('voiceTranscriptLabel', language) : t('voiceTranscriptPlaceholder', language)}</span>
            {hasSavedNote && voiceNote?.transcriptOriginal != null && transcript !== voiceNote.transcriptOriginal && (
              <span className="px-1.5 py-0.5 rounded bg-[#E0681A]/10 text-[#E0681A] text-[9px] font-bold">{t('voiceEdited', language)}</span>
            )}
          </label>
          <textarea
            id="voice-transcript"
            rows={3}
            lang={spokenLang}
            value={textValue}
            onChange={e => onChange(hasSavedNote
              ? { voiceTranscript: e.target.value, description: e.target.value }
              : { description: e.target.value })}
            onBlur={hasSavedNote ? saveTranscript : undefined}
            placeholder={t('voiceTranscriptPlaceholder', language)}
            className="w-full p-2.5 text-xs font-medium text-[#16212E] border border-[#D6DFE8] rounded-lg focus:border-[#0B3D66] focus:outline-hidden bg-white"
          />
          {hasSavedNote && <p className="text-[10px] text-[#566475]">{t('voiceTranscriptHint', language)}</p>}
        </div>
      )}
    </div>
  );
};
