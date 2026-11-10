import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { 
  Star, 
  Send, 
  RotateCcw, 
  CheckCircle, 
  ShieldCheck, 
  ThumbsUp 
} from 'lucide-react';

export const C9RatingFeedbackScreen: React.FC = () => {
  const { 
    language, 
    selectedComplaint, 
    submitComplaintRating, 
    reopenComplaint, 
    navigateTo, 
    selectComplaint 
  } = useApp();

  const [stars, setStars] = useState<number>(5);
  const [timeliness, setTimeliness] = useState<number>(5);
  const [cleanliness, setCleanliness] = useState<number>(5);
  const [behavior, setBehavior] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState<string>('अतिशय वेळेवर आणि समाधानकारक काम झाले. मनपाचे आभार!');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  if (!selectedComplaint) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] p-8 text-center">
        <p>तक्रार सापडली नाही.</p>
        <button onClick={() => navigateTo('C7_COMPLAINTS')} className="mt-3 px-4 py-2 bg-[#0B3D66] text-white rounded">
          मागे जा
        </button>
      </div>
    );
  }

  const handleSubmitRating = (e: React.FormEvent) => {
    e.preventDefault();
    submitComplaintRating(selectedComplaint.id, stars, feedbackText);
    setIsSubmitted(true);
    setTimeout(() => {
      selectComplaint(selectedComplaint.id, 'C8_DETAIL');
    }, 1200);
  };

  const handleReopen = () => {
    reopenComplaint(selectedComplaint.id, 'कामाचा दर्जा असमाधानकारक असल्याचे नागरिकाने नोंदवले.');
    selectComplaint(selectedComplaint.id, 'C8_DETAIL');
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24">
      <Header 
        title={language === 'mr' ? 'कामाचे मूल्यमापन व अभिप्राय' : 'Rate Resolution'} 
        subtitle={selectedComplaint.trackingNumber}
        showBack
        onBack={() => selectComplaint(selectedComplaint.id, 'C8_DETAIL')}
      />

      <div className="max-w-md mx-auto p-4 space-y-4">
        {isSubmitted ? (
          <div className="bg-white rounded-2xl border border-[#D6DFE8] p-8 text-center space-y-3 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#1D7A45]/10 text-[#1D7A45] flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-base font-bold text-[#1D7A45]">
              {language === 'mr' ? 'अभिप्राय यशस्वीरीत्या नोंदवला गेला!' : 'Thank you for your rating!'}
            </h2>
            <p className="text-xs text-[#566475]">
              तुमच्या अभिप्रायामुळे सांगली-मिरज-कुपवाड मनपा सेवा सुधारण्यास मदत होते.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitRating} className="space-y-4">
            {/* Overall Star Rating Card */}
            <div className="bg-white rounded-xl border border-[#D6DFE8] p-5 shadow-xs text-center space-y-3">
              <h3 className="text-sm font-bold text-[#16212E]">
                {language === 'mr' ? 'एकूण सेवेचे मूल्यमापन करा' : 'Overall Service Rating'}
              </h3>
              <p className="text-xs text-[#566475]">
                {selectedComplaint.categoryNameMr} ({selectedComplaint.trackingNumber})
              </p>

              {/* 5 Big Stars */}
              <div className="flex justify-center items-center gap-2 py-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStars(val)}
                    className="p-1 hover:scale-110 active:scale-95 transition-transform"
                    aria-label={`Rate ${val} stars`}
                  >
                    <Star
                      className={`w-9 h-9 ${
                        val <= stars
                          ? 'text-[#E0681A] fill-[#E0681A]'
                          : 'text-[#D6DFE8] hover:text-[#E0681A]/50'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <span className="inline-block text-xs font-bold text-[#0B3D66] bg-[#0B3D66]/5 px-3 py-1 rounded-full">
                {stars === 5 ? 'उत्कृष्ट (Excellent)' : stars >= 4 ? 'चांगले (Good)' : stars >= 3 ? 'मध्यम (Average)' : 'असमाधानकारक (Poor)'}
              </span>
            </div>

            {/* Criteria Breakdown */}
            <div className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-[#16212E] border-b border-[#D6DFE8] pb-1.5">
                विस्तृत निकष (Quality Assessment):
              </h4>

              {/* 1. Timeliness */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#16212E] font-medium">वेळेवर सेवा (Timeliness):</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTimeliness(s)}
                      className="p-0.5"
                    >
                      <Star className={`w-4 h-4 ${s <= timeliness ? 'text-[#E0681A] fill-[#E0681A]' : 'text-slate-200'}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Cleanliness */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#16212E] font-medium">कामाचा दर्जा (Quality):</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCleanliness(s)}
                      className="p-0.5"
                    >
                      <Star className={`w-4 h-4 ${s <= cleanliness ? 'text-[#E0681A] fill-[#E0681A]' : 'text-slate-200'}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Behavior */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#16212E] font-medium">अधिकाऱ्यांचे सहकार्य (Behavior):</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setBehavior(s)}
                      className="p-0.5"
                    >
                      <Star className={`w-4 h-4 ${s <= behavior ? 'text-[#E0681A] fill-[#E0681A]' : 'text-slate-200'}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Comment Box */}
            <div className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs space-y-2">
              <label className="block text-xs font-bold text-[#16212E]">
                {language === 'mr' ? 'अभिप्राय किंवा सूचना (Comments)' : 'Your Feedback'}
              </label>
              <textarea
                rows={3}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="मनपाच्या कामाबद्दल तुमचे अनुभव किंवा सूचना लिहा..."
                className="w-full p-2.5 text-xs border border-[#D6DFE8] rounded-lg focus:border-[#0B3D66] focus:outline-hidden"
              />
            </div>

            {/* Submit Rating Button */}
            <button
              type="submit"
              className="w-full min-h-[48px] bg-[#0B3D66] hover:bg-[#082d4d] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>{language === 'mr' ? 'समाधानी - अभिप्राय नोंदवा' : 'Submit Citizen Rating'}</span>
            </button>

            {/* Dissatisfied: Re-open button */}
            <button
              type="button"
              onClick={handleReopen}
              className="w-full py-2.5 bg-white border border-[#B42318] text-[#B42318] text-xs font-bold rounded-xl hover:bg-[#B42318]/5 transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>कामावर समाधानी नाही? तक्रार पुन्हा उघडा (४८ तासांत)</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
