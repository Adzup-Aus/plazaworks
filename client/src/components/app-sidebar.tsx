import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  Users,
  LogOut,
  Wrench,
  FileText,
  Receipt,
  Clock,
  BarChart3,
  Target,
  Shield,
  UserCircle,
  UserPlus,
  Settings,
  ListTodo,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { filterNavByPermissions } from "@/lib/permissions";
import type { UserPermission } from "@shared/schema";

const mainNavItems = [
  { title: "Jobs", url: "/jobs", icon: Briefcase, permission: "view_jobs" as UserPermission },
  { title: "Quotes", url: "/quotes", icon: FileText, permission: "view_quotes" as UserPermission },
  { title: "Invoices", url: "/invoices", icon: Receipt, permission: "view_invoices" as UserPermission },
  { title: "Schedule", url: "/schedule", icon: Calendar, permission: "view_schedule" as UserPermission },
  { title: "Activities", url: "/activities", icon: ListTodo, permission: "view_activities" as UserPermission },
  { title: "Team", url: "/team", icon: Users, permission: "view_users" as UserPermission },
  { title: "Clients", url: "/clients", icon: UserCircle, permission: "view_clients" as UserPermission },
  { title: "Settings", url: "/settings", icon: Settings, permission: "admin_settings" as UserPermission },
];

const dashboardsNavItems = [
  { title: "Overview", url: "/", icon: LayoutDashboard, permission: "view_dashboard" as UserPermission },
  { title: "KPI", url: "/kpi", icon: Target, permission: "view_reports" as UserPermission },
  { title: "Time Tracking", url: "/productivity", icon: Clock, permission: "view_reports" as UserPermission },
  { title: "Capacity", url: "/capacity", icon: BarChart3, permission: "view_reports" as UserPermission },
];

const adminNavItems = [
  {
    title: "Super Admin",
    url: "/admin",
    icon: Shield,
  },
  {
    title: "Invite users",
    url: "/admin/invites",
    icon: UserPlus,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { permissions, isAdmin } = usePermissions();
  const visibleMainNav = filterNavByPermissions(mainNavItems, permissions, isAdmin);
  const visibleDashboardsNav = filterNavByPermissions(dashboardsNavItems, permissions, isAdmin);

  const { data: adminStatus } = useQuery<{ isSuperAdmin: boolean }>({
    queryKey: ["/api/auth/is-super-admin"],
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Wrench className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold">Plaza Works</span>
            <span className="text-xs text-muted-foreground">Job Management</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {visibleDashboardsNav.length > 0 && (
                <Collapsible
                  defaultOpen={visibleDashboardsNav.some((item) => location === item.url)}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton data-testid="nav-dashboards">
                        <BarChart3 className="h-4 w-4" />
                        <span>Dashboards</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {visibleDashboardsNav.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location === item.url}
                              data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                            >
                              <Link href={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminStatus?.isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
            <AvatarFallback className="text-xs">
              {getInitials(user?.firstName, user?.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-medium">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user?.email}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            data-testid="button-logout"
            className="flex-shrink-0"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Logout</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
