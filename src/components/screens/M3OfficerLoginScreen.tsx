import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SovereignStrip, SmkmcLogo } from '../common/SovereignStrip';
import { ShieldCheck, Eye, EyeOff, KeyRound, AlertCircle, Phone, CheckCircle, Info } from 'lucide-react';

export const M3OfficerLoginScreen: React.FC = () => {
  const { language, loginWithEmail, navigateTo } = useApp();

  const [activeTab, setActiveTab] = useState<'LOGIN' | 'INVITE'>('LOGIN');

  // Login form state
  const [identifier, setIdentifier] = useState<string>('officer.roads@smkmc.demo');
  const [password, setPassword] = useState<string>('Demo@123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [showForgotPasswordDialog, setShowForgotPasswordDialog] = useState<boolean>(false);

  // Invite flow state
  // Steps: 'CODE_INPUT' | 'INVITE_DETAILS' | 'PENDING_APPROVAL'
  const [inviteStep, setInviteStep] = useState<'CODE_INPUT' | 'INVITE_DETAILS' | 'PENDING_APPROVAL'>('CODE_INPUT');
  const [inviteCode, setInviteCode] = useState<string>('SMKMC-W7-984');
  const [inviteError, setInviteError] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setLoginError(language === 'mr' ? 'कृपया ईमेल/मोबाईल आणि संकेतशब्द टाका.' : 'Please enter identifier and password.');
      return;
    }

    const success = loginWithEmail(identifier, password);
    if (!success) {
      setLoginError('Invalid credentials. Password is Demo@123');
    }
  };

  const handleQuickLogin = (email: string) => {
    setIdentifier(email);
    setPassword('Demo@123');
    loginWithEmail(email, 'Demo@123');
  };

  const handleVerifyInviteCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inviteCode.trim().toUpperCase();
    if (cleanCode === 'SMKMC-W7-984') {
      setInviteError('');
      setInviteStep('INVITE_DETAILS');
    } else {
      setInviteError(
        language === 'mr' 
          ? 'अवैध आमंत्रण कोड. डेमोसाठी SMKMC-W7-984 वापरा.' 
          : 'Invalid invite code. Try demo code SMKMC-W7-984.'
      );
    }
  };

  const handleCompleteInviteActivation = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setInviteError(language === 'mr' ? 'संकेतशब्द किमान ६ अक्षरांचा असावा.' : 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setInviteError(language === 'mr' ? 'संकेतशब्द जुळत नाहीत.' : 'Passwords do not match.');
      return;
    }
    setInviteError('');
    setInviteStep('PENDING_APPROVAL');
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex flex-col justify-between">
      <div>
        <SovereignStrip />

        {/* Top Role Switcher */}
        <div className="bg-white border-b border-[#D6DFE8]">
          <div className="max-w-md mx-auto grid grid-cols-2">
            <button
              onClick={() => navigateTo('M2_CITIZEN_LOGIN')}
              className="py-3 text-xs font-semibold text-[#566475] hover:text-[#0B3D66] hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Phone className="w-4 h-4" />
              <span>{language === 'mr' ? 'नागरिक प्रवेश' : 'Citizen Login'}</span>
            </button>
            <button
              onClick={() => setActiveTab('LOGIN')}
              className="py-3 text-xs font-bold text-[#0B3D66] border-b-2 border-[#0B3D66] bg-[#F4F7FA]/50 flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{language === 'mr' ? 'अधिकारी पोर्टल' : 'Officer Portal'}</span>
            </button>
          </div>
        </div>

        {/* Brand Header */}
        <div className="px-5 pt-6 pb-3 text-center max-w-md mx-auto">
          <div className="flex justify-center mb-2">
            <SmkmcLogo size={52} />
          </div>
          <h1 className="text-base font-bold text-[#0B3D66] leading-tight">
            सांगली, मिरज आणि कुपवाड महानगरपालिका
          </h1>
          <p className="text-xs text-[#566475] mt-0.5 font-medium">
            प्रशासकीय व क्षेत्रीय अधिकारी पोर्टल (Field Officers & DMC)
          </p>
        </div>

        {/* Main Card */}
        <div className="px-4 max-w-md mx-auto">
          <div className="bg-white rounded-xl border border-[#D6DFE8] p-5 shadow-xs">
            {/* Sub-tab: Login vs Invite Code */}
            <div className="flex rounded-lg bg-[#F4F7FA] p-1 mb-5 border border-[#D6DFE8]">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('LOGIN');
                  setInviteStep('CODE_INPUT');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  activeTab === 'LOGIN' ? 'bg-white text-[#0B3D66] shadow-2xs' : 'text-[#566475]'
                }`}
              >
                {language === 'mr' ? 'प्रवेश करा (Sign In)' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('INVITE')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  activeTab === 'INVITE' ? 'bg-white text-[#0B3D66] shadow-2xs' : 'text-[#566475]'
                }`}
              >
                {language === 'mr' ? 'आमंत्रण कोड (Invite)' : 'Activate Invite'}
              </button>
            </div>

            {activeTab === 'LOGIN' ? (
              /* Officer Login Form */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#16212E] mb-1">
                    {language === 'mr' ? 'शासकीय ईमेल किंवा मोबाईल क्रमांक' : 'Gov Email or Mobile'}
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="officer@smkmc.gov.in / 9822XXXXXX"
                    className="w-full px-3 py-2.5 text-xs font-medium text-[#16212E] border border-[#D6DFE8] rounded-lg focus:border-[#0B3D66] focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#16212E]">
                      {language === 'mr' ? 'संकेतशब्द (Password)' : 'Password'}
                    </label>
                    {/* Forgot Password Link -> Triggers Rule Dialog */}
                    <button
                      type="button"
                      onClick={() => setShowForgotPasswordDialog(true)}
                      className="text-[11px] font-bold text-[#E0681A] hover:underline"
                    >
                      {language === 'mr' ? 'संकेतशब्द विसरलात?' : 'Forgot password?'}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 pr-10 text-xs font-medium text-[#16212E] border border-[#D6DFE8] rounded-lg focus:border-[#0B3D66] focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-[#566475] hover:text-[#16212E]"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <p className="text-[11px] font-medium text-[#B42318]">{loginError}</p>
                )}

                <button
                  type="submit"
                  className="w-full min-h-[46px] bg-[#0B3D66] text-white font-bold text-sm rounded-lg hover:bg-[#082d4d] active:scale-[0.99] transition-all flex items-center justify-center shadow-xs"
                >
                  {language === 'mr' ? 'अधिकारी प्रवेश (Log In)' : 'Officer Sign In'}
                </button>

                {/* Quick 1-tap demo credentials helper */}
                <div className="p-2.5 rounded-lg bg-[#F4F7FA] border border-[#D6DFE8] text-center">
                  <p className="text-[11px] text-[#566475] mb-1.5 font-medium">
                    डेमो अधिकारी खात्यात थेट प्रवेश करा:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier('officer.roads@smkmc.demo');
                      setPassword('Demo@123');
                      loginWithEmail('officer.roads@smkmc.demo', 'Demo@123');
                    }}
                    className="w-full py-1.5 px-3 bg-white border border-[#0B3D66] text-[#0B3D66] rounded-md text-xs font-bold hover:bg-[#0B3D66]/5"
                  >
                    1-Tap Demo Officer Login (Roads Dept · Demo@123)
                  </button>
                </div>
              </form>
            ) : (
              /* Invite Flow */
              <div>
                {inviteStep === 'CODE_INPUT' && (
                  <form onSubmit={handleVerifyInviteCode} className="space-y-4">
                    <div>
                      <h2 className="text-sm font-bold text-[#16212E]">
                        {language === 'mr' ? 'मनपा आमंत्रण कोड टाका' : 'Enter Corporation Invite Code'}
                      </h2>
                      <p className="text-[12px] text-[#566475] mt-0.5">
                        {language === 'mr' 
                          ? 'उपायुक्त किंवा विभाग प्रमुखांनी दिलेला अधिकृत कोड टाका.' 
                          : 'Enter the activation code issued by DMC or HOD.'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#16212E] mb-1">
                        {language === 'mr' ? 'आमंत्रण कोड (Invite Code)' : 'Invite Code'}
                      </label>
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="SMKMC-W7-984"
                        className="w-full px-3 py-2.5 font-mono text-sm font-bold text-[#0B3D66] tracking-wider uppercase border border-[#D6DFE8] rounded-lg focus:border-[#0B3D66] focus:outline-hidden"
                      />
                    </div>

                    {/* Demo code hint */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#566475]">डेमो कोड:</span>
                      <button
                        type="button"
                        onClick={() => setInviteCode('SMKMC-W7-984')}
                        className="font-mono font-bold text-[#E0681A] hover:underline"
                      >
                        SMKMC-W7-984 (Fill)
                      </button>
                    </div>

                    {inviteError && (
                      <p className="text-[11px] font-medium text-[#B42318]">{inviteError}</p>
                    )}

                    <button
                      type="submit"
                      className="w-full min-h-[46px] bg-[#0B3D66] text-white font-bold text-sm rounded-lg hover:bg-[#082d4d] active:scale-[0.99] transition-all flex items-center justify-center shadow-xs"
                    >
                      {language === 'mr' ? 'कोड तपासा (Verify Code)' : 'Verify Code'}
                    </button>
                  </form>
                )}

                {inviteStep === 'INVITE_DETAILS' && (
                  /* Invite details: invited by, role, department – NO ward assignment as per rule */
                  <form onSubmit={handleCompleteInviteActivation} className="space-y-4">
                    <div className="p-3.5 bg-[#F4F7FA] rounded-xl border border-[#D6DFE8] space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#1D7A45]">
                        <CheckCircle className="w-4 h-4 text-[#1D7A45]" />
                        <span>आमंत्रण पडताळणी यशस्वी</span>
                      </div>
                      
                      <div className="text-xs space-y-1.5 pt-1 text-[#16212E]">
                        <div className="flex justify-between py-1 border-b border-[#D6DFE8]">
                          <span className="text-[#566475]">Invited by:</span>
                          <span className="font-bold">DMC (Zone 2) / उपायुक्त (झोन २)</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#D6DFE8]">
                          <span className="text-[#566475]">Assigned Role:</span>
                          <span className="font-bold text-[#0B3D66]">Field Officer (क्षेत्रीय अधिकारी)</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-[#566475]">Department:</span>
                          <span className="font-bold">Solid Waste Management (घनकचरा व्यवस्थापन)</span>
                        </div>
                      </div>

                      {/* Rule Note: Ward assignment is strictly omitted as per functional instructions! */}
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-[#16212E] mb-2">
                        {language === 'mr' ? 'नवीन संकेतशब्द तयार करा' : 'Set Account Password'}
                      </h3>
                      <div className="space-y-2.5">
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="नवीन संकेतशब्द (New Password)"
                            className="w-full px-3 py-2 text-xs font-medium text-[#16212E] border border-[#D6DFE8] rounded-lg focus:border-[#0B3D66] focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-2 text-[#566475]"
                          >
                            {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="संकेतशब्द पुन्हा टाका (Confirm Password)"
                          className="w-full px-3 py-2 text-xs font-medium text-[#16212E] border border-[#D6DFE8] rounded-lg focus:border-[#0B3D66] focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {inviteError && (
                      <p className="text-[11px] font-medium text-[#B42318]">{inviteError}</p>
                    )}

                    <button
                      type="submit"
                      className="w-full min-h-[46px] bg-[#0B3D66] text-white font-bold text-sm rounded-lg hover:bg-[#082d4d] active:scale-[0.99] transition-all flex items-center justify-center shadow-xs"
                    >
                      {language === 'mr' ? 'खाते सक्रिय करा' : 'Submit & Activate'}
                    </button>
                  </form>
                )}

                {inviteStep === 'PENDING_APPROVAL' && (
                  /* Pending supervisor approval screen (Rule) */
                  <div className="py-4 text-center space-y-3">
                    <div className="w-14 h-14 bg-[#A86A0C]/10 text-[#A86A0C] rounded-full flex items-center justify-center mx-auto border border-[#A86A0C]/20">
                      <AlertCircle className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-[#16212E]">
                      {language === 'mr' 
                        ? 'पर्यवेक्षकांच्या मंजुरीची प्रतीक्षा आहे' 
                        : 'Pending Supervisor Approval'}
                    </h3>
                    <p className="text-xs text-[#566475] leading-relaxed max-w-xs mx-auto">
                      {language === 'mr'
                        ? 'आपले खाते तयार झाले आहे. उपायुक्त (DMC 2) किंवा प्रभाग पर्यवेक्षकांनी मंजुरी दिल्यानंतर आपण कार्य सुरू करू शकाल.'
                        : 'Your officer profile is registered. Activation will complete once DMC 2 approves your verification request.'}
                    </p>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('LOGIN');
                          setInviteStep('CODE_INPUT');
                        }}
                        className="w-full py-2.5 bg-[#0B3D66] text-white text-xs font-bold rounded-lg hover:bg-[#082d4d]"
                      >
                        {language === 'mr' ? 'लॉगिन पृष्ठावर परत जा' : 'Back to Login'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog (Rule: "Contact your supervisor or corporation admin") */}
      {showForgotPasswordDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-[#D6DFE8] shadow-xl space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#0B3D66]/10 text-[#0B3D66] flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#16212E]">
              {language === 'mr' ? 'संकेतशब्द रीसेट' : 'Password Reset'}
            </h3>
            <p className="text-xs text-[#566475] leading-relaxed">
              <strong>
                {language === 'mr' 
                  ? 'तुमच्या पर्यवेक्षक किंवा मनपा प्रशासकांशी संपर्क साधा.' 
                  : 'Contact your supervisor or corporation admin.'}
              </strong>
            </p>
            <div className="p-2.5 bg-[#F4F7FA] rounded-lg text-xs space-y-1 text-[#16212E]">
              <p><strong>SMKMC IT Cell:</strong> 0233-2373031 (Ext. 204)</p>
              <p><strong>Email:</strong> admin-it@smkmc.gov.in</p>
              <p><strong>Rajwada HQ:</strong> Sangli Municipal Corporation</p>
            </div>
            <button
              onClick={() => setShowForgotPasswordDialog(false)}
              className="w-full py-2.5 bg-[#0B3D66] text-white font-bold text-xs rounded-lg hover:bg-[#082d4d]"
            >
              {language === 'mr' ? 'समजले (Close)' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 text-center max-w-md mx-auto w-full">
        <p className="text-[11px] text-[#566475]">
          SMKMC सांगली-मिरज-कुपवाड महानगरपालिका • प्रशासकीय कक्ष
        </p>
      </div>
    </div>
  );
};
