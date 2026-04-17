import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireRole } from "@/components/auth/RequireRole";
import { RequireStaffPermission } from "@/components/auth/RequireStaffPermission";
import { DashboardIndexRedirect } from "@/components/auth/DashboardIndexRedirect";
import { StaffOverviewRouter } from "@/components/auth/StaffOverviewRouter";
import { StaffExternalToolsRouter } from "@/components/auth/StaffExternalToolsRouter";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import RequestTaxAssistance from "./pages/RequestTaxAssistance";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import RefundPolicy from "./pages/RefundPolicy";
import Disclaimer from "./pages/Disclaimer";
import PractitionerGuidelines from "./pages/PractitionerGuidelines";
import CookiePolicy from "./pages/CookiePolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import Faq from "./pages/Faq";
import TrustSafety from "./pages/TrustSafety";
import OurServices from "./pages/OurServices";
import HowAcapoliteWorks from "./pages/HowAcapoliteWorks";
import ContactUs from "./pages/ContactUs";
import HelpCenter from "./pages/HelpCenter";
import AboutUs from "./pages/AboutUs";
import Dashboard from "./pages/Dashboard";
import DashboardOverview from "./pages/dashboard/Overview";
import TaxCoachAIClient from "./pages/dashboard/TaxCoachAIClient";
import ServiceRequests from "./pages/dashboard/ServiceRequests";
import Cases from "./pages/dashboard/Cases";
import Documents from "./pages/dashboard/Documents";
import Invoices from "./pages/dashboard/Invoices";
import Messages from "./pages/dashboard/Messages";
import Notifications from "./pages/dashboard/Notifications";
import Deadlines from "./pages/dashboard/Deadlines";
import SettingsPage from "./pages/dashboard/Settings";
import AdminClients from "./pages/dashboard/admin/AdminClients";
import AdminCases from "./pages/dashboard/admin/AdminCases";
import AdminInvoices from "./pages/dashboard/admin/AdminInvoices";
import AdminDocuments from "./pages/dashboard/admin/AdminDocuments";
import AdminMessages from "./pages/dashboard/admin/AdminMessages";
import AdminNotifications from "./pages/dashboard/admin/AdminNotifications";
import AdminClientWorkspace from "./pages/dashboard/admin/AdminClientWorkspace";
import AdminUsers from "./pages/dashboard/admin/AdminUsers";
import AdminServiceRequests from "./pages/dashboard/admin/AdminServiceRequests";
import PractitionerProfile from "./pages/dashboard/admin/PractitionerProfile";
import PractitionerCredits from "./pages/dashboard/admin/PractitionerCredits";
import PractitionerDocumentsUploadPage from "./pages/dashboard/admin/PractitionerDocumentsUploadPage";
import AdminActivityLog from "./pages/dashboard/admin/AdminActivityLog";
import TaxCoachAIStaff from "./pages/dashboard/admin/TaxCoachAIStaff";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
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
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/help-center" element={<HelpCenter />} />
            <Route path="/about-us" element={<AboutUs />} />
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
                  element={
                    <RequireStaffPermission permission="can_view_overview" />
                  }
                >
                  <Route path="staff" element={<StaffOverviewRouter />} />
                  <Route
                    path="staff/notifications"
                    element={<AdminNotifications />}
                  />
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
                    path="staff/tax-coach-ai"
                    element={<TaxCoachAIStaff />}
                  />
                  <Route
                    path="staff/external-tools"
                    element={<StaffExternalToolsRouter />}
                  />
                </Route>
              </Route>

              <Route element={<RequireRole allowedRoles={["admin"]} />}>
                <Route path="staff/users" element={<AdminUsers />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
