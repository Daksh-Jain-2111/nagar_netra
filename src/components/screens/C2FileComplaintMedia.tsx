import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { VoiceComplaintRecorder } from '../common/VoiceComplaintRecorder';
import { 
  Camera, 
  Upload, 
  Trash2, 
  MapPin, 
  Sparkles, 
  ArrowRight,
  Image as ImageIcon
} from 'lucide-react';

const PRESET_CIVIC_PHOTOS = [
  {
    id: 'photo_garbage',
    title: 'कचरा ढीग (Maruti Chowk)',
    url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80',
    category: 'solid_waste',
  },
  {
    id: 'photo_pothole',
    title: 'खड्डा (Station Road)',
    url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
    category: 'roads_potholes',
  },
  {
    id: 'photo_light',
    title: 'बंद पथदिवा (Miraj Mission)',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    category: 'streetlights',
  },
];

export const C2FileComplaintMedia: React.FC = () => {
  const { language, draftComplaint, updateDraft, navigateTo } = useApp();

  const [photos, setPhotos] = useState<string[]>(
    draftComplaint.photoUrls.length > 0
      ? draftComplaint.photoUrls
      : ['https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80']
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && photos.length < 3) {
          const newPhotos = [...photos, event.target.result as string];
          setPhotos(newPhotos);
          updateDraft({ photoUrls: newPhotos });
        }
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const handleSelectPreset = (url: string) => {
    if (photos.includes(url)) return;
    if (photos.length >= 3) {
      setPhotos([url]);
      updateDraft({ photoUrls: [url] });
    } else {
      const updated = [...photos, url];
      setPhotos(updated);
      updateDraft({ photoUrls: updated });
    }
  };

  const handleRemovePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    setPhotos(updated);
    updateDraft({ photoUrls: updated });
  };

  const handleProceedToAI = () => {
    updateDraft({ photoUrls: photos });
    navigateTo('C3_AI_CLASSIFY');
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24">
      <Header 
        title={language === 'mr' ? 'तक्रार नोंदवा (पायरी १/४)' : 'Report Issue (Step 1/4)'} 
        subtitle={language === 'mr' ? 'फोटो व आवाज नोंदणी' : 'Media & Voice Note'}
        showBack
        onBack={() => navigateTo('C1_HOME')}
      />

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Step Progress Bar */}
        <div className="flex items-center justify-between text-[11px] font-bold text-[#0B3D66]">
          <span>पायरी १: फोटो व आवाज</span>
          <span>२५% पूर्ण</span>
        </div>
        <div className="w-full bg-[#D6DFE8] h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#0B3D66] h-full w-1/4 rounded-full" />
        </div>

        {/* Camera / Photo Capture Card */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#16212E] flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#0B3D66]" />
              <span>{language === 'mr' ? 'समस्येचे छायाचित्र (कमाल ३ फोटो)' : 'Issue Photos (Max 3)'}</span>
            </h3>
            <span className="text-[10px] font-mono text-[#566475]">
              {photos.length}/3 निवडले
            </span>
          </div>

          {/* Photos Preview Grid */}
          <div className="grid grid-cols-3 gap-2">
            {photos.map((url, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-[#D6DFE8] group">
                <img src={url} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(idx)}
                  className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded-full hover:bg-[#B42318] transition-colors"
                  aria-label="Remove photo"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate text-center">
                  फोटो {idx + 1}
                </div>
              </div>
            ))}

            {photos.length < 3 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-[#D6DFE8] hover:border-[#0B3D66] flex flex-col items-center justify-center p-2 text-[#566475] hover:text-[#0B3D66] transition-colors bg-[#F4F7FA]"
              >
                <Upload className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold">अपलोड करा</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Quick Demo Photo Presets */}
          <div className="pt-2 border-t border-[#D6DFE8]/60 space-y-1.5">
            <p className="text-[11px] text-[#566475] font-semibold">
              किंवा तात्काळ डेमो फोटो निवडा (Quick Test):
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {PRESET_CIVIC_PHOTOS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.url)}
                  className="px-2.5 py-1 rounded bg-[#F4F7FA] border border-[#D6DFE8] hover:border-[#0B3D66] text-[10px] font-bold text-[#0B3D66] whitespace-nowrap flex items-center gap-1 shrink-0"
                >
                  <ImageIcon className="w-3 h-3 text-[#E0681A]" />
                  <span>{preset.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Simulated Geotag & EXIF Indicator */}
          <div className="p-2.5 rounded-lg bg-[#F4F7FA] border border-[#D6DFE8] flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-[#16212E]">
              <MapPin className="w-3.5 h-3.5 text-[#1D7A45] shrink-0" />
              <span>
                <strong>GPS टॅग: </strong> 16.8524° N, 74.5815° E (सांगली विश्रामबाग)
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-[#1D7A45]/10 text-[#1D7A45] font-bold text-[9px]">
              EXIF वैध
            </span>
          </div>
        </div>

        {/* Voice complaint: real microphone recording + server speech-to-text + editable transcript */}
        <VoiceComplaintRecorder
          language={language}
          voiceNote={draftComplaint.voiceNote}
          transcript={draftComplaint.voiceTranscript || ''}
          description={draftComplaint.description}
          onChange={updateDraft}
        />

        {/* AI Ready Indicator & Proceed Button */}
        <div className="p-3 bg-[#0B3D66]/5 rounded-xl border border-[#0B3D66]/20 flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-[#0B3D66] shrink-0" />
          <p className="text-[11px] text-[#0B3D66] font-medium leading-tight">
            <strong>NagarNetra Vision AI: </strong> 
            पुढील पायरीवर फोटोचे विश्लेषण करून संवर्ग व तीव्रता आपोआप ठरवली जाईल.
          </p>
        </div>

        <button
          type="button"
          disabled={photos.length === 0}
          onClick={handleProceedToAI}
          className={`w-full min-h-[48px] font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs ${
            photos.length > 0
              ? 'bg-[#0B3D66] text-white hover:bg-[#082d4d] active:scale-[0.99]'
              : 'bg-[#D6DFE8] text-[#566475] cursor-not-allowed'
          }`}
        >
          <span>{language === 'mr' ? 'पुढे जा: AI संवर्ग तपासणी' : 'Next: AI Classification'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
