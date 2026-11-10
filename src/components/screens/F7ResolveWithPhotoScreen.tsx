import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  Check, 
  RotateCcw, 
  MapPin, 
  ShieldCheck 
} from 'lucide-react';

const ACTIONS = [
  'Filled with cold mix / कोल्ड मिक्स',
  'Cleared / रस्ता साफ केला',
  'Repaired / दुरुस्ती केली',
  'Hot mix patch / हॉट मिक्स डांबर',
  'Replaced / बदलले',
];

export const F7ResolveWithPhotoScreen: React.FC = () => {
  const { 
    language, 
    selectedComplaint, 
    navigateTo, 
    resolveWithPhoto, 
    simulatedNow 
  } = useApp();

  const [distanceMeters, setDistanceMeters] = useState<number>(38); // within 200m by default
  const [selectedActions, setSelectedActions] = useState<string[]>(['Filled with cold mix / कोल्ड मिक्स']);
  const [note, setNote] = useState<string>('Filled 1.8 sq m pothole with premix asphalt, compacted with hand roller. Traffic flow restored smoothly.');
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string>('https://images.unsplash.com/photo-1541888946425-d0fbb1861593?auto=format&fit=crop&w=800&q=80');
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
  const isWithinGeofence = distanceMeters <= 200;

  const toggleAction = (item: string) => {
    if (selectedActions.includes(item)) {
      setSelectedActions(selectedActions.filter(i => i !== item));
    } else {
      setSelectedActions([...selectedActions, item]);
    }
  };

  const handleResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() || selectedActions.length === 0) return;

    resolveWithPhoto(c.id, afterPhotoUrl, distanceMeters, selectedActions, note.trim());
    setSubmitted(true);
    setTimeout(() => {
      navigateTo('F1_WORK_QUEUE');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24 text-[#16212E]">
      <Header 
        title={c.trackingNumber} 
        subtitle="Resolve with Live Photo · निवारण नोंदवा"
        showBack
        onBack={() => navigateTo('F2_OFFICER_DETAIL')}
      />

      <div className="max-w-md md:max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* Anti-tamper banner */}
        <div className="p-3 bg-[#0B3D66] text-white rounded-xl shadow-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
            <ShieldCheck className="w-4 h-4" />
            <span>Camera Capture Only · Live Photo Verification</span>
          </div>
          <p className="text-[11px] text-slate-200">
            Gallery uploads are disabled. Photo must be captured on site after the complaint was filed.
          </p>
        </div>

        <form onSubmit={handleResolve} className="bg-white p-4 rounded-xl border border-[#D6DFE8] shadow-xs space-y-4">
          {/* Live Viewfinder Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#16212E]">
                After Photo Capture · निवारण पुरावा <span className="text-red-600">*</span>
              </label>
              {/* Testing distance slider toggle */}
              <div className="flex items-center gap-1 text-[11px] text-[#566475]">
                <span>Simulate GPS distance:</span>
                <button
                  type="button"
                  onClick={() => setDistanceMeters(distanceMeters === 38 ? 245 : 38)}
                  className="font-bold underline text-[#0B3D66]"
                >
                  {distanceMeters === 38 ? '38m (Valid)' : '245m (Flagged)'}
                </button>
              </div>
            </div>

            <div className="relative aspect-video rounded-xl overflow-hidden border border-[#D6DFE8] bg-slate-900">
              <img 
                src={afterPhotoUrl} 
                alt="Resolved proof" 
                className="w-full h-full object-cover" 
              />

              {/* Status Overlay */}
              <div className="absolute top-2 left-2">
                {isWithinGeofence ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-700 text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>✓ Within {distanceMeters} m · taken now</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-amber-600 text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Flagged · {distanceMeters} m from incident pin (&gt;200m)</span>
                  </span>
                )}
              </div>

              <div className="absolute bottom-2 left-2 bg-black/75 text-white text-[10px] font-mono px-2 py-0.5 rounded backdrop-blur-xs">
                {simulatedNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Live Camera
              </div>
            </div>

            {!isWithinGeofence && (
              <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                Notice: Distance exceeds 200m. The complaint will be resolved, but will be flagged for supervisory review and citizen will see an amber verification note.
              </p>
            )}
          </div>

          {/* What was done chips (Required) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#16212E] block">
              What was done? / काय काम केले? <span className="text-red-600">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ACTIONS.map(action => {
                const isSelected = selectedActions.includes(action);
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => toggleAction(action)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-[#0B3D66] text-white border-[#0B3D66] shadow-2xs'
                        : 'bg-[#F4F7FA] text-[#16212E] border-[#D6DFE8] hover:bg-slate-100'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{action}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note (Required) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#16212E] block">
              Officer Notes / शेरा <span className="text-red-600">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Provide exact details of restoration done on site..."
              className="w-full p-2.5 rounded-lg border border-[#D6DFE8] text-xs text-[#16212E] focus:border-[#0B3D66] focus:outline-none"
            />
          </div>

          {/* Citizen rights notice */}
          <div className="p-2.5 rounded-lg bg-[#F4F7FA] border border-[#D6DFE8] text-xs text-[#566475] space-y-0.5">
            <p className="font-bold text-[#16212E]">7-Day Citizen Reopen Window:</p>
            <p className="text-[11px]">
              Upon resolution, citizen receives instant in-app notification. A 7-day reopen window opens. If not reopened, the complaint auto-closes.
            </p>
          </div>

          <button
            type="submit"
            disabled={!note.trim() || selectedActions.length === 0}
            className="w-full h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitted ? 'Resolved & Recorded!' : 'Mark Resolved · तक्रार निवारण पूर्ण करा'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
