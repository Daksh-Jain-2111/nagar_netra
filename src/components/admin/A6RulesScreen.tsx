import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SystemRules } from '../../types';
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle, 
  Cpu, 
  Clock, 
  ShieldCheck, 
  MapPin, 
  Camera 
} from 'lucide-react';

export const A6RulesScreen: React.FC = () => {
  const { 
    systemRules, 
    updateSystemRules, 
    resetSystemRulesToTemplate, 
    addAuditLog,
    currentUser 
  } = useApp();

  const [formData, setFormData] = useState<SystemRules>({ ...systemRules });
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const handleChange = (field: keyof SystemRules, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSystemRules(formData);
    addAuditLog(
      'UPDATE_SYSTEM_RULES',
      'SystemRules',
      `Updated statutory SLA parameters and AI thresholds`,
      currentUser.name,
      currentUser.role
    );
    setSaveNotice('System rules and SLA thresholds successfully updated & logged to audit trail.');
    setTimeout(() => setSaveNotice(null), 4000);
  };

  const handleReset = () => {
    resetSystemRulesToTemplate();
    setFormData({ ...systemRules });
    setSaveNotice('Reset system parameters to Maharashtra Municipal template defaults.');
    setTimeout(() => setSaveNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            System Rules & Statutory SLA Governance
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Configure automated response timers, supervisor escalation windows, photo geo-fences and AI thresholds
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 bg-white border border-[#D6DFE8] hover:bg-slate-50 text-xs font-semibold text-[#16212E] rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#566475]" />
            <span>Reset to Template</span>
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{saveNotice}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Response & Escalation Statutory Clocks */}
        <div className="p-5 bg-white rounded-xl border border-[#D6DFE8] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Clock className="w-4 h-4 text-[#0B3D66]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#16212E]">
              1. Two Statutory Clocks & Supervisor Inactivity Windows
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#16212E] mb-1">
                Normal First Action Clock (Hours)
              </label>
              <input
                type="number"
                min="12"
                max="72"
                value={formData.responseClockNormalHours}
                onChange={(e) => handleChange('responseClockNormalHours', parseInt(e.target.value) || 48)}
                className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg"
              />
              <p className="text-[11px] text-[#566475] mt-1">
                Field officer must acknowledge or post initial action within this statutory window (SMKMC standard: 48h).
              </p>
            </div>

            <div>
              <label className="block font-bold text-[#16212E] mb-1">
                Urgent First Action Clock (Hours)
              </label>
              <input
                type="number"
                min="6"
                max="48"
                value={formData.responseClockUrgentHours}
                onChange={(e) => handleChange('responseClockUrgentHours', parseInt(e.target.value) || 24)}
                className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg"
              />
              <p className="text-[11px] text-[#566475] mt-1">
                Accelerated deadline for danger-to-life or emergency complaints (standard: 24h).
              </p>
            </div>

            <div>
              <label className="block font-bold text-[#16212E] mb-1">
                Supervisor Inactive Overdue Window (Hours)
              </label>
              <input
                type="number"
                min="24"
                max="120"
                value={formData.l2InactiveHours}
                onChange={(e) => handleChange('l2InactiveHours', parseInt(e.target.value) || 72)}
                className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg"
              />
              <p className="text-[11px] text-[#566475] mt-1">
                If supervisor takes no action within this time after L1 escalation, it appears on the Admin Overdue list (standard: 72h).
              </p>
            </div>

            <div>
              <label className="block font-bold text-[#16212E] mb-1">
                Citizen Reopen Allowed Window (Days)
              </label>
              <input
                type="number"
                min="1"
                max="14"
                value={formData.reopenMaxDays}
                onChange={(e) => handleChange('reopenMaxDays', parseInt(e.target.value) || 7)}
                className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg"
              />
              <p className="text-[11px] text-[#566475] mt-1">
                Maximum days after RESOLVED status that citizen can rate & reopen if work is unsatisfactory (standard: 7 days, max 2 reopens).
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: AI Classification & Confidence Scoring */}
        <div className="p-5 bg-white rounded-xl border border-[#D6DFE8] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Cpu className="w-4 h-4 text-[#E0681A]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#16212E]">
              2. On-Device AI Classification Thresholds
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="flex justify-between font-bold text-[#16212E] mb-1">
                <span>Auto-Route Confidence Threshold:</span>
                <span className="font-mono text-[#0B3D66]">{formData.aiThreshold}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                value={formData.aiThreshold}
                onChange={(e) => handleChange('aiThreshold', parseInt(e.target.value))}
                className="w-full accent-[#0B3D66]"
              />
              <p className="text-[11px] text-[#566475] mt-1">
                If model score is below this threshold, complaint routes to Supervisor TO_CHECK queue for human verification.
              </p>
            </div>

            <div>
              <div className="flex justify-between font-bold text-[#16212E] mb-1">
                <span>Vision Model Weight vs Text:</span>
                <span className="font-mono text-[#0B3D66]">{formData.aiVisionWeight}% / {100 - formData.aiVisionWeight}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="80"
                value={formData.aiVisionWeight}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  handleChange('aiVisionWeight', val);
                  handleChange('aiTextWeight', 100 - val);
                }}
                className="w-full accent-[#E0681A]"
              />
              <p className="text-[11px] text-[#566475] mt-1">
                Balances on-device image classifier vs citizen voice/text transcription in deciding category confidence.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Geo-Fencing & Anti-Tamper Verification */}
        <div className="p-5 bg-white rounded-xl border border-[#D6DFE8] shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Camera className="w-4 h-4 text-[#1D7A45]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#16212E]">
              3. Geofence & Photo Proof Distance Thresholds
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#16212E] mb-1">
                Officer Resolution Photo Geo-Fence (Meters)
              </label>
              <input
                type="number"
                min="50"
                max="500"
                value={formData.afterPhotoMaxDistanceMeters}
                onChange={(e) => handleChange('afterPhotoMaxDistanceMeters', parseInt(e.target.value) || 200)}
                className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg"
              />
              <p className="text-[11px] text-[#566475] mt-1">
                If officer takes completion photo &gt;200m from original citizen complaint pin, supervisor must review distance discrepancy.
              </p>
            </div>

            <div>
              <label className="block font-bold text-[#16212E] mb-1">
                Citizen Photo EXIF Distance Max (Meters)
              </label>
              <input
                type="number"
                min="100"
                max="1000"
                value={formData.citizenPhotoMaxDistanceMeters}
                onChange={(e) => handleChange('citizenPhotoMaxDistanceMeters', parseInt(e.target.value) || 500)}
                className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg"
              />
              <p className="text-[11px] text-[#566475] mt-1">
                Maximum distance between camera GPS metadata and chosen map pin before flagging as UNVERIFIED.
              </p>
            </div>

            <div>
              <label className="block font-bold text-[#16212E] mb-1">
                Duplicate Incident Radius (Meters)
              </label>
              <input
                type="number"
                min="25"
                max="300"
                value={formData.duplicateRadiusMeters}
                onChange={(e) => handleChange('duplicateRadiusMeters', parseInt(e.target.value) || 100)}
                className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg"
              />
              <p className="text-[11px] text-[#566475] mt-1">
                Radius for suggesting nearby duplicates within the 7-day active window.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#0B3D66] hover:bg-[#093254] text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Save System Governance Rules</span>
          </button>
        </div>
      </form>
    </div>
  );
};
