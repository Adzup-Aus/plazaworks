import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationCenter } from "@/components/notification-center";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Jobs from "@/pages/jobs";
import JobForm from "@/pages/job-form";
import Schedule from "@/pages/schedule";
import Team from "@/pages/team";
import Quotes from "@/pages/quotes";
import QuoteForm from "@/pages/quote-form";
import Invoices from "@/pages/invoices";
import InvoiceDetail from "@/pages/invoice-detail";
import ClientPortal from "@/pages/client-portal";
import Fleet from "@/pages/fleet";
import Checklists from "@/pages/checklists";
import Productivity from "@/pages/productivity";
import Backcosting from "@/pages/backcosting";
import Capacity from "@/pages/capacity";
import KpiDashboard from "@/pages/kpi-dashboard";
import NotFound from "@/pages/not-found";

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/jobs/new" component={JobForm} />
      <Route path="/jobs/:id" component={JobForm} />
      <Route path="/quotes" component={Quotes} />
      <Route path="/quotes/new" component={QuoteForm} />
      <Route path="/quotes/:id" component={QuoteForm} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/invoices/new" component={InvoiceDetail} />
      <Route path="/invoices/:id" component={InvoiceDetail} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/fleet" component={Fleet} />
      <Route path="/checklists" component={Checklists} />
      <Route path="/productivity" component={Productivity} />
      <Route path="/backcosting" component={Backcosting} />
      <Route path="/capacity" component={Capacity} />
      <Route path="/kpi" component={KpiDashboard} />
      <Route path="/team" component={Team} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="mx-auto max-w-7xl">
              <AuthenticatedRouter />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-pulse rounded-md bg-primary/20" />
        <div className="space-y-2">
          <Skeleton className="mx-auto h-4 w-32" />
          <Skeleton className="mx-auto h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/portal/:token" component={ClientPortal} />
    </Switch>
  );
}

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (typeof window !== "undefined" && window.location.pathname.startsWith("/portal/")) {
    return <PublicRouter />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="plaza-works-theme">
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
