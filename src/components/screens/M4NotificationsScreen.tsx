import React from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { NotificationItem } from '../../types';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Star, 
  CheckCheck, 
  ChevronRight, 
  BellOff 
} from 'lucide-react';

export const M4NotificationsScreen: React.FC = () => {
  const { 
    language, 
    notifications, 
    userRole, 
    markNotificationRead, 
    markAllNotificationsRead, 
    selectComplaint, 
    navigateTo 
  } = useApp();

  // Role-aware filtering: filter by recipientRole === 'all' or current user role
  const filteredNotifications = notifications.filter(
    (n) => n.recipientRole === 'all' || n.recipientRole === userRole
  );

  const handleNotificationClick = (notif: NotificationItem) => {
    markNotificationRead(notif.id);
    if (notif.complaintId) {
      if (notif.type === 'resolved' && userRole === 'citizen') {
        // Open rating view if resolved
        selectComplaint(notif.complaintId, 'C9_RATE');
      } else {
        selectComplaint(notif.complaintId, 'C8_DETAIL');
      }
    }
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'resolved':
        return <CheckCircle2 className="w-5 h-5 text-[#1D7A45]" />;
      case 'status_update':
        return <Clock className="w-5 h-5 text-[#0B3D66]" />;
      case 'assignment':
        return <AlertTriangle className="w-5 h-5 text-[#E0681A]" />;
      case 'escalation':
      case 'alert':
        return <FileText className="w-5 h-5 text-[#B42318]" />;
      case 'approval':
        return <FileText className="w-5 h-5 text-[#5B3FA6]" />;
      default:
        return <Clock className="w-5 h-5 text-[#566475]" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24">
      <Header 
        title={language === 'mr' ? 'सूचना केंद्र' : 'Notifications'} 
        subtitle={language === 'mr' ? 'नागरी व प्रशासकीय अद्यतने' : 'Civic & Corporation Updates'}
        showBack
        onBack={() => navigateTo(userRole === 'officer' ? 'OFFICER_DASHBOARD' : 'C1_HOME')}
      />

      <div className="max-w-md mx-auto p-4 space-y-3">
        {/* Header action bar */}
        <div className="flex items-center justify-between pb-1">
          <p className="text-xs text-[#566475] font-semibold">
            {language === 'mr' 
              ? `${filteredNotifications.length} सूचना प्राप्त (नवीनतम प्रथम)` 
              : `${filteredNotifications.length} Notifications (Newest first)`}
          </p>
          <button
            onClick={markAllNotificationsRead}
            className="text-xs font-bold text-[#0B3D66] hover:text-[#E0681A] flex items-center gap-1 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{language === 'mr' ? 'सर्व वाचलेले चिन्हांकित करा' : 'Mark all read'}</span>
          </button>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#D6DFE8] p-8 text-center space-y-2">
            <BellOff className="w-8 h-8 text-[#566475] mx-auto" />
            <p className="text-sm font-bold text-[#16212E]">
              {language === 'mr' ? 'कोणतीही सूचना उपलब्ध नाही' : 'No notifications'}
            </p>
            <p className="text-xs text-[#566475]">
              {language === 'mr' ? 'तक्रार स्थिती बदलल्यास येथे सूचित केले जाईल.' : 'New updates will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredNotifications.map((notif) => {
              const title = language === 'mr' ? notif.titleMr : notif.titleEn;
              const msg = language === 'mr' ? notif.messageMr : notif.messageEn;
              const isResolved = notif.type === 'resolved';

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`relative p-3.5 rounded-xl border transition-all cursor-pointer ${
                    !notif.isRead
                      ? 'bg-white border-[#0B3D66]/30 ring-1 ring-[#0B3D66]/15 shadow-2xs'
                      : 'bg-white/80 border-[#D6DFE8] hover:border-[#0B3D66]/30'
                  }`}
                >
                  {/* Unread indicator dot */}
                  {!notif.isRead && (
                    <span 
                      className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#E0681A]" 
                      title="Unread" 
                    />
                  )}

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 p-2 rounded-lg bg-[#F4F7FA] border border-[#D6DFE8]/60">
                      {getIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-xs text-[#16212E] leading-tight ${!notif.isRead ? 'font-bold' : 'font-semibold'}`}>
                          {title}
                        </h3>
                      </div>
                      
                      <p className="text-[12px] text-[#566475] mt-1 leading-relaxed">
                        {msg}
                      </p>

                      <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-[#D6DFE8]/40">
                        <span className="text-[10px] text-[#566475] font-mono">
                          {notif.createdAt}
                        </span>

                        {/* Citizen "resolved" item button = "View & rate" (Strict Functional Rule: opens resolved complaint for rating) */}
                        {isResolved && userRole === 'citizen' && notif.complaintId ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markNotificationRead(notif.id);
                              selectComplaint(notif.complaintId!, 'C9_RATE');
                            }}
                            className="px-2.5 py-1 rounded bg-[#1D7A45] text-white text-[11px] font-bold hover:bg-[#155d34] flex items-center gap-1 shadow-2xs"
                          >
                            <Star className="w-3 h-3 fill-white" />
                            <span>{language === 'mr' ? 'पहा आणि मूल्यमापन करा' : 'View & rate'}</span>
                          </button>
                        ) : notif.complaintId ? (
                          <div className="flex items-center text-[11px] font-bold text-[#0B3D66]">
                            <span>{language === 'mr' ? 'तपशील पहा' : 'View Details'}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
