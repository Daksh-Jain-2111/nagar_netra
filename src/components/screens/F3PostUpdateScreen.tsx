import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { 
  CheckCircle, 
  Send, 
  Camera, 
  Upload, 
  ArrowLeft, 
  Check, 
  Sparkles,
  FileText
} from 'lucide-react';

const MILESTONES = [
  { id: 'inspected', labelEn: 'Inspected site', labelMr: 'जागेची पाहणी केली' },
  { id: 'material', labelEn: 'Material ordered', labelMr: 'साहित्य मागवले' },
  { id: 'team', labelEn: 'Team assigned', labelMr: 'पथक नियुक्त केले' },
  { id: 'started', labelEn: 'Work started', labelMr: 'काम सुरू केले' },
];

export const F3PostUpdateScreen: React.FC = () => {
  const { 
    language, 
    selectedComplaint, 
    navigateTo, 
    postUpdate 
  } = useApp();

  const [selectedMilestone, setSelectedMilestone] = useState<string>('Inspected site');
  const [note, setNote] = useState<string>('Site inspected with field engineering crew. Surface preparation underway.');
  const [photoUrl, setPhotoUrl] = useState<string>('https://images.unsplash.com/photo-1541888946425-d0fbb1861593?auto=format&fit=crop&w=800&q=80');
  const [hasPhoto, setHasPhoto] = useState<boolean>(true);
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

  const c = selectedComplaint;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;

    postUpdate(c.id, selectedMilestone, note.trim(), hasPhoto ? photoUrl : undefined);
    setSubmitted(true);
    setTimeout(() => {
      navigateTo('F2_OFFICER_DETAIL');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 text-[#16212E]">
      <Header 
        title={c.trackingNumber} 
        subtitle="Post Progress Update · अपडेट नोंदवा"
        showBack
        onBack={() => navigateTo('F2_OFFICER_DETAIL')}
      />

      <div className="max-w-md md:max-w-xl mx-auto px-4 pt-4 space-y-4">
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-[#0B3D66]">
              Select Status Milestone / टप्पा निवडा <span className="text-red-600">*</span>
            </h2>
            <p className="text-xs text-[#566475] mt-0.5">
              Choose milestone to record progress on ground.
            </p>
          </div>

          {/* Quick-pick Chips */}
          <div className="grid grid-cols-2 gap-2">
            {MILESTONES.map((m) => {
              const isSelected = selectedMilestone === m.labelEn;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMilestone(m.labelEn)}
                  className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'bg-[#0B3D66] text-white border-[#0B3D66] shadow-2xs'
                      : 'bg-[#F4F7FA] text-[#16212E] border-[#D6DFE8] hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs">{m.labelEn}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className={`text-[11px] mt-1 ${isSelected ? 'text-slate-200' : 'text-[#566475]'}`}>
                    {m.labelMr}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Note Field (Required) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#16212E]">
                Update note / सविस्तर माहिती <span className="text-red-600">*</span>
              </label>
              <span className="text-[10px] text-[#566475]">{note.length} / 500</span>
            </div>
            <textarea
              rows={3}
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter field update note for citizen and supervisor..."
              className="w-full p-2.5 rounded-lg border border-[#D6DFE8] text-xs text-[#16212E] focus:border-[#0B3D66] focus:outline-none"
            />
          </div>

          {/* Optional Progress Photo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#16212E]">
                Progress Photo / कामाचा फोटो (Optional)
              </label>
              <button
                type="button"
                onClick={() => setHasPhoto(!hasPhoto)}
                className="text-xs font-semibold text-[#0B3D66] hover:underline"
              >
                {hasPhoto ? 'Remove' : 'Attach'}
              </button>
            </div>

            {hasPhoto && (
              <div className="relative aspect-video rounded-lg overflow-hidden border border-[#D6DFE8] bg-slate-100">
                <img src={photoUrl} alt="Progress" className="w-full h-full object-cover" />
                <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                  GPS Auto Geotagged
                </span>
              </div>
            )}
          </div>

          {/* Compliance notice */}
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Citizen receives instant in-app notification. Response clock is met upon first update.
            </span>
          </div>

          <button
            type="submit"
            disabled={!note.trim()}
            className="w-full h-11 rounded-xl bg-[#0B3D66] text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#082d4d] active:scale-98 transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{submitted ? 'Update Posted!' : 'Post update / अपडेट पोस्ट करा'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
