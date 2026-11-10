import React from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { MOCK_CATEGORIES, MOCK_NOTICES } from '../../data/mockData';
import { 
  PlusCircle, 
  Clock, 
  ChevronRight, 
  AlertCircle, 
  Trash2, 
  Construction, 
  Lightbulb, 
  Waves, 
  Droplet, 
  AlertOctagon, 
  PhoneCall, 
  Sparkles,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const C1CitizenHomeScreen: React.FC = () => {
  const { language, navigateTo, complaints, selectComplaint, currentUser, updateDraft } = useApp();

  // Find active complaint for user
  const activeComplaint = complaints.find(c => 
    c.status === 'ASSIGNED' || 
    c.status === 'IN_PROGRESS' || 
    c.status === 'WORK_SCHEDULED' || 
    c.status === 'TO_CHECK' ||
    c.status === 'SUBMITTED'
  );

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Trash2': return <Trash2 className="w-5 h-5 text-[#E0681A]" />;
      case 'Construction': return <Construction className="w-5 h-5 text-[#A86A0C]" />;
      case 'Lightbulb': return <Lightbulb className="w-5 h-5 text-[#0B3D66]" />;
      case 'Waves': return <Waves className="w-5 h-5 text-[#5B3FA6]" />;
      case 'Droplet': return <Droplet className="w-5 h-5 text-[#0B3D66]" />;
      case 'AlertOctagon': return <AlertOctagon className="w-5 h-5 text-[#B42318]" />;
      default: return <AlertCircle className="w-5 h-5 text-[#566475]" />;
    }
  };

  const handleQuickCategoryReport = (catId: string) => {
    const cat = MOCK_CATEGORIES.find(c => c.id === catId);
    if (cat) {
      updateDraft({
        categoryId: cat.id,
        categoryNameMr: cat.nameMr,
        categoryNameEn: cat.nameEn,
        departmentMr: cat.departmentMr,
        departmentEn: cat.department,
      });
    }
    navigateTo('C2_MEDIA');
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24">
      <Header />

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Citizen Greeting & Ward Badge */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#566475] font-semibold">
              {language === 'mr' ? 'स्वागत आहे' : 'Welcome'}
            </p>
            <h2 className="text-sm font-bold text-[#16212E]">
              {currentUser?.name || 'सचिन दत्तात्रय पाटील'}
            </h2>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#0B3D66]/10 text-[#0B3D66] border border-[#0B3D66]/20">
              प्रभाग ७ • विश्रामबाग
            </span>
            <p className="text-[10px] text-[#566475] mt-0.5">सांगली शहर</p>
          </div>
        </div>

        {/* Primary Hero Call to Action: Report Issue (Stitch Saffron #E0681A Accent) */}
        <div className="bg-gradient-to-br from-[#0B3D66] to-[#082d4d] text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#FFDB99]">
              <Sparkles className="w-4 h-4 text-[#FFDB99]" />
              <span>NagarNetra AI • ऑन-डिव्हाइस कॅमेरा व जिओ-टॅग</span>
            </div>

            <div>
              <h3 className="text-base font-bold leading-tight">
                {language === 'mr' ? 'नागरी समस्येचा फोटो काढून नोंदवा' : 'Report Civic Issue with Photo & GPS'}
              </h3>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                {language === 'mr' 
                  ? 'खड्डे, साचलेला कचरा, बंद पथदिवे किंवा सांडपाणी – AI द्वारे स्वयंचलित विभाग व प्रभाग वाटप.' 
                  : 'Potholes, open garbage, streetlights, or drainage. Instant AI triage and SLA tracking.'}
              </p>
            </div>

            <button
              onClick={() => navigateTo('C2_MEDIA')}
              className="w-full min-h-[46px] bg-[#E0681A] hover:bg-[#c95914] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-all"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.2]" />
              <span>{language === 'mr' ? 'नवीन तक्रार नोंदवा (Report Issue)' : 'Report Civic Issue'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>

          {/* Decorative faint background ring */}
          <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full border-8 border-white/5 pointer-events-none" />
        </div>

        {/* Active Complaint Tracker Card (If user has ongoing issue) */}
        {activeComplaint && (
          <div className="bg-white rounded-xl border border-[#D6DFE8] p-3.5 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#16212E] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#0B3D66]" />
                {language === 'mr' ? 'सक्रिय तक्रार ट्रॅकिंग' : 'Active Complaint Tracking'}
              </span>
              <span className="text-[10px] font-mono font-bold text-[#0B3D66] bg-[#0B3D66]/10 px-2 py-0.5 rounded">
                {activeComplaint.id}
              </span>
            </div>

            <div className="flex items-start gap-3 pt-1">
              {activeComplaint.photoUrls[0] && (
                <img
                  src={activeComplaint.photoUrls[0]}
                  alt="Complaint thumbnail"
                  className="w-14 h-14 rounded-lg object-cover border border-[#D6DFE8] shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-[#16212E] truncate">
                  {language === 'mr' ? activeComplaint.categoryNameMr : activeComplaint.categoryNameEn}
                </h4>
                <p className="text-[11px] text-[#566475] truncate mt-0.5">
                  {activeComplaint.landmark || activeComplaint.address}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    activeComplaint.status === 'IN_PROGRESS' || activeComplaint.status === 'WORK_SCHEDULED'
                      ? 'bg-[#0B3D66] text-white' 
                      : 'bg-[#A86A0C] text-white'
                  }`}>
                    {activeComplaint.status === 'IN_PROGRESS' || activeComplaint.status === 'WORK_SCHEDULED' ? 'काम सुरू (In Progress)' : 'प्रलंबित (Open)'}
                  </span>
                  <span className="text-[10px] text-[#566475]">
                    SLA: २४ तास शिल्लक
                  </span>
                </div>
              </div>
            </div>

            {/* SLA Progress Bar */}
            <div className="pt-1">
              <div className="w-full bg-[#F4F7FA] h-2 rounded-full overflow-hidden border border-[#D6DFE8]">
                <div className="bg-[#0B3D66] h-full rounded-full w-2/3" />
              </div>
            </div>

            <button
              onClick={() => selectComplaint(activeComplaint.id, 'C8_DETAIL')}
              className="w-full py-2 bg-[#F4F7FA] hover:bg-slate-100 text-[#0B3D66] text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors border border-[#D6DFE8]"
            >
              <span>{language === 'mr' ? 'तपशील व प्रत्यक्ष स्थिती पहा' : 'View Live Timeline'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Municipal Categories Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#16212E]">
              {language === 'mr' ? 'थेट विभाग तक्रार (Quick Categories)' : 'Civic Service Departments'}
            </h3>
            <button
              onClick={() => navigateTo('C2_MEDIA')}
              className="text-[11px] font-bold text-[#0B3D66] hover:underline"
            >
              {language === 'mr' ? 'सर्व पहा' : 'View all'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {MOCK_CATEGORIES.slice(0, 6).map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleQuickCategoryReport(cat.id)}
                className="bg-white p-2.5 rounded-xl border border-[#D6DFE8] hover:border-[#0B3D66] transition-all flex flex-col items-center text-center group shadow-2xs"
              >
                <div className="w-10 h-10 rounded-lg bg-[#F4F7FA] group-hover:bg-[#0B3D66]/5 flex items-center justify-center mb-1.5 transition-colors">
                  {getCategoryIcon(cat.iconName)}
                </div>
                <span className="text-[11px] font-bold text-[#16212E] leading-tight line-clamp-2">
                  {language === 'mr' ? cat.nameMr : cat.nameEn}
                </span>
                <span className="text-[9px] text-[#566475] mt-1 font-mono">
                  SLA {cat.slaHours}h
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Official SMKMC Circulars & Notices */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-3.5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between pb-1 border-b border-[#D6DFE8]">
            <h3 className="text-xs font-bold text-[#0B3D66] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0B3D66]" />
              {language === 'mr' ? 'मनपा अधिकृत परिपत्रके व सूचना' : 'Official Circulars & Notices'}
            </h3>
            <span className="text-[10px] text-[#566475]">SMKMC</span>
          </div>

          <div className="divide-y divide-[#D6DFE8]/60">
            {MOCK_NOTICES.map((n) => (
              <div key={n.id} className="py-2 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-center gap-2">
                  {n.isUrgent && (
                    <span className="px-1.5 py-0.2 rounded bg-[#B42318] text-white text-[9px] font-bold">
                      तातडीचे
                    </span>
                  )}
                  <span className="text-[10px] text-[#566475] font-semibold">
                    {language === 'mr' ? n.departmentMr : n.departmentEn} • {n.date}
                  </span>
                </div>
                <p className="text-xs font-medium text-[#16212E] leading-snug">
                  {language === 'mr' ? n.titleMr : n.titleEn}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Quick Helpline Bar */}
        <div className="bg-[#F4F7FA] rounded-xl border border-[#D6DFE8] p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#B42318]/10 text-[#B42318] flex items-center justify-center shrink-0">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#16212E]">
                मनपा नियंत्रण कक्ष: 0233-2373031
              </p>
              <p className="text-[10px] text-[#566475]">
                २४x७ आपत्कालीन व तक्रार सहाय्य
              </p>
            </div>
          </div>
          <a
            href="tel:02332373031"
            className="px-3 py-1.5 bg-[#0B3D66] text-white text-[11px] font-bold rounded-lg hover:bg-[#082d4d]"
          >
            कॉल
          </a>
        </div>
      </div>
    </div>
  );
};
