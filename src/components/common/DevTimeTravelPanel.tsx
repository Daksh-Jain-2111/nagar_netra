import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Clock, FastForward, RotateCcw, Shield, User, ChevronUp, ChevronDown } from 'lucide-react';

export const DevTimeTravelPanel: React.FC = () => {
  const { 
    simulatedNow, 
    advanceSimulatedTime, 
    resetSimulatedTime, 
    users, 
    currentUser, 
    switchUser,
    complaints 
  } = useApp();

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const escalatedCount = complaints.filter(c => c.escalationLevel === 'L1').length;
  const toCheckCount = complaints.filter(c => c.status === 'TO_CHECK').length;
  const workScheduledCount = complaints.filter(c => c.status === 'WORK_SCHEDULED').length;

  const formattedDate = simulatedNow.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
  const formattedTime = simulatedNow.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className="fixed bottom-2 right-2 z-50 text-xs font-sans">
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-slate-900/90 text-white hover:bg-slate-900 px-3 py-1.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 backdrop-blur-sm transition-all"
        >
          <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span className="font-mono font-bold text-[11px] text-amber-300">/dev time: {formattedDate} {formattedTime}</span>
          {escalatedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-[10px] font-bold">
              {escalatedCount} L1
            </span>
          )}
          <ChevronUp className="w-3 h-3 text-slate-400" />
        </button>
      ) : (
        <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-700 p-3.5 w-80 backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <Clock className="w-4 h-4" />
              <span>Dev Time-Travel & Simulator</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Current Simulated Time Display */}
          <div className="my-2.5 p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between font-mono">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans">Simulated Time</div>
              <div className="text-sm font-bold text-white">{formattedDate} · {formattedTime}</div>
            </div>
            <button
              onClick={resetSimulatedTime}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[11px] font-bold flex items-center gap-1 text-slate-200 transition-colors"
              title="Reset to 7 Oct 2026, 12:00"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Fast-forward buttons: +1 h, +6 h, +24 h, +48 h, +7 d */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Advance Clocks & Trigger Jobs:
            </div>
            <div className="grid grid-cols-5 gap-1 font-mono font-bold">
              {[
                { label: '+1 h', hours: 1 },
                { label: '+6 h', hours: 6 },
                { label: '+24 h', hours: 24 },
                { label: '+48 h', hours: 48 },
                { label: '+7 d', hours: 168 },
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={() => advanceSimulatedTime(btn.hours)}
                  className="py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-center transition-colors active:scale-95"
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Advancing time checks response/deadline escalations (L1), auto-closes resolved tickets after 7 days, and expires officer leaves.
            </p>
          </div>

          {/* Real-time State counters */}
          <div className="grid grid-cols-3 gap-1.5 my-2.5 pt-2 border-t border-slate-800 text-center font-mono text-[11px]">
            <div className="p-1 rounded bg-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">L1 Alerts</span>
              <span className="font-bold text-red-400">{escalatedCount}</span>
            </div>
            <div className="p-1 rounded bg-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">To Check</span>
              <span className="font-bold text-amber-300">{toCheckCount}</span>
            </div>
            <div className="p-1 rounded bg-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Scheduled</span>
              <span className="font-bold text-purple-300">{workScheduledCount}</span>
            </div>
          </div>

          {/* Role Switcher */}
          <div className="pt-2 border-t border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
              Active Persona: <strong className="text-white">{currentUser.name} ({currentUser.role})</strong>
            </div>
            <select
              value={currentUser.id}
              onChange={(e) => switchUser(e.target.value)}
              className="w-full bg-slate-800 text-slate-200 p-1.5 rounded-lg border border-slate-700 text-xs focus:outline-none"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role}{u.department ? ` - ${u.department}` : ''})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
