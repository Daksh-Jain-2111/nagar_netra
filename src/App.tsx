import React, { useState } from 'react';
import { AppProvider, useApp, ScreenId } from './context/AppContext';
import { BottomNav } from './components/common/BottomNav';
import { DevTimeTravelPanel } from './components/common/DevTimeTravelPanel';

// Batch 1 Screens
import { M1LanguageScreen } from './components/screens/M1LanguageScreen';
import { M2CitizenLoginScreen } from './components/screens/M2CitizenLoginScreen';
import { M3OfficerLoginScreen } from './components/screens/M3OfficerLoginScreen';
import { M4NotificationsScreen } from './components/screens/M4NotificationsScreen';
import { M5ProfileScreen } from './components/screens/M5ProfileScreen';
import { C1CitizenHomeScreen } from './components/screens/C1CitizenHomeScreen';
import { C2FileComplaintMedia } from './components/screens/C2FileComplaintMedia';
import { C3FileComplaintAIClassification } from './components/screens/C3FileComplaintAIClassification';
import { C4FileComplaintLocation } from './components/screens/C4FileComplaintLocation';
import { C5FileComplaintReview } from './components/screens/C5FileComplaintReview';
import { C6SubmissionSuccessScreen } from './components/screens/C6SubmissionSuccessScreen';
import { C7ComplaintsListScreen } from './components/screens/C7ComplaintsListScreen';
import { C8ComplaintDetailScreen } from './components/screens/C8ComplaintDetailScreen';
import { C9RatingFeedbackScreen } from './components/screens/C9RatingFeedbackScreen';
import { C10CivicMapExplorerScreen } from './components/screens/C10CivicMapExplorerScreen';
import { C11MunicipalDirectoryScreen } from './components/screens/C11MunicipalDirectoryScreen';
import { OfficerDashboardScreen } from './components/screens/OfficerDashboardScreen';

// Batch 2 Citizen Screens
import { C12MyComplaintsScreen } from './components/screens/C12MyComplaintsScreen';
import { C13ComplaintDetailScreen } from './components/screens/C13ComplaintDetailScreen';
import { C14ResolvedFeedbackScreen } from './components/screens/C14ResolvedFeedbackScreen';

// Batch 2 Field Officer Screens
import { F1WorkQueueScreen } from './components/screens/F1WorkQueueScreen';
import { F2ComplaintDetailActionsScreen } from './components/screens/F2ComplaintDetailActionsScreen';
import { F3PostUpdateScreen } from './components/screens/F3PostUpdateScreen';
import { F4RequestNewDateScreen } from './components/screens/F4RequestNewDateScreen';
import { F5TransferScreen } from './components/screens/F5TransferScreen';
import { F6PossibleDuplicatesScreen } from './components/screens/F6PossibleDuplicatesScreen';
import { F7ResolveWithPhotoScreen } from './components/screens/F7ResolveWithPhotoScreen';
import { F8RequestRejectionScreen } from './components/screens/F8RequestRejectionScreen';

// Batch 2/3 Supervisor Screens (Web)
import { SupervisorWebShell } from './components/supervisor/SupervisorWebShell';
import { S1OverviewScreen } from './components/supervisor/S1OverviewScreen';
import { S2ToCheckScreen } from './components/supervisor/S2ToCheckScreen';
import { S3EscalationsScreen } from './components/supervisor/S3EscalationsScreen';
import { S4ApprovalsScreen } from './components/supervisor/S4ApprovalsScreen';
import { S5OfficersLeaveScreen } from './components/supervisor/S5OfficersLeaveScreen';
import { S6PerformanceScreen } from './components/supervisor/S6PerformanceScreen';

// Batch 3 Corporation Admin Screens (Web)
import { AdminWebShell } from './components/admin/AdminWebShell';
import { A1CityDashboardScreen } from './components/admin/A1CityDashboardScreen';
import { A2OrganisationScreen } from './components/admin/A2OrganisationScreen';
import { A3CategoriesDeadlinesScreen } from './components/admin/A3CategoriesDeadlinesScreen';
import { ARoutingRulesScreen } from './components/admin/ARoutingRulesScreen';
import { A4UsersScreen } from './components/admin/A4UsersScreen';
import { A6RulesScreen } from './components/admin/A6RulesScreen';
import { AAuditLogScreen } from './components/admin/AAuditLogScreen';
import { AReportsScreen } from './components/admin/AReportsScreen';

// Batch 3 Helpdesk Screens (Web)
import { HelpdeskWebShell } from './components/helpdesk/HelpdeskWebShell';
import { H1NewComplaintScreen } from './components/helpdesk/H1NewComplaintScreen';
import { H2SearchStatusScreen } from './components/helpdesk/H2SearchStatusScreen';
import { HTodaysLogScreen } from './components/helpdesk/HTodaysLogScreen';

// Batch 3 Platform Admin Screens (Web)
import { PlatformWebShell } from './components/platform/PlatformWebShell';
import { P1CorporationsScreen } from './components/platform/P1CorporationsScreen';
import { PAIModelsScreen } from './components/platform/PAIModelsScreen';
import { PTemplatesScreen } from './components/platform/PTemplatesScreen';
import { AIOverviewScreen } from './components/platform/ai/AIOverviewScreen';
import { AIModelHistoryScreen } from './components/platform/ai/AIModelHistoryScreen';
import { AIModelParametersScreen } from './components/platform/ai/AIModelParametersScreen';
import { AIRetrainingHistoryScreen } from './components/platform/ai/AIRetrainingHistoryScreen';

import { Smartphone, Monitor, Compass, Shield } from 'lucide-react';

const ScreenRouter: React.FC = () => {
  const { currentScreen, isMobileDeviceFrame, setIsMobileDeviceFrame, navigateTo, userRole, currentUser } = useApp();
  const [showScreenPicker, setShowScreenPicker] = useState<boolean>(false);

  // Identify full web portal screens
  const isFullWebScreen = 
    currentScreen.startsWith('S') || 
    currentScreen.startsWith('A') || 
    currentScreen.startsWith('H') || 
    currentScreen.startsWith('P');

  const renderActiveScreen = () => {
    switch (currentScreen) {
      // Batch 1
      case 'M1_LANGUAGE':
        return <M1LanguageScreen />;
      case 'M2_CITIZEN_LOGIN':
        return <M2CitizenLoginScreen />;
      case 'M3_OFFICER_LOGIN':
        return <M3OfficerLoginScreen />;
      case 'M4_NOTIFICATIONS':
        return <M4NotificationsScreen />;
      case 'M5_PROFILE':
        return <M5ProfileScreen />;
      case 'C1_HOME':
        return <C1CitizenHomeScreen />;
      case 'C2_MEDIA':
        return <C2FileComplaintMedia />;
      case 'C3_AI_CLASSIFY':
        return <C3FileComplaintAIClassification />;
      case 'C4_LOCATION':
        return <C4FileComplaintLocation />;
      case 'C5_REVIEW':
        return <C5FileComplaintReview />;
      case 'C6_SUCCESS':
        return <C6SubmissionSuccessScreen />;
      case 'C7_COMPLAINTS':
        return <C7ComplaintsListScreen />;
      case 'C8_DETAIL':
        return <C8ComplaintDetailScreen />;
      case 'C9_RATE':
        return <C9RatingFeedbackScreen />;
      case 'C10_MAP':
        return <C10CivicMapExplorerScreen />;
      case 'C11_DIRECTORY':
        return <C11MunicipalDirectoryScreen />;
      case 'OFFICER_DASHBOARD':
        return <OfficerDashboardScreen />;

      // Batch 2 Citizen Screens
      case 'C12_MY_COMPLAINTS':
        return <C12MyComplaintsScreen />;
      case 'C13_COMPLAINT_DETAIL':
        return <C13ComplaintDetailScreen />;
      case 'C14_RESOLVED_FEEDBACK':
        return <C14ResolvedFeedbackScreen />;

      // Batch 2 Field Officer Screens
      case 'F1_WORK_QUEUE':
        return <F1WorkQueueScreen />;
      case 'F2_OFFICER_DETAIL':
        return <F2ComplaintDetailActionsScreen />;
      case 'F3_POST_UPDATE':
        return <F3PostUpdateScreen />;
      case 'F4_REQUEST_DATE':
        return <F4RequestNewDateScreen />;
      case 'F5_TRANSFER':
        return <F5TransferScreen />;
      case 'F6_DUPLICATES':
        return <F6PossibleDuplicatesScreen />;
      case 'F7_RESOLVE':
        return <F7ResolveWithPhotoScreen />;
      case 'F8_REJECT':
        return <F8RequestRejectionScreen />;

      // Supervisor Screens (Web)
      case 'S1_SUPERVISOR_OVERVIEW':
        return (
          <SupervisorWebShell activeScreen="S1_SUPERVISOR_OVERVIEW">
            <S1OverviewScreen />
          </SupervisorWebShell>
        );
      case 'S2_TO_CHECK':
        return (
          <SupervisorWebShell activeScreen="S2_TO_CHECK">
            <S2ToCheckScreen />
          </SupervisorWebShell>
        );
      case 'S3_ESCALATIONS':
        return (
          <SupervisorWebShell activeScreen="S3_ESCALATIONS">
            <S3EscalationsScreen />
          </SupervisorWebShell>
        );
      case 'S4_APPROVALS':
        return (
          <SupervisorWebShell activeScreen="S4_APPROVALS">
            <S4ApprovalsScreen />
          </SupervisorWebShell>
        );
      case 'S5_OFFICERS_LEAVE':
        return (
          <SupervisorWebShell activeScreen="S5_OFFICERS_LEAVE">
            <S5OfficersLeaveScreen />
          </SupervisorWebShell>
        );
      case 'S6_PERFORMANCE':
        return (
          <SupervisorWebShell activeScreen="S6_PERFORMANCE">
            <S6PerformanceScreen />
          </SupervisorWebShell>
        );

      // Corporation Admin Screens (Web)
      case 'A1_CITY_DASHBOARD':
        return (
          <AdminWebShell activeScreen="A1_CITY_DASHBOARD">
            <A1CityDashboardScreen />
          </AdminWebShell>
        );
      case 'A2_ORGANISATION':
        return (
          <AdminWebShell activeScreen="A2_ORGANISATION">
            <A2OrganisationScreen />
          </AdminWebShell>
        );
      case 'A3_CATEGORIES_DEADLINES':
        return (
          <AdminWebShell activeScreen="A3_CATEGORIES_DEADLINES">
            <A3CategoriesDeadlinesScreen />
          </AdminWebShell>
        );
      case 'A_ROUTING':
        return (
          <AdminWebShell activeScreen="A_ROUTING">
            <ARoutingRulesScreen />
          </AdminWebShell>
        );
      case 'A4_USERS':
        return (
          <AdminWebShell activeScreen="A4_USERS">
            <A4UsersScreen />
          </AdminWebShell>
        );
      case 'A6_RULES':
        return (
          <AdminWebShell activeScreen="A6_RULES">
            <A6RulesScreen />
          </AdminWebShell>
        );
      case 'A_AUDIT':
        return (
          <AdminWebShell activeScreen="A_AUDIT">
            <AAuditLogScreen />
          </AdminWebShell>
        );
      case 'A_REPORTS':
        return (
          <AdminWebShell activeScreen="A_REPORTS">
            <AReportsScreen />
          </AdminWebShell>
        );

      // Helpdesk Screens (Web)
      case 'H1_NEW_COMPLAINT':
        return (
          <HelpdeskWebShell activeScreen="H1_NEW_COMPLAINT">
            <H1NewComplaintScreen />
          </HelpdeskWebShell>
        );
      case 'H2_SEARCH_STATUS':
        return (
          <HelpdeskWebShell activeScreen="H2_SEARCH_STATUS">
            <H2SearchStatusScreen />
          </HelpdeskWebShell>
        );
      case 'H_TODAYS_LOG':
        return (
          <HelpdeskWebShell activeScreen="H_TODAYS_LOG">
            <HTodaysLogScreen />
          </HelpdeskWebShell>
        );

      // Platform Admin Screens (Web)
      case 'P1_CORPORATIONS':
        return (
          <PlatformWebShell activeScreen="P1_CORPORATIONS">
            <P1CorporationsScreen />
          </PlatformWebShell>
        );
      case 'P_AI_MODELS':
        return (
          <PlatformWebShell activeScreen="P_AI_MODELS">
            <PAIModelsScreen />
          </PlatformWebShell>
        );
      case 'P_TEMPLATES':
        return (
          <PlatformWebShell activeScreen="P_TEMPLATES">
            <PTemplatesScreen />
          </PlatformWebShell>
        );

      // Platform Admin: AI & Model Management
      case 'P_AI_OVERVIEW':
        return (
          <PlatformWebShell activeScreen="P_AI_OVERVIEW">
            <AIOverviewScreen />
          </PlatformWebShell>
        );
      case 'P_AI_HISTORY':
        return (
          <PlatformWebShell activeScreen="P_AI_HISTORY">
            <AIModelHistoryScreen />
          </PlatformWebShell>
        );
      case 'P_AI_PARAMETERS':
        return (
          <PlatformWebShell activeScreen="P_AI_PARAMETERS">
            <AIModelParametersScreen />
          </PlatformWebShell>
        );
      case 'P_AI_RETRAINING':
        return (
          <PlatformWebShell activeScreen="P_AI_RETRAINING">
            <AIRetrainingHistoryScreen />
          </PlatformWebShell>
        );

      default:
        return <C1CitizenHomeScreen />;
    }
  };

  const allScreens: { id: ScreenId; label: string; group: string }[] = [
    // Onboarding & Auth
    { id: 'M1_LANGUAGE', label: 'M1 Language (भाषा)', group: 'Auth & Base' },
    { id: 'M2_CITIZEN_LOGIN', label: 'M2 Citizen Login', group: 'Auth & Base' },
    { id: 'M3_OFFICER_LOGIN', label: 'M3 Officer Login & Invite', group: 'Auth & Base' },
    { id: 'M4_NOTIFICATIONS', label: 'M4 Notifications Center', group: 'Auth & Base' },
    { id: 'M5_PROFILE', label: 'M5 Profile & Switching', group: 'Auth & Base' },

    // Citizen Batch 1 & 2
    { id: 'C1_HOME', label: 'C1 Citizen Dashboard (Home)', group: 'Citizen' },
    { id: 'C2_MEDIA', label: 'C2 Photo & Voice Capture (Step 1)', group: 'Citizen' },
    { id: 'C3_AI_CLASSIFY', label: 'C3 AI Classification (Step 2)', group: 'Citizen' },
    { id: 'C4_LOCATION', label: 'C4 Location & Ward (Step 3)', group: 'Citizen' },
    { id: 'C5_REVIEW', label: 'C5 Review & Submit (Step 4)', group: 'Citizen' },
    { id: 'C6_SUCCESS', label: 'C6 Submission Receipt', group: 'Citizen' },
    { id: 'C12_MY_COMPLAINTS', label: 'C12 My Complaints (Track)', group: 'Citizen' },
    { id: 'C13_COMPLAINT_DETAIL', label: 'C13 Detail & Two Clocks', group: 'Citizen' },
    { id: 'C14_RESOLVED_FEEDBACK', label: 'C14 Resolved & Rate (3 stars)', group: 'Citizen' },
    { id: 'C10_MAP', label: 'C10 Civic Map & Heatmap', group: 'Citizen' },
    { id: 'C11_DIRECTORY', label: 'C11 Helpdesk & Ward Directory', group: 'Citizen' },

    // Field Officer (Batch 2 F1-F8)
    { id: 'F1_WORK_QUEUE', label: 'F1 Work Queue (Tabs & GPS)', group: 'Field Officer' },
    { id: 'F2_OFFICER_DETAIL', label: 'F2 Complaint & Officer Actions', group: 'Field Officer' },
    { id: 'F3_POST_UPDATE', label: 'F3 Post Update / Meet Clock', group: 'Field Officer' },
    { id: 'F4_REQUEST_DATE', label: 'F4 Request Target Date Ext', group: 'Field Officer' },
    { id: 'F5_TRANSFER', label: 'F5 Transfer Department', group: 'Field Officer' },
    { id: 'F6_DUPLICATES', label: 'F6 Possible Duplicates Link', group: 'Field Officer' },
    { id: 'F7_RESOLVE', label: 'F7 Resolve with Geo-Photo', group: 'Field Officer' },
    { id: 'F8_REJECT', label: 'F8 Request Rejection', group: 'Field Officer' },

    // Supervisor (S1-S6 Web)
    { id: 'S1_SUPERVISOR_OVERVIEW', label: 'S1 Overview Dashboard', group: 'Supervisor Portal' },
    { id: 'S2_TO_CHECK', label: 'S2 To Check (Citizen Mismatch)', group: 'Supervisor Portal' },
    { id: 'S3_ESCALATIONS', label: 'S3 Escalations (L1 Live Clocks)', group: 'Supervisor Portal' },
    { id: 'S4_APPROVALS', label: 'S4 Approvals & Join Requests', group: 'Supervisor Portal' },
    { id: 'S5_OFFICERS_LEAVE', label: 'S5 Officers & Leave Coverage', group: 'Supervisor Portal' },
    { id: 'S6_PERFORMANCE', label: 'S6 Performance & Redressal %', group: 'Supervisor Portal' },

    // Corporation Admin (A1-A6 + Routing + Audit Web)
    { id: 'A1_CITY_DASHBOARD', label: 'A1 City Performance Dashboard', group: 'Corporation Admin' },
    { id: 'A2_ORGANISATION', label: 'A2 Organisation Units & Hierarchy', group: 'Corporation Admin' },
    { id: 'A3_CATEGORIES_DEADLINES', label: 'A3 Categories & SLA Deadlines', group: 'Corporation Admin' },
    { id: 'A_ROUTING', label: 'A Routing Rules & Dispatch Simulator', group: 'Corporation Admin' },
    { id: 'A4_USERS', label: 'A4 Users & Personnel Directory', group: 'Corporation Admin' },
    { id: 'A6_RULES', label: 'A6 System Rules & SLA Governance', group: 'Corporation Admin' },
    { id: 'A_REPORTS', label: 'A Performance Reports & Export', group: 'Corporation Admin' },
    { id: 'A_AUDIT', label: 'A Audit Trail & Activity Log', group: 'Corporation Admin' },

    // Helpdesk (H1-H2 + Today's Log Web)
    { id: 'H1_NEW_COMPLAINT', label: 'H1 New Complaint (Assisted Intake)', group: 'Helpdesk Console' },
    { id: 'H2_SEARCH_STATUS', label: 'H2 Search Status & Inquiries', group: 'Helpdesk Console' },
    { id: 'H_TODAYS_LOG', label: "H Today's Call & Redirection Log", group: 'Helpdesk Console' },

    // Platform Admin (P1 + AI Models + Templates Web)
    { id: 'P1_CORPORATIONS', label: 'P1 Municipal Corporation Tenants', group: 'Platform Admin' },
    { id: 'P_AI_MODELS', label: 'P AI Model Registry & Deployment', group: 'Platform Admin' },
    { id: 'P_TEMPLATES', label: 'P Standard Blueprint Template Packs', group: 'Platform Admin' },
    { id: 'P_AI_OVERVIEW', label: 'P AI Overview', group: 'Platform Admin' },
    { id: 'P_AI_HISTORY', label: 'P AI Model History', group: 'Platform Admin' },
    { id: 'P_AI_PARAMETERS', label: 'P AI Model Parameters', group: 'Platform Admin' },
    { id: 'P_AI_RETRAINING', label: 'P AI Retraining History', group: 'Platform Admin' },
  ];

  return (
    <div className="min-h-screen bg-[#E2E8F0] text-[#16212E] flex flex-col items-center">
      {/* Top Testing Utility Bar for quick inspection of all screens */}
      <div className="w-full bg-[#0B3D66] text-white px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm z-50">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-tight text-[#FFDB99]">NagarNetra (SMKMC)</span>
          <span className="hidden sm:inline text-white/70">| सांगली-मिरज-कुपवाड महानगरपालिका</span>
          <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono text-[#FFDB99]">
            {currentUser.name} ({currentUser.role})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Screen Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowScreenPicker(!showScreenPicker)}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors border border-white/20"
            >
              <Compass className="w-3.5 h-3.5 text-[#FFDB99]" />
              <span className="truncate max-w-[150px] sm:max-w-none">
                {allScreens.find(s => s.id === currentScreen)?.label || currentScreen}
              </span>
            </button>

            {showScreenPicker && (
              <div className="absolute right-0 top-full mt-1 w-80 bg-white text-[#16212E] rounded-xl shadow-xl border border-[#D6DFE8] p-2 z-50 max-h-[80vh] overflow-y-auto">
                <div className="px-2 py-1 text-[11px] font-bold text-[#566475] border-b border-[#D6DFE8] mb-1 flex items-center justify-between">
                  <span>NagarNetra Screens Navigator</span>
                  <span className="text-[10px] text-slate-400">All Roles</span>
                </div>
                {allScreens.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      navigateTo(s.id);
                      setShowScreenPicker(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md font-medium flex items-center justify-between transition-colors ${
                      currentScreen === s.id
                        ? 'bg-[#0B3D66] text-white'
                        : 'hover:bg-[#F4F7FA] text-[#16212E]'
                    }`}
                  >
                    <span className="truncate">{s.label}</span>
                    <span className="text-[10px] opacity-75 shrink-0 ml-2 font-mono">{s.id.split('_')[0]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Toggle Device Frame / Full Web View (for mobile screens) */}
          {!isFullWebScreen && (
            <button
              onClick={() => setIsMobileDeviceFrame(!isMobileDeviceFrame)}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-md text-xs font-medium flex items-center gap-1 transition-colors border border-white/20"
              title="Toggle Viewport Layout"
            >
              {isMobileDeviceFrame ? (
                <>
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Web View</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Phone Frame</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport Container */}
      <main className={`w-full flex-1 flex justify-center py-0 ${!isFullWebScreen && isMobileDeviceFrame ? 'sm:py-6' : ''}`}>
        {isFullWebScreen ? (
          <div className="w-full min-h-screen bg-[#F4F7FA]">
            {renderActiveScreen()}
          </div>
        ) : (
          <div
            className={`w-full bg-white transition-all overflow-hidden ${
              isMobileDeviceFrame
                ? 'max-w-[420px] sm:rounded-3xl sm:shadow-2xl sm:border-8 sm:border-slate-800 relative'
                : 'max-w-2xl shadow-md border-x border-[#D6DFE8]'
            }`}
            style={{ minHeight: isMobileDeviceFrame ? '844px' : '100vh' }}
          >
            {renderActiveScreen()}
            <BottomNav />
          </div>
        )}
      </main>

      {/* Dev Time Travel & Fast User Switcher Panel */}
      <DevTimeTravelPanel />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <ScreenRouter />
    </AppProvider>
  );
}
