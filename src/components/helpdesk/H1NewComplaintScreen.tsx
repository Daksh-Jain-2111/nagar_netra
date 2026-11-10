import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Complaint } from '../../types';
import { 
  PhoneCall, 
  User, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink, 
  ArrowRight, 
  FileText, 
  ShieldAlert,
  Copy,
  Check
} from 'lucide-react';

export const H1NewComplaintScreen: React.FC = () => {
  const { 
    categories, 
    helpdeskCreateComplaint, 
    logHelpdeskRedirect,
    navigateTo 
  } = useApp();

  const [channel, setChannel] = useState<'Phone' | 'Walk-in' | 'WhatsApp' | 'Aaple Sarkar'>('Phone');
  const [citizenMobile, setCitizenMobile] = useState<string>('');
  const [citizenName, setCitizenName] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || 'roads_potholes');
  const [wardNumber, setWardNumber] = useState<number>(12);
  const [address, setAddress] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isDangerToLife, setIsDangerToLife] = useState<boolean>(false);

  const [createdComplaint, setCreatedComplaint] = useState<Complaint | null>(null);
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  const selectedCategory = categories.find(c => c.id === categoryId);
  const isRedirectOnly = selectedCategory?.isRedirectOnly;

  const handleLogRedirect = () => {
    if (!selectedCategory) return;
    logHelpdeskRedirect(
      selectedCategory.nameEn,
      selectedCategory.redirectAgency || 'External Utility',
      selectedCategory.redirectPhone || '1912',
      isAnonymous ? undefined : citizenMobile,
      `Operator provided external agency redirect instructions for ${selectedCategory.nameEn}`
    );
    setRedirectNotice(`Redirect logged for ${selectedCategory.redirectAgency} (${selectedCategory.redirectPhone}). Form reset.`);
    // Reset form
    setCitizenMobile('');
    setCitizenName('');
    setDescription('');
    setAddress('');
    setTimeout(() => setRedirectNotice(null), 5000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !address.trim()) return;

    if (!isAnonymous && citizenMobile.trim()) {
      const regex = /^[6-9]\d{9}$/;
      if (!regex.test(citizenMobile.trim())) {
        alert('Please enter a valid 10-digit Indian mobile number starting with 6-9');
        return;
      }
    }

    const complaint = helpdeskCreateComplaint({
      channel,
      citizenMobile: isAnonymous ? undefined : citizenMobile.trim() || undefined,
      citizenName: isAnonymous ? undefined : citizenName.trim() || undefined,
      isAnonymous,
      description: description.trim(),
      categoryId,
      address: address.trim(),
      wardNumber,
      isDangerToLife
    });

    setCreatedComplaint(complaint);
  };

  const handleCopyTrackingNumber = () => {
    if (createdComplaint) {
      navigator.clipboard.writeText(createdComplaint.trackingNumber);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  };

  const handleResetForNextCall = () => {
    setCreatedComplaint(null);
    setCitizenMobile('');
    setCitizenName('');
    setIsAnonymous(false);
    setDescription('');
    setAddress('');
    setIsDangerToLife(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D6DFE8]">
        <div>
          <h2 className="text-xl font-bold text-[#16212E] tracking-tight">
            Assisted Intake: Register Grievance
          </h2>
          <p className="text-xs text-[#566475] mt-0.5">
            Log telephonic or walk-in citizen issues · Official Helpline 0233-2373455
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-[#D6DFE8] rounded-lg text-[#0B3D66] flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5 text-[#1D7A45]" />
            <span>Active Operator Line</span>
          </span>
        </div>
      </div>

      {redirectNotice && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
          <span className="font-medium">{redirectNotice}</span>
        </div>
      )}

      {/* Confirmation Card after submission */}
      {createdComplaint ? (
        <div className="p-6 bg-white rounded-2xl border-2 border-[#1D7A45] shadow-lg space-y-5">
          <div className="flex items-center gap-3 text-[#1D7A45]">
            <CheckCircle2 className="w-8 h-8" />
            <div>
              <h3 className="font-black text-lg text-[#16212E]">
                Complaint Successfully Registered!
              </h3>
              <p className="text-xs text-[#566475]">
                Read the tracking number below to the citizen caller.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-[#D6DFE8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-[#566475] uppercase block">
                SMKMC Tracking Number
              </span>
              <strong className="text-2xl font-mono font-black text-[#0B3D66] tracking-wider">
                {createdComplaint.trackingNumber}
              </strong>
            </div>

            <button
              onClick={handleCopyTrackingNumber}
              className="px-3 py-2 bg-white border border-[#D6DFE8] rounded-lg text-xs font-bold text-[#16212E] hover:bg-slate-100 flex items-center gap-1.5 self-start sm:self-auto"
            >
              {copiedId ? <Check className="w-4 h-4 text-[#1D7A45]" /> : <Copy className="w-4 h-4 text-[#566475]" />}
              <span>{copiedId ? 'Copied!' : 'Copy Tracking ID'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-white rounded-lg border border-[#D6DFE8]">
              <span className="text-[10px] text-[#566475] font-bold block uppercase">Category</span>
              <strong className="text-[#16212E] mt-0.5 block">{createdComplaint.categoryNameEn}</strong>
              <span className="text-[11px] text-[#566475]">{createdComplaint.department}</span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-[#D6DFE8]">
              <span className="text-[10px] text-[#566475] font-bold block uppercase">Resolution SLA</span>
              <strong className="text-[#1D7A45] mt-0.5 block">
                {new Date(createdComplaint.resolutionDeadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </strong>
              <span className="text-[11px] text-[#566475]">Response Clock: 48 hours</span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-[#D6DFE8]">
              <span className="text-[10px] text-[#566475] font-bold block uppercase">Location</span>
              <strong className="text-[#16212E] mt-0.5 block">Ward {createdComplaint.wardNumber}</strong>
              <span className="text-[11px] text-[#566475] truncate block">{createdComplaint.address}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleResetForNextCall}
              className="flex-1 py-2.5 bg-[#0B3D66] text-white rounded-xl text-xs font-bold hover:bg-[#093254] transition-colors"
            >
              Take Next Call / File New
            </button>

            <button
              onClick={() => navigateTo('H2_SEARCH_STATUS')}
              className="px-4 py-2.5 bg-slate-100 text-[#16212E] rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
            >
              Search & Status Desk
            </button>
          </div>
        </div>
      ) : (
        /* Intake Form */
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-5 bg-white rounded-xl border border-[#D6DFE8] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#16212E]">
                1. Caller & Intake Channel
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#566475]">Channel:</span>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as any)}
                  className="text-xs border border-[#D6DFE8] rounded-md px-2 py-1 bg-white font-semibold text-[#0B3D66]"
                >
                  <option value="Phone">Helpline Phone (0233-2373455)</option>
                  <option value="Walk-in">Citizen Facilitation Center (Walk-in)</option>
                  <option value="WhatsApp">Citizen WhatsApp Helpdesk</option>
                  <option value="Aaple Sarkar">Aaple Sarkar Portal Import</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-[#16212E] mb-1">
                  Caller Mobile Number
                </label>
                <div className="flex gap-2">
                  <span className="px-3 py-2 bg-slate-100 border border-[#D6DFE8] rounded-lg font-mono text-[#566475]">
                    +91
                  </span>
                  <input
                    type="tel"
                    disabled={isAnonymous}
                    value={citizenMobile}
                    onChange={(e) => setCitizenMobile(e.target.value)}
                    placeholder="9822000000"
                    className="flex-1 px-3 py-2 border border-[#D6DFE8] rounded-lg focus:ring-2 focus:ring-[#0B3D66] focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#16212E] mb-1">
                  Citizen Name (Optional)
                </label>
                <input
                  type="text"
                  disabled={isAnonymous}
                  value={citizenName}
                  onChange={(e) => setCitizenName(e.target.value)}
                  placeholder="Leave empty if not provided"
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg focus:ring-2 focus:ring-[#0B3D66] focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#566475]">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded text-[#0B3D66] focus:ring-[#0B3D66] w-4 h-4"
                />
                <span className="font-semibold text-[#16212E]">
                  Caller requested anonymity (Hide name and phone from department officers)
                </span>
              </label>
            </div>
          </div>

          {/* Section 2: Category & Redirect Check */}
          <div className="p-5 bg-white rounded-xl border border-[#D6DFE8] shadow-xs space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#16212E] border-b border-slate-100 pb-2">
              2. Grievance Category & Jurisdiction Verification
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#16212E] mb-1">Select Issue Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg bg-white font-medium text-xs text-[#16212E]"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nameEn} ({c.nameMr}) — {c.isRedirectOnly ? `[REDIRECT: ${c.redirectAgency}]` : c.department}
                    </option>
                  ))}
                </select>
              </div>

              {/* External Agency Redirect Script Banner */}
              {isRedirectOnly && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5 text-amber-900">
                    <ExternalLink className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-amber-950">
                        External Utility Redirect: {selectedCategory?.redirectAgency}
                      </h4>
                      <p className="text-xs text-amber-900 mt-1">
                        This issue falls under external jurisdiction. Do not register a municipal complaint. Read the script below to the citizen:
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-amber-200 text-xs italic text-slate-800 font-serif leading-relaxed">
                    &ldquo;Sir/Madam, issues regarding {selectedCategory?.nameEn} are maintained directly by <strong>{selectedCategory?.redirectAgency}</strong>. Please dial their official direct helpline at <strong>{selectedCategory?.redirectPhone}</strong>.&rdquo;
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleLogRedirect}
                      className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
                    >
                      Log Redirection Call (No Ticket Created)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Location & Details (Only active if not redirect-only) */}
          {!isRedirectOnly && (
            <div className="p-5 bg-white rounded-xl border border-[#D6DFE8] shadow-xs space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#16212E] border-b border-slate-100 pb-2">
                3. Incident Location & Grievance Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#16212E] mb-1">Ward Number (1-20)</label>
                  <select
                    value={wardNumber}
                    onChange={(e) => setWardNumber(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg bg-white"
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w}>Ward {w}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#16212E] mb-1">
                    Landmark / Street Address (स्मृती / परिसर)
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Near Vishrambag Ganpati Temple, Sangli"
                    className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg focus:ring-2 focus:ring-[#0B3D66] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-bold text-[#16212E] mb-1">
                  Issue Description & Specific Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Record citizen's exact issue details, severity, location landmarks..."
                  className="w-full px-3 py-2 border border-[#D6DFE8] rounded-lg focus:ring-2 focus:ring-[#0B3D66] focus:outline-hidden"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">
                  <input
                    type="checkbox"
                    checked={isDangerToLife}
                    onChange={(e) => setIsDangerToLife(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-600 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold block">
                      Emergency / Danger to Life (24h accelerated response clock)
                    </span>
                    <span className="text-[11px] text-red-600">
                      e.g. Open live manhole, fallen high-tension wire, building collapse risk
                    </span>
                  </div>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#0B3D66] hover:bg-[#093254] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Register Grievance & Generate Tracking ID</span>
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
