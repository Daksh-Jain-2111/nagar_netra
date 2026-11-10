import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { 
  MapPin, 
  Navigation, 
  ArrowRight, 
  Compass, 
  CheckCircle,
  Building
} from 'lucide-react';

const SANGLI_LOCATIONS = [
  {
    name: 'मारुती चौक, विश्रामबाग (सांगली)',
    wardNumber: 7,
    wardName: 'Vishrambag (Ward 7)',
    address: 'Maruti Chowk, Near Ganpati Temple, Vishrambag, Sangli',
    lat: 16.8524,
    lng: 74.5815,
  },
  {
    name: 'स्टेशन रोड, रेल्वे गेट (सांगली)',
    wardNumber: 4,
    wardName: 'Station Ward (Ward 4)',
    address: 'Station Road, Near Railway Overbridge, Sangli',
    lat: 16.8582,
    lng: 74.5768,
  },
  {
    name: 'वानलेस हॉस्पिटल चौक, मिरज',
    wardNumber: 12,
    wardName: 'Miraj Mission (Ward 12)',
    address: 'Mission Compound, Near Wanless Hospital, Miraj',
    lat: 16.8285,
    lng: 74.6462,
  },
  {
    name: 'एमआयडीसी रोड क्र. २, कुपवाड',
    wardNumber: 19,
    wardName: 'Kupwad MIDC (Ward 19)',
    address: 'Road No. 2, Near MSEB Substation, Kupwad MIDC',
    lat: 16.8415,
    lng: 74.6195,
  },
];

export const C4FileComplaintLocation: React.FC = () => {
  const { language, draftComplaint, updateDraft, navigateTo } = useApp();

  const [selectedLocIndex, setSelectedLocIndex] = useState<number>(0);
  const [landmark, setLandmark] = useState<string>(draftComplaint.landmark || 'मारुती मंदिराशेजारी');
  const [isGpsActive, setIsGpsActive] = useState<boolean>(true);

  const currentLocation = SANGLI_LOCATIONS[selectedLocIndex];

  const handleSelectLocation = (index: number) => {
    setSelectedLocIndex(index);
    const loc = SANGLI_LOCATIONS[index];
    updateDraft({
      address: loc.address,
      latitude: loc.lat,
      longitude: loc.lng,
      wardNumber: loc.wardNumber,
      wardName: loc.wardName,
    });
  };

  const handleUseCurrentGps = () => {
    setIsGpsActive(true);
    handleSelectLocation(0);
  };

  const handleProceedToReview = () => {
    updateDraft({
      landmark: landmark.trim() || 'मारुती मंदिराशेजारी',
      address: currentLocation.address,
      latitude: currentLocation.lat,
      longitude: currentLocation.lng,
      wardNumber: currentLocation.wardNumber,
      wardName: currentLocation.wardName,
    });
    navigateTo('C5_REVIEW');
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24">
      <Header 
        title={language === 'mr' ? 'तक्रार नोंदवा (पायरी ३/४)' : 'Report Issue (Step 3/4)'} 
        subtitle={language === 'mr' ? 'स्थान व प्रभाग निश्चिती' : 'Location & Ward Pinning'}
        showBack
        onBack={() => navigateTo('C3_AI_CLASSIFY')}
      />

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Step Progress Bar */}
        <div className="flex items-center justify-between text-[11px] font-bold text-[#0B3D66]">
          <span>पायरी ३: स्थान व प्रभाग वाटप</span>
          <span>७५% पूर्ण</span>
        </div>
        <div className="w-full bg-[#D6DFE8] h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#0B3D66] h-full w-3/4 rounded-full" />
        </div>

        {/* Interactive Civic Map Viewport */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] overflow-hidden shadow-xs">
          <div className="relative h-56 bg-slate-100 overflow-hidden">
            {/* OpenStreetMap simulation canvas with realistic SVG municipal grid */}
            <div className="absolute inset-0 bg-[#E8ECEF] bg-[radial-gradient(#D6DFE8_1px,transparent_1px)] [background-size:16px_16px]">
              {/* SVG roads and Krishna River curved motif passing through Sangli */}
              <svg className="w-full h-full opacity-60">
                {/* River Krishna */}
                <path d="M-20 40 Q 150 120 450 60" fill="none" stroke="#A4C4E8" strokeWidth="18" />
                {/* Major Arterial Roads */}
                <line x1="0" y1="110" x2="400" y2="110" stroke="#FFFFFF" strokeWidth="10" />
                <line x1="0" y1="110" x2="400" y2="110" stroke="#CBD5E1" strokeWidth="6" />
                <line x1="180" y1="0" x2="220" y2="240" stroke="#FFFFFF" strokeWidth="8" />
                <line x1="180" y1="0" x2="220" y2="240" stroke="#CBD5E1" strokeWidth="4" />
                <circle cx="200" cy="110" r="14" fill="#0B3D66" opacity="0.15" />
              </svg>
            </div>

            {/* GPS Marker Pin */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="px-2 py-0.5 rounded bg-[#0B3D66] text-white text-[10px] font-bold shadow-md whitespace-nowrap mb-1">
                प्रभाग {currentLocation.wardNumber}: {currentLocation.wardName}
              </div>
              <div className="relative">
                <MapPin className="w-8 h-8 text-[#E0681A] fill-[#E0681A] drop-shadow-md" />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-black/40 rounded-full" />
              </div>
            </div>

            {/* Map Top Bar Controls */}
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
              <span className="px-2 py-1 bg-white/90 backdrop-blur-xs rounded text-[10px] font-bold text-[#0B3D66] border border-[#D6DFE8] shadow-2xs">
                सांगली-मिरज-कुपवाड GIS ग्रिड
              </span>
              <button
                type="button"
                onClick={handleUseCurrentGps}
                className="px-2.5 py-1 bg-white rounded text-[10px] font-bold text-[#0B3D66] border border-[#D6DFE8] shadow-xs flex items-center gap-1 hover:bg-[#F4F7FA]"
              >
                <Navigation className="w-3 h-3 text-[#1D7A45]" />
                <span>चालू GPS</span>
              </button>
            </div>

            {/* Coordinates indicator */}
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[9px] font-mono px-2 py-0.5 rounded backdrop-blur-xs">
              Lat: {currentLocation.lat}° N, Lng: {currentLocation.lng}° E
            </div>
          </div>

          {/* Detected Ward Card */}
          <div className="p-3.5 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0B3D66] flex items-center gap-1.5">
                <Building className="w-4 h-4 text-[#0B3D66]" />
                <span>स्वयंचलित प्रभाग ओळख (Auto Ward):</span>
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#0B3D66]/10 text-[#0B3D66]">
                प्रभाग क्रमांक {currentLocation.wardNumber}
              </span>
            </div>
            <p className="text-xs text-[#16212E] font-medium">
              {currentLocation.address}
            </p>
          </div>
        </div>

        {/* Area Presets (Sangli, Miraj, Kupwad) */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-3.5 shadow-xs space-y-2">
          <p className="text-xs font-bold text-[#16212E]">
            {language === 'mr' ? 'किंवा ठिकाण निवडा (Select Area)' : 'Select Corporation Area'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SANGLI_LOCATIONS.map((loc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectLocation(idx)}
                className={`p-2 rounded-lg text-left border text-xs transition-all ${
                  selectedLocIndex === idx
                    ? 'bg-[#0B3D66]/5 border-[#0B3D66] font-bold text-[#0B3D66]'
                    : 'bg-[#F4F7FA] border-[#D6DFE8] text-[#16212E] hover:bg-slate-100'
                }`}
              >
                <span className="block truncate">{loc.name}</span>
                <span className="text-[10px] text-[#566475] block mt-0.5">प्रभाग {loc.wardNumber}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Specific Landmark Input Field */}
        <div className="bg-white rounded-xl border border-[#D6DFE8] p-3.5 shadow-xs space-y-2">
          <label className="block text-xs font-bold text-[#16212E]">
            {language === 'mr' ? 'जवळचे महत्त्वाचे ठिकाण (Landmark)' : 'Nearby Landmark'}
          </label>
          <input
            type="text"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            placeholder="उदा. मारुती मंदिराशेजारी, समर्थ किराणा समोर"
            className="w-full px-3 py-2 text-xs font-medium text-[#16212E] border border-[#D6DFE8] rounded-lg focus:border-[#0B3D66] focus:outline-hidden"
          />
          <p className="text-[11px] text-[#566475]">
            क्षेत्रीय स्वच्छता पथकाला घटनास्थळ त्वरित शोधण्यासाठी मदत होते.
          </p>
        </div>

        {/* Proceed Button */}
        <button
          type="button"
          onClick={handleProceedToReview}
          className="w-full min-h-[48px] bg-[#0B3D66] text-white font-bold text-sm rounded-lg hover:bg-[#082d4d] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-xs"
        >
          <span>{language === 'mr' ? 'पुढे जा: वर्णन व अंतिम पुनरावलोकन' : 'Next: Review & Submit'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
