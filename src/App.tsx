import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
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
              <Route index element={<DashboardOverview />} />
              <Route path="cases" element={<Cases />} />
              <Route path="documents" element={<Documents />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="messages" element={<Messages />} />
              <Route path="deadlines" element={<Deadlines />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin" element={<AdminOverview />} />
              <Route path="admin/clients" element={<AdminClients />} />
              <Route path="admin/cases" element={<AdminCases />} />
              <Route path="admin/invoices" element={<AdminInvoices />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
