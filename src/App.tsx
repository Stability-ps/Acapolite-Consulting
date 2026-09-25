import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireRole } from "@/components/auth/RequireRole";
import { RequireStaffPermission } from "@/components/auth/RequireStaffPermission";
import { DashboardIndexRedirect } from "@/components/auth/DashboardIndexRedirect";
// Public marketing/content pages are route-level code-split, same pattern as
// the dashboard routes below, so the main bundle doesn't ship every public
// page's code to every visitor (SEO audit finding M6).
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const RequestTaxAssistance = lazy(() => import("./pages/RequestTaxAssistance"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const DataDeletion = lazy(() => import("./pages/DataDeletion"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const Disclaimer = lazy(() => import("./pages/Disclaimer"));
const PractitionerGuidelines = lazy(() => import("./pages/PractitionerGuidelines"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const Faq = lazy(() => import("./pages/Faq"));
const TrustSafety = lazy(() => import("./pages/TrustSafety"));
const OurServices = lazy(() => import("./pages/OurServices"));
const HowAcapoliteWorks = lazy(() => import("./pages/HowAcapoliteWorks"));
const Practitioners = lazy(() => import("./pages/Practitioners"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const SarsTaxComplianceStatusPage = lazy(() => import("./pages/AdditionalTaxServicePages").then((m) => ({ default: m.SarsTaxComplianceStatusPage })));
const SarsAuditVerificationPage = lazy(() => import("./pages/AdditionalTaxServicePages").then((m) => ({ default: m.SarsAuditVerificationPage })));
const PayeUifSdlServicesPage = lazy(() => import("./pages/AdditionalTaxServicePages").then((m) => ({ default: m.PayeUifSdlServicesPage })));
const TaxConsultantPretoria = lazy(() => import("./pages/TaxConsultantPretoria"));
const AccountingServicesLandingPage = lazy(() => import("./pages/ServiceLandingPages").then((m) => ({ default: m.AccountingServicesLandingPage })));
const BookkeepingServicesLandingPage = lazy(() => import("./pages/ServiceLandingPages").then((m) => ({ default: m.BookkeepingServicesLandingPage })));
const CipcComplianceLandingPage = lazy(() => import("./pages/ServiceLandingPages").then((m) => ({ default: m.CipcComplianceLandingPage })));
const ProfessionalHelpLandingPage = lazy(() => import("./pages/ServiceLandingPages").then((m) => ({ default: m.ProfessionalHelpLandingPage })));
const SarsTaxAssistanceLandingPage = lazy(() => import("./pages/ServiceLandingPages").then((m) => ({ default: m.SarsTaxAssistanceLandingPage })));
const TaxReturnsLandingPage = lazy(() => import("./pages/ServiceLandingPages").then((m) => ({ default: m.TaxReturnsLandingPage })));
const VatServicesLandingPage = lazy(() => import("./pages/ServiceLandingPages").then((m) => ({ default: m.VatServicesLandingPage })));
const ProvisionalTaxLandingPage = lazy(() => import("./pages/ServiceLandingPages").then((m) => ({ default: m.ProvisionalTaxLandingPage })));
const StaffOverviewRouter = lazy(() => import("@/components/auth/StaffOverviewRouter").then((module) => ({ default: module.StaffOverviewRouter })));
const StaffExternalToolsRouter = lazy(() => import("@/components/auth/StaffExternalToolsRouter").then((module) => ({ default: module.StaffExternalToolsRouter })));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DashboardOverview = lazy(() => import("./pages/dashboard/Overview"));
const TaxCoachAIClient = lazy(() => import("./pages/dashboard/TaxCoachAIClient"));
const ServiceRequests = lazy(() => import("./pages/dashboard/ServiceRequests"));
const Cases = lazy(() => import("./pages/dashboard/Cases"));
const Documents = lazy(() => import("./pages/dashboard/Documents"));
const Invoices = lazy(() => import("./pages/dashboard/Invoices"));
const Messages = lazy(() => import("./pages/dashboard/Messages"));
const Notifications = lazy(() => import("./pages/dashboard/Notifications"));
const Deadlines = lazy(() => import("./pages/dashboard/Deadlines"));
const AdminDeadlines = lazy(() => import("./pages/dashboard/admin/AdminDeadlines"));
const SettingsPage = lazy(() => import("./pages/dashboard/Settings"));
const AdminClients = lazy(() => import("./pages/dashboard/admin/AdminClients"));
const AdminCases = lazy(() => import("./pages/dashboard/admin/AdminCases"));
const AdminInvoices = lazy(() => import("./pages/dashboard/admin/AdminInvoices"));
const AdminDocuments = lazy(() => import("./pages/dashboard/admin/AdminDocuments"));
const AdminMessages = lazy(() => import("./pages/dashboard/admin/AdminMessages"));
const AdminNotifications = lazy(() => import("./pages/dashboard/admin/AdminNotifications"));
const AdminClientWorkspace = lazy(() => import("./pages/dashboard/admin/AdminClientWorkspace"));
const AdminUsers = lazy(() => import("./pages/dashboard/admin/AdminUsers"));
const AdminServiceRequests = lazy(() => import("./pages/dashboard/admin/AdminServiceRequests"));
const PractitionerProfile = lazy(() => import("./pages/dashboard/admin/PractitionerProfile"));
const PractitionerCredits = lazy(() => import("./pages/dashboard/admin/PractitionerCredits"));
const PractitionerDocumentsUploadPage = lazy(() => import("./pages/dashboard/admin/PractitionerDocumentsUploadPage"));
const AdminActivityLog = lazy(() => import("./pages/dashboard/admin/AdminActivityLog"));
const TaxCoachAIStaff = lazy(() => import("./pages/dashboard/admin/TaxCoachAIStaff"));
const AdminWhatsAppQA = lazy(() => import("./pages/dashboard/admin/AdminWhatsAppQA"));
const AdminSocialMedia = lazy(() => import("./pages/dashboard/admin/AdminSocialMedia"));
const AdminAiKnowledge = lazy(() => import("./pages/dashboard/admin/AdminAiKnowledge"));
const AdminProspectHub = lazy(() => import("./pages/dashboard/admin/AdminProspectHub"));

const NotFound = lazy(() => import("./pages/NotFound"));
const SarsDebtPage = lazy(() => import("./pages/SarsMoneyPages").then((m) => ({ default: m.SarsDebtPage })));
const SarsPaymentArrangementsPage = lazy(() => import("./pages/SarsMoneyPages").then((m) => ({ default: m.SarsPaymentArrangementsPage })));
const SarsCompromisePage = lazy(() => import("./pages/SarsMoneyPages").then((m) => ({ default: m.SarsCompromisePage })));
const SarsObjectionsPage = lazy(() => import("./pages/SarsMoneyPages").then((m) => ({ default: m.SarsObjectionsPage })));
const SarsVoluntaryDisclosurePage = lazy(() => import("./pages/SarsMoneyPages").then((m) => ({ default: m.SarsVoluntaryDisclosurePage })));
const TaxGuidesHub = lazy(() => import("./pages/TaxGuides").then((m) => ({ default: m.TaxGuidesHub })));
const SarsSuspensionPaymentGuide = lazy(() => import("./pages/TaxGuides").then((m) => ({ default: m.SarsSuspensionPaymentGuide })));
const SarsObjectionDeadlineGuide = lazy(() => import("./pages/TaxGuides").then((m) => ({ default: m.SarsObjectionDeadlineGuide })));
const SarsCompromiseChecklistGuide = lazy(() => import("./pages/TaxGuides").then((m) => ({ default: m.SarsCompromiseChecklistGuide })));
const SarsVatRefundDelayGuide = lazy(() => import("./pages/TaxGuides").then((m) => ({ default: m.SarsVatRefundDelayGuide })));
const SarsPaymentArrangementDocumentsGuide = lazy(() => import("./pages/TaxGuides").then((m) => ({ default: m.SarsPaymentArrangementDocumentsGuide })));
const SarsFinalDemandGuide = lazy(() => import("./pages/TaxGuides").then((m) => ({ default: m.SarsFinalDemandGuide })));
const SarsRequestForReasonsGuide = lazy(() => import("./pages/TaxGuides").then((m) => ({ default: m.SarsRequestForReasonsGuide })));
const SarsObjectionDisallowedGuide = lazy(() => import("./pages/TaxGuides").then((m) => ({ default: m.SarsObjectionDisallowedGuide })));
const SarsVatVerificationGuide = lazy(() => import("./pages/TaxGuides").then((m) => ({ default: m.SarsVatVerificationGuide })));
const ProvisionalTaxIrp6Guide = lazy(() => import("./pages/TaxGuides").then((m) => ({ default: m.ProvisionalTaxIrp6Guide })));
const SarsVoluntaryDisclosureGuide = lazy(() => import("./pages/TaxGuides").then((m) => ({ default: m.SarsVoluntaryDisclosureGuide })));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-muted-foreground">Loading…</div>}>
      <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route
              path="/practitioner-guidelines"
              element={<PractitionerGuidelines />}
            />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route
              path="/terms-and-conditions"
              element={<TermsAndConditions />}
            />
            <Route path="/faq" element={<Faq />} />
            <Route path="/trust-safety" element={<TrustSafety />} />
            <Route path="/our-services" element={<OurServices />} />
            <Route
              path="/how-acapolite-works"
              element={<HowAcapoliteWorks />}
            />
            <Route path="/practitioners" element={<Practitioners />} />
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/help-center" element={<HelpCenter />} />
            <Route path="/about-us" element={<AboutUs />} />
            <Route path="/tax-consultant-pretoria" element={<TaxConsultantPretoria />} />
            <Route path="/tax-guides" element={<TaxGuidesHub />} />
            <Route path="/tax-guides/sars-suspension-of-payment-section-164" element={<SarsSuspensionPaymentGuide />} />
            <Route path="/tax-guides/sars-objection-deadline-guide" element={<SarsObjectionDeadlineGuide />} />
            <Route path="/tax-guides/sars-section-200-compromise-checklist" element={<SarsCompromiseChecklistGuide />} />
            <Route path="/tax-guides/sars-vat-refund-delays" element={<SarsVatRefundDelayGuide />} />
            <Route path="/tax-guides/sars-payment-arrangement-documents" element={<SarsPaymentArrangementDocumentsGuide />} />
            <Route path="/tax-guides/sars-final-demand-third-party-appointment" element={<SarsFinalDemandGuide />} />
            <Route path="/tax-guides/sars-request-for-reasons" element={<SarsRequestForReasonsGuide />} />
            <Route path="/tax-guides/sars-objection-disallowed-appeal-adr" element={<SarsObjectionDisallowedGuide />} />
            <Route path="/tax-guides/sars-vat-verification-supporting-documents" element={<SarsVatVerificationGuide />} />
            <Route path="/tax-guides/provisional-tax-irp6-guide" element={<ProvisionalTaxIrp6Guide />} />
            <Route path="/tax-guides/sars-voluntary-disclosure-guide" element={<SarsVoluntaryDisclosureGuide />} />
            <Route path="/sars-tax-assistance" element={<SarsTaxAssistanceLandingPage />} />
            <Route path="/sars-debt" element={<SarsDebtPage />} />
            <Route path="/sars-payment-arrangements" element={<SarsPaymentArrangementsPage />} />
            <Route path="/sars-compromise" element={<SarsCompromisePage />} />
            <Route path="/sars-objections" element={<SarsObjectionsPage />} />
            <Route path="/sars-voluntary-disclosure" element={<SarsVoluntaryDisclosurePage />} />
            <Route path="/sars-tax-compliance-status" element={<SarsTaxComplianceStatusPage />} />
            <Route path="/sars-audit-verification" element={<SarsAuditVerificationPage />} />
            <Route path="/paye-uif-sdl-services" element={<PayeUifSdlServicesPage />} />
            <Route path="/accounting-services" element={<AccountingServicesLandingPage />} />
            <Route path="/bookkeeping-services" element={<BookkeepingServicesLandingPage />} />
            <Route path="/cipc-company-compliance" element={<CipcComplianceLandingPage />} />
            <Route path="/tax-returns" element={<TaxReturnsLandingPage />} />
            <Route path="/vat-services" element={<VatServicesLandingPage />} />
            <Route path="/provisional-tax" element={<ProvisionalTaxLandingPage />} />
            <Route path="/request-professional-help" element={<ProfessionalHelpLandingPage />} />
            <Route
              path="/request-tax-assistance"
              element={<RequestTaxAssistance />}
            />
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<DashboardIndexRedirect />} />

              <Route element={<RequireRole allowedRoles={["client"]} />}>
                <Route path="client" element={<DashboardOverview />} />
                <Route
                  path="client/notifications"
                  element={<Notifications />}
                />
                <Route path="client/requests" element={<ServiceRequests />} />
                <Route path="client/cases" element={<Cases />} />
                <Route path="client/documents" element={<Documents />} />
                <Route path="client/invoices" element={<Invoices />} />
                <Route path="client/messages" element={<Messages />} />
                <Route path="client/deadlines" element={<Deadlines />} />
                <Route
                  path="client/tax-coach-ai"
                  element={<TaxCoachAIClient />}
                />
                <Route path="client/settings" element={<SettingsPage />} />
              </Route>

              <Route
                element={<RequireRole allowedRoles={["admin", "consultant"]} />}
              >
                <Route
                  element={<RequireStaffPermission permission="can_use_tax_coach_ai" />}
                >
                  <Route path="staff/tax-coach-ai" element={<TaxCoachAIStaff />} />
                </Route>
                <Route
                  element={<RequireStaffPermission permission="can_view_overview" />}
                >
                  <Route path="staff" element={<StaffOverviewRouter />} />
                  <Route
                    path="staff/notifications"
                    element={<AdminNotifications />}
                  />
                  <Route path="staff/deadlines" element={<AdminDeadlines />} />
                </Route>
                <Route element={<RequireRole allowedRoles={["consultant"]} />}>
                  <Route
                    path="staff/profile"
                    element={<PractitionerProfile />}
                  />
                  <Route
                    path="staff/verification-documents"
                    element={<PractitionerDocumentsUploadPage />}
                  />
                  <Route
                    path="staff/credits"
                    element={<PractitionerCredits />}
                  />
                </Route>
                <Route
                  element={
                    <RequireStaffPermission permission="can_view_clients" />
                  }
                >
                  <Route path="staff/clients" element={<AdminClients />} />
                </Route>
                <Route
                  element={
                    <RequireStaffPermission permission="can_view_clients" />
                  }
                >
                  <Route
                    path="staff/service-requests"
                    element={<AdminServiceRequests />}
                  />
                </Route>
                <Route
                  element={
                    <RequireStaffPermission permission="can_view_client_workspace" />
                  }
                >
                  <Route
                    path="staff/client-workspace"
                    element={<AdminClientWorkspace />}
                  />
                </Route>
                <Route
                  element={
                    <RequireStaffPermission permission="can_view_cases" />
                  }
                >
                  <Route path="staff/cases" element={<AdminCases />} />
                </Route>
                <Route
                  element={
                    <RequireStaffPermission permission="can_view_documents" />
                  }
                >
                  <Route path="staff/documents" element={<AdminDocuments />} />
                </Route>
                <Route
                  element={
                    <RequireStaffPermission permission="can_view_invoices" />
                  }
                >
                  <Route path="staff/invoices" element={<AdminInvoices />} />
                </Route>
                <Route
                  element={
                    <RequireStaffPermission permission="can_view_messages" />
                  }
                >
                  <Route path="staff/messages" element={<AdminMessages />} />
                </Route>
                <Route
                  element={
                    <RequireStaffPermission permission="can_view_overview" />
                  }
                >
                  <Route
                    path="staff/activity-log"
                    element={<AdminActivityLog />}
                  />
                  <Route
                    path="staff/external-tools"
                    element={<StaffExternalToolsRouter />}
                  />
                </Route>
              </Route>

              <Route element={<RequireRole allowedRoles={["admin"]} />}>
                <Route path="staff/users" element={<AdminUsers />} />
                <Route path="staff/whatsapp-qa" element={<AdminWhatsAppQA />} />
                <Route path="staff/social-media" element={<AdminSocialMedia />} />
                <Route path="staff/ai-knowledge" element={<AdminAiKnowledge />} />
                <Route path="staff/prospect-hub" element={<AdminProspectHub />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <ErrorBoundary label="app">
            <AppRoutes />
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
