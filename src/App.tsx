import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireRole } from "@/components/auth/RequireRole";
import { RequireStaffPermission } from "@/components/auth/RequireStaffPermission";
import { DashboardIndexRedirect } from "@/components/auth/DashboardIndexRedirect";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import DashboardOverview from "./pages/dashboard/Overview";
import Cases from "./pages/dashboard/Cases";
import Documents from "./pages/dashboard/Documents";
import Invoices from "./pages/dashboard/Invoices";
import Messages from "./pages/dashboard/Messages";
import Deadlines from "./pages/dashboard/Deadlines";
import SettingsPage from "./pages/dashboard/Settings";
import AdminOverview from "./pages/dashboard/admin/AdminOverview";
import AdminClients from "./pages/dashboard/admin/AdminClients";
import AdminCases from "./pages/dashboard/admin/AdminCases";
import AdminInvoices from "./pages/dashboard/admin/AdminInvoices";
import AdminDocuments from "./pages/dashboard/admin/AdminDocuments";
import AdminMessages from "./pages/dashboard/admin/AdminMessages";
import AdminClientWorkspace from "./pages/dashboard/admin/AdminClientWorkspace";
import AdminUsers from "./pages/dashboard/admin/AdminUsers";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<DashboardIndexRedirect />} />

              <Route element={<RequireRole allowedRoles={["client"]} />}>
                <Route path="client" element={<DashboardOverview />} />
                <Route path="client/cases" element={<Cases />} />
                <Route path="client/documents" element={<Documents />} />
                <Route path="client/invoices" element={<Invoices />} />
                <Route path="client/messages" element={<Messages />} />
                <Route path="client/deadlines" element={<Deadlines />} />
                <Route path="client/settings" element={<SettingsPage />} />
              </Route>

              <Route element={<RequireRole allowedRoles={["admin", "consultant"]} />}>
                <Route element={<RequireStaffPermission permission="can_view_overview" />}>
                  <Route path="staff" element={<AdminOverview />} />
                </Route>
                <Route element={<RequireStaffPermission permission="can_view_clients" />}>
                  <Route path="staff/clients" element={<AdminClients />} />
                </Route>
                <Route element={<RequireStaffPermission permission="can_view_client_workspace" />}>
                  <Route path="staff/client-workspace" element={<AdminClientWorkspace />} />
                </Route>
                <Route element={<RequireStaffPermission permission="can_view_cases" />}>
                  <Route path="staff/cases" element={<AdminCases />} />
                </Route>
                <Route element={<RequireStaffPermission permission="can_view_documents" />}>
                  <Route path="staff/documents" element={<AdminDocuments />} />
                </Route>
                <Route element={<RequireStaffPermission permission="can_view_invoices" />}>
                  <Route path="staff/invoices" element={<AdminInvoices />} />
                </Route>
                <Route element={<RequireStaffPermission permission="can_view_messages" />}>
                  <Route path="staff/messages" element={<AdminMessages />} />
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
