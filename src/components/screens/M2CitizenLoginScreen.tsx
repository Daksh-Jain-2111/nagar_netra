import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { SovereignStrip, SmkmcLogo } from '../common/SovereignStrip';
import { ShieldCheck, Phone, CheckSquare, Square, RotateCw } from 'lucide-react';

export const M2CitizenLoginScreen: React.FC = () => {
  const { language, loginAsCitizen, navigateTo } = useApp();

  // State: 'STATE_A' = Mobile entry, 'STATE_B' = OTP entry
  const [authState, setAuthState] = useState<'STATE_A' | 'STATE_B'>('STATE_A');
  const [mobile, setMobile] = useState<string>('9822014589');
  const [name, setName] = useState<string>('Sunita Patil');
  const [mobileError, setMobileError] = useState<string>('');
  
  // OTP state
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string>('');
  const [resendTimer, setResendTimer] = useState<number>(30);
  const [consentChecked, setConsentChecked] = useState<boolean>(true); // Required privacy consent
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (authState === 'STATE_B' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [authState, resendTimer]);

  const handleSendOtp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanMobile = mobile.trim();
    const regex = /^[6-9]\d{9}$/;
    if (!regex.test(cleanMobile)) {
      setMobileError(
        language === 'mr' 
          ? 'कृपया वैध १०-अंकी भारतीय मोबाईल क्रमांक टाका (६ ते ९ ने सुरू होणारा).' 
          : 'Please enter a valid 10-digit Indian mobile number starting with 6-9.'
      );
      return;
    }
    setMobileError('');
    setAuthState('STATE_B');
    setResendTimer(30);
    setOtp(['', '', '', '', '', '']);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setOtpError('');

    // Auto-focus next input
    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleFillDemoOtp = () => {
    setOtp(['1', '2', '3', '4', '5', '6']);
    setOtpError('');
  };

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setOtpError(language === 'mr' ? 'कृपया पूर्ण ६ अंकी ओटीपी टाका.' : 'Please enter all 6 digits of the OTP.');
      return;
    }

    if (otpCode !== '123456') {
      setOtpError(language === 'mr' ? 'चुकीचा ओटीपी. डेमोसाठी 123456 वापरा.' : 'Invalid OTP. Use demo OTP 123456.');
      return;
    }

    if (!consentChecked) {
      setOtpError(language === 'mr' ? 'कृपया पुढे जाण्यासाठी गोपनीयता संमती द्या.' : 'Please agree to the privacy consent terms.');
      return;
    }

    loginAsCitizen(mobile, name);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex flex-col justify-between">
      <div>
        <SovereignStrip />

        {/* Top Role Tabs: Citizen vs Officer (Rule: Officer tab opens M3) */}
        <div className="bg-white border-b border-[#D6DFE8]">
          <div className="max-w-md mx-auto grid grid-cols-2">
            <button
              onClick={() => setAuthState('STATE_A')}
              className="py-3 text-xs font-bold text-[#0B3D66] border-b-2 border-[#0B3D66] bg-[#F4F7FA]/50 flex items-center justify-center gap-1.5"
            >
              <Phone className="w-4 h-4" />
              <span>{language === 'mr' ? 'नागरिक प्रवेश (Citizen)' : 'Citizen Login'}</span>
            </button>
            <button
              onClick={() => navigateTo('M3_OFFICER_LOGIN')}
              className="py-3 text-xs font-semibold text-[#566475] hover:text-[#0B3D66] hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{language === 'mr' ? 'अधिकारी पोर्टल (Officer)' : 'Officer Login'}</span>
            </button>
          </div>
        </div>

        {/* Brand & Emblem Lockup */}
        <div className="px-5 pt-6 pb-3 text-center max-w-md mx-auto">
          <div className="flex justify-center mb-2">
            <SmkmcLogo size={52} />
          </div>
          <h1 className="text-base font-bold text-[#0B3D66] leading-tight">
            सांगली, मिरज आणि कुपवाड महानगरपालिका
          </h1>
          <p className="text-xs text-[#566475] mt-0.5">
            नगरनेत्र • थेट नागरी तक्रार नोंदणी प्रणाली
          </p>
        </div>

        {/* Main Form Container */}
        <div className="px-4 max-w-md mx-auto">
          <div className="bg-white rounded-xl border border-[#D6DFE8] p-5 shadow-xs">
            {authState === 'STATE_A' ? (
              /* State A: Mobile Input */
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-[#16212E]">
                    {language === 'mr' ? 'मोबाईल क्रमांकाने प्रवेश करा' : 'Sign in with Mobile'}
                  </h2>
                  <p className="text-[12px] text-[#566475] mt-0.5">
                    {language === 'mr' 
                      ? 'तक्रार नोंदणीसाठी व स्थिती ट्रॅक करण्यासाठी ओटीपी पाठवला जाईल.' 
                      : 'An OTP will be sent to verify your civic identity.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#16212E] mb-1">
                    {language === 'mr' ? '१० अंकी मोबाईल क्रमांक' : 'Mobile Number'}
                  </label>
                  <div className="relative flex rounded-lg border border-[#D6DFE8] focus-within:border-[#0B3D66] focus-within:ring-1 focus-within:ring-[#0B3D66] overflow-hidden">
                    <span className="inline-flex items-center px-3 bg-[#F4F7FA] text-xs font-bold text-[#0B3D66] border-r border-[#D6DFE8]">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={mobile}
                      onChange={(e) => {
                        setMobile(e.target.value.replace(/\D/g, ''));
                        setMobileError('');
                      }}
                      placeholder="9822XXXXXX"
                      className="w-full px-3 py-2.5 text-sm font-medium text-[#16212E] placeholder:text-[#566475]/50 focus:outline-hidden"
                      autoFocus
                    />
                  </div>
                  {mobileError && (
                    <p className="text-[11px] font-medium text-[#B42318] mt-1.5">
                      {mobileError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[46px] bg-[#0B3D66] text-white font-bold text-sm rounded-lg hover:bg-[#082d4d] active:scale-[0.99] transition-all flex items-center justify-center shadow-xs"
                >
                  {language === 'mr' ? 'ओटीपी पाठवा (Send OTP)' : 'Send OTP'}
                </button>

                <div className="pt-2 border-t border-[#D6DFE8]/60 text-center">
                  <p className="text-[11px] text-[#566475]">
                    {language === 'mr' 
                      ? 'नागरी गोपनीयता हमी: तुमचा क्रमांक सुरक्षित असून व्यावसायिक प्रचारासाठी वापरला जात नाही.' 
                      : 'Civic Data Privacy: Your mobile is strictly protected under municipal charter.'}
                  </p>
                </div>
              </form>
            ) : (
              /* State B: 6-Digit OTP, 30s Timer, Name, Consent */
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[#16212E]">
                      {language === 'mr' ? '६ अंकी ओटीपी पडताळणी' : 'Enter 6-Digit OTP'}
                    </h2>
                    <p className="text-[12px] text-[#566475] mt-0.5">
                      +91 {mobile} वर पाठवला आहे.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuthState('STATE_A')}
                    className="text-[12px] font-bold text-[#E0681A] hover:underline"
                  >
                    {language === 'mr' ? 'क्रमांक बदला' : 'Change number'}
                  </button>
                </div>

                {/* 6 OTP Boxes */}
                <div>
                  <div className="flex justify-between gap-1.5 sm:gap-2">
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputsRef.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-11 h-12 text-center text-lg font-bold text-[#0B3D66] bg-[#F4F7FA] border border-[#D6DFE8] rounded-lg focus:bg-white focus:border-[#0B3D66] focus:ring-1 focus:ring-[#0B3D66] focus:outline-hidden"
                      />
                    ))}
                  </div>

                  {/* Demo OTP 123456 Hint Chip (Mandatory Rule) */}
                  <div className="flex items-center justify-between mt-2.5">
                    <button
                      type="button"
                      onClick={handleFillDemoOtp}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#E0681A]/10 text-[#E0681A] text-[11px] font-bold border border-[#E0681A]/20 hover:bg-[#E0681A]/20 transition-colors"
                    >
                      <span>Demo: OTP 123456 (Auto-fill)</span>
                    </button>

                    <div className="text-[11px] text-[#566475]">
                      {resendTimer > 0 ? (
                        <span>पुन्हा पाठवा: {resendTimer} से.</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setResendTimer(30);
                            setOtp(['', '', '', '', '', '']);
                          }}
                          className="font-bold text-[#0B3D66] hover:underline flex items-center gap-1"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>पुन्हा ओटीपी पाठवा</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Optional Full Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-[#16212E] mb-1">
                    {language === 'mr' ? 'पूर्ण नाव (ऐच्छिक)' : 'Full Name (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="उदा. सचिन दत्तात्रय पाटील"
                    className="w-full px-3 py-2 text-xs font-medium text-[#16212E] border border-[#D6DFE8] rounded-lg focus:border-[#0B3D66] focus:outline-hidden bg-white"
                  />
                </div>

                {/* REQUIRED Privacy Consent Checkbox (Strict Functional Rule) */}
                <div className="p-2.5 rounded-lg bg-[#F4F7FA] border border-[#D6DFE8]">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#0B3D66] accent-[#0B3D66] shrink-0"
                    />
                    <span className="text-[11px] text-[#16212E] leading-relaxed">
                      <strong>गोपनीयता संमती: </strong>
                      {language === 'mr' 
                        ? 'मी मान्य करतो/करते की माझा मोबाईल क्रमांक आणि नाव केवळ नागरी तक्रार निवारणासाठी आणि अ‍ॅपमधील सूचनांसाठी वापरले जाईल. कोणतीही एसएमएस किंवा व्हॉट्सअ‍ॅप जाहिरात पाठवली जाणार नाही.'
                        : 'I agree that my mobile number and name are collected solely for resolving civic complaints and receiving in-app notification updates. No promotional SMS or WhatsApp messages will be sent.'}
                    </span>
                  </label>
                </div>

                {otpError && (
                  <p className="text-[11px] font-medium text-[#B42318]">
                    {otpError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!consentChecked || otp.join('').length < 6}
                  className={`w-full min-h-[46px] font-bold text-sm rounded-lg transition-all flex items-center justify-center shadow-xs ${
                    consentChecked && otp.join('').length === 6
                      ? 'bg-[#0B3D66] text-white hover:bg-[#082d4d] active:scale-[0.99]'
                      : 'bg-[#D6DFE8] text-[#566475] cursor-not-allowed'
                  }`}
                >
                  {language === 'mr' ? 'पडताळणी करा आणि पुढे जा' : 'Verify & Continue'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 text-center max-w-md mx-auto w-full">
        <p className="text-[11px] text-[#566475]">
          SMKMC सांगली • मिरज • कुपवाड नागरी प्रशासन सेवा
        </p>
      </div>
    </div>
  );
};
