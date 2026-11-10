import React from 'react';

export const SovereignStrip: React.FC = () => {
  return (
    <div className="w-full h-[3px] flex" aria-hidden="true">
      <div className="h-full w-1/3 bg-[#FF9933]" />
      <div className="h-full w-1/3 bg-[#FFFFFF]" />
      <div className="h-full w-1/3 bg-[#138808]" />
    </div>
  );
};

export const SmkmcLogo: React.FC<{ size?: number; className?: string }> = ({ size = 36, className = '' }) => {
  return (
    <div 
      className={`relative flex items-center justify-center shrink-0 rounded-full border border-[#D6DFE8] bg-white shadow-xs overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title="सांगली, मिरज आणि कुपवाड महानगरपालिका"
    >
      {/* SVG Emblem representing Sangli Miraj Kupwad Municipal Corporation */}
      <svg viewBox="0 0 100 100" className="w-full h-full p-0.5">
        <circle cx="50" cy="50" r="48" fill="#0B3D66" />
        <circle cx="50" cy="50" r="44" fill="#FFFFFF" stroke="#E0681A" strokeWidth="2" />
        {/* Ashoka Chakra & Municipal Fort Motif */}
        <circle cx="50" cy="50" r="18" fill="#0B3D66" />
        <path d="M50 20 L53 30 L47 30 Z" fill="#E0681A" />
        <path d="M50 80 L53 70 L47 70 Z" fill="#138808" />
        <path d="M20 50 L30 53 L30 47 Z" fill="#0B3D66" />
        <path d="M80 50 L70 53 L70 47 Z" fill="#0B3D66" />
        <circle cx="50" cy="50" r="7" fill="#FFFFFF" />
        <circle cx="50" cy="50" r="3" fill="#0B3D66" />
      </svg>
    </div>
  );
};
