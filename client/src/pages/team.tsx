import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  Search,
  Users,
  Filter,
  Edit2,
  Shield,
  Briefcase,
  Loader2,
  DollarSign,
  Clock,
  Mail,
} from "lucide-react";
import { employmentTypes, userPermissions, type StaffProfile, type User, type UserWorkingHours } from "@shared/schema";
import { useRoles } from "@/hooks/use-roles";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type StaffWithUser = StaffProfile & {
  user?: User;
};

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    plumber: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    plumbing_manager: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    project_manager: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    carpenter: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    waterproofer: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    tiler: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    electrician: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    admin: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  return colors[role] || "bg-muted text-muted-foreground";
}

function formatRoleDisplay(role: string): string {
  if (role.includes("_")) {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return role;
}

function formatPermission(permission: string): string {
  return permission
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function Team() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [employmentFilter, setEmploymentFilter] = useState<string>("all");
  const [editingStaff, setEditingStaff] = useState<StaffWithUser | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: staffList, isLoading } = useQuery<StaffWithUser[]>({
    queryKey: ["/api/staff"],
  });

  const { data: rolesList } = useRoles();

  const updateStaffMutation = useMutation({
    mutationFn: async (data: { 
      id: string; 
      roles: string[]; 
      employmentType: string; 
      permissions: string[];
      salaryType?: string;
      salaryAmount?: string;
      overtimeRateMultiplier?: string;
      overtimeThresholdHours?: string;
      emailSignature?: string;
      timezone?: string;
      lunchBreakMinutes?: number;
      lunchBreakPaid?: boolean;
    }) => {
      return apiRequest("PATCH", `/api/staff/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({
        title: "Staff updated",
        description: "Staff member has been updated successfully.",
      });
      setIsDialogOpen(false);
      setEditingStaff(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update staff member",
        variant: "destructive",
      });
    },
  });

  const filteredStaff = (staffList || []).filter((staff) => {
    const userName = `${staff.user?.firstName || ""} ${staff.user?.lastName || ""}`.toLowerCase();
    const email = staff.user?.email?.toLowerCase() || "";
    
    const matchesSearch =
      searchQuery === "" ||
      userName.includes(searchQuery.toLowerCase()) ||
      email.includes(searchQuery.toLowerCase());
    
    const matchesRole =
      roleFilter === "all" || (staff.roles || []).includes(roleFilter);
    
    const matchesEmployment =
      employmentFilter === "all" || staff.employmentType === employmentFilter;
    
    return matchesSearch && matchesRole && matchesEmployment;
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const handleEditStaff = (staff: StaffWithUser) => {
    setEditingStaff(staff);
    setIsDialogOpen(true);
  };

  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editEmploymentType, setEditEmploymentType] = useState<string>("permanent");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("roles");
  
  const [editSalaryType, setEditSalaryType] = useState<string>("hourly");
  const [editSalaryAmount, setEditSalaryAmount] = useState<string>("");
  const [editOvertimeMultiplier, setEditOvertimeMultiplier] = useState<string>("1.5");
  const [editOvertimeThreshold, setEditOvertimeThreshold] = useState<string>("38");
  
  const [editEmailSignature, setEditEmailSignature] = useState<string>("");
  const [editTimezone, setEditTimezone] = useState<string>("Australia/Sydney");
  const [editLunchBreakMinutes, setEditLunchBreakMinutes] = useState<string>("30");
  const [editLunchBreakPaid, setEditLunchBreakPaid] = useState<boolean>(false);
  
  const [editWorkingHours, setEditWorkingHours] = useState<{
    dayOfWeek: number;
    isWorkingDay: boolean;
    startTime: string;
    endTime: string;
  }[]>([]);

  const openEditDialog = (staff: StaffWithUser) => {
    setEditingStaff(staff);
    setEditRoles(staff.roles || []);
    setEditEmploymentType(staff.employmentType || "permanent");
    setEditPermissions(staff.permissions || []);
    setActiveTab("roles");
    
    setEditSalaryType(staff.salaryType || "hourly");
    setEditSalaryAmount(staff.salaryAmount || "");
    setEditOvertimeMultiplier(staff.overtimeRateMultiplier || "1.5");
    setEditOvertimeThreshold(staff.overtimeThresholdHours || "38");
    
    setEditEmailSignature(staff.emailSignature || "");
    setEditTimezone(staff.timezone || "Australia/Sydney");
    setEditLunchBreakMinutes(staff.lunchBreakMinutes?.toString() || "30");
    setEditLunchBreakPaid(staff.lunchBreakPaid || false);
    
    const defaultHours = DAYS_OF_WEEK.map((_, i) => ({
      dayOfWeek: i,
      isWorkingDay: i >= 1 && i <= 5,
      startTime: "07:00",
      endTime: "15:30",
    }));
    setEditWorkingHours(defaultHours);
    
    setIsDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingStaff) return;
    updateStaffMutation.mutate({
      id: editingStaff.id,
      roles: editRoles,
      employmentType: editEmploymentType,
      permissions: editPermissions,
      salaryType: editSalaryType,
      salaryAmount: editSalaryAmount || undefined,
      overtimeRateMultiplier: editOvertimeMultiplier,
      overtimeThresholdHours: editOvertimeThreshold,
      emailSignature: editEmailSignature || undefined,
      timezone: editTimezone,
      lunchBreakMinutes: parseInt(editLunchBreakMinutes) || 30,
      lunchBreakPaid: editLunchBreakPaid,
    });
  };
  
  const updateWorkingDay = (dayIndex: number, field: keyof typeof editWorkingHours[0], value: string | boolean) => {
    setEditWorkingHours((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayIndex ? { ...day, [field]: value } : day
      )
    );
  };

  const toggleRole = (role: string) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const togglePermission = (permission: string) => {
    setEditPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-muted-foreground">
            Manage staff members, roles, and permissions
          </p>
        </div>
      </div>

      <Card className="overflow-visible">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-team"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-role-filter">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {(rolesList || []).map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={employmentFilter} onValueChange={setEmploymentFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-employment-filter">
                  <Briefcase className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Employment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {employmentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No team members found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery || roleFilter !== "all" || employmentFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Team members will appear here when they log in"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Employment</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((staff) => (
                    <TableRow key={staff.id} data-testid={`staff-row-${staff.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage
                              src={staff.user?.profileImageUrl || undefined}
                              alt={staff.user?.firstName || "User"}
                            />
                            <AvatarFallback className="text-xs">
                              {getInitials(staff.user?.firstName, staff.user?.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {staff.user?.firstName} {staff.user?.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {staff.user?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(staff.roles || []).slice(0, 2).map((role) => (
                            <Badge
                              key={role}
                              variant="secondary"
                              className={getRoleColor(role)}
                            >
                              {formatRoleDisplay(role)}
                            </Badge>
                          ))}
                          {(staff.roles || []).length > 2 && (
                            <Badge variant="outline">
                              +{(staff.roles || []).length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {staff.employmentType?.charAt(0).toUpperCase() +
                            (staff.employmentType?.slice(1) || "")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {(staff.permissions || []).length} permissions
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            staff.isActive
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                          }
                        >
                          {staff.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(staff)}
                          data-testid={`button-edit-staff-${staff.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update profile for {editingStaff?.user?.firstName} {editingStaff?.user?.lastName}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="roles" data-testid="tab-roles">
                <Shield className="h-4 w-4 mr-2" />
                Roles
              </TabsTrigger>
              <TabsTrigger value="compensation" data-testid="tab-compensation">
                <DollarSign className="h-4 w-4 mr-2" />
                Pay
              </TabsTrigger>
              <TabsTrigger value="contact" data-testid="tab-contact">
                <Mail className="h-4 w-4 mr-2" />
                Contact
              </TabsTrigger>
              <TabsTrigger value="hours" data-testid="tab-hours">
                <Clock className="h-4 w-4 mr-2" />
                Hours
              </TabsTrigger>
            </TabsList>

            <TabsContent value="roles" className="space-y-6 py-4">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Roles</Label>
                <p className="text-sm text-muted-foreground">
                  Select one or more roles for this team member
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(rolesList || []).map((role) => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={editRoles.includes(role.name)}
                        onCheckedChange={() => toggleRole(role.name)}
                        data-testid={`checkbox-role-${role.name}`}
                      />
                      <Label htmlFor={`role-${role.id}`} className="text-sm font-normal cursor-pointer">
                        {role.name}
                      </Label>
                    </div>
                  ))}
                  {(!rolesList || rolesList.length === 0) && (
                    <p className="col-span-2 text-sm text-muted-foreground">
                      No roles defined yet. Create roles in Settings → Roles.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Employment Type</Label>
                <Select value={editEmploymentType} onValueChange={setEditEmploymentType}>
                  <SelectTrigger data-testid="select-edit-employment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {employmentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Custom Permissions</Label>
                <p className="text-sm text-muted-foreground">
                  Grant specific permissions independent of roles
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {userPermissions.map((permission) => (
                    <div key={permission} className="flex items-center space-x-2">
                      <Checkbox
                        id={`perm-${permission}`}
                        checked={editPermissions.includes(permission)}
                        onCheckedChange={() => togglePermission(permission)}
                        data-testid={`checkbox-perm-${permission}`}
                      />
                      <Label htmlFor={`perm-${permission}`} className="text-sm font-normal cursor-pointer">
                        {formatPermission(permission)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="compensation" className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Salary Type</Label>
                  <Select value={editSalaryType} onValueChange={setEditSalaryType}>
                    <SelectTrigger data-testid="select-salary-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {editSalaryType === "hourly" ? "Hourly Rate ($)" : "Annual Salary ($)"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editSalaryAmount}
                    onChange={(e) => setEditSalaryAmount(e.target.value)}
                    placeholder={editSalaryType === "hourly" ? "45.00" : "85000"}
                    data-testid="input-salary-amount"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Overtime Multiplier</Label>
                  <Select value={editOvertimeMultiplier} onValueChange={setEditOvertimeMultiplier}>
                    <SelectTrigger data-testid="select-overtime-multiplier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.25">1.25x</SelectItem>
                      <SelectItem value="1.5">1.5x</SelectItem>
                      <SelectItem value="1.75">1.75x</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Rate multiplier for overtime hours</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Overtime Threshold (hrs/week)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="60"
                    value={editOvertimeThreshold}
                    onChange={(e) => setEditOvertimeThreshold(e.target.value)}
                    data-testid="input-overtime-threshold"
                  />
                  <p className="text-xs text-muted-foreground">Weekly hours before overtime applies</p>
                </div>
              </div>

              <div className="rounded-md bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  {editSalaryType === "hourly" && editSalaryAmount ? (
                    <>
                      Effective rate: <span className="font-medium">${parseFloat(editSalaryAmount).toFixed(2)}/hr</span>
                      {" | "}
                      Overtime rate: <span className="font-medium">
                        ${(parseFloat(editSalaryAmount) * parseFloat(editOvertimeMultiplier)).toFixed(2)}/hr
                      </span>
                    </>
                  ) : editSalaryType === "annual" && editSalaryAmount ? (
                    <>
                      Annual salary: <span className="font-medium">${parseInt(editSalaryAmount).toLocaleString()}</span>
                      {" | "}
                      Approx hourly: <span className="font-medium">
                        ${(parseFloat(editSalaryAmount) / 2080).toFixed(2)}/hr
                      </span>
                    </>
                  ) : (
                    "Enter salary amount to see calculations"
                  )}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-6 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Timezone</Label>
                <Select value={editTimezone} onValueChange={setEditTimezone}>
                  <SelectTrigger data-testid="select-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</SelectItem>
                    <SelectItem value="Australia/Melbourne">Australia/Melbourne (AEST/AEDT)</SelectItem>
                    <SelectItem value="Australia/Brisbane">Australia/Brisbane (AEST)</SelectItem>
                    <SelectItem value="Australia/Perth">Australia/Perth (AWST)</SelectItem>
                    <SelectItem value="Australia/Adelaide">Australia/Adelaide (ACST/ACDT)</SelectItem>
                    <SelectItem value="Pacific/Auckland">New Zealand (NZST/NZDT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Email Signature</Label>
                <Input
                  value={editEmailSignature}
                  onChange={(e) => setEditEmailSignature(e.target.value)}
                  placeholder="e.g., Best regards, John"
                  data-testid="input-email-signature"
                />
                <p className="text-xs text-muted-foreground">
                  Used when sending emails to clients
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Lunch Break Duration</Label>
                  <Select value={editLunchBreakMinutes} onValueChange={setEditLunchBreakMinutes}>
                    <SelectTrigger data-testid="select-lunch-duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No lunch break</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Lunch Break Paid</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      checked={editLunchBreakPaid}
                      onCheckedChange={setEditLunchBreakPaid}
                      data-testid="switch-lunch-paid"
                    />
                    <Label className="text-sm font-normal">
                      {editLunchBreakPaid ? "Paid break" : "Unpaid break"}
                    </Label>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="hours" className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Configure working hours for each day of the week
              </p>
              <div className="space-y-3">
                {editWorkingHours.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className={`flex items-center gap-4 p-3 rounded-md border ${
                      day.isWorkingDay ? "" : "bg-muted/50 opacity-70"
                    }`}
                  >
                    <div className="w-28">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={day.isWorkingDay}
                          onCheckedChange={(checked) =>
                            updateWorkingDay(day.dayOfWeek, "isWorkingDay", checked as boolean)
                          }
                          data-testid={`checkbox-workday-${day.dayOfWeek}`}
                        />
                        <Label className="text-sm font-medium">
                          {DAYS_OF_WEEK[day.dayOfWeek]}
                        </Label>
                      </div>
                    </div>
                    {day.isWorkingDay && (
                      <>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Start</Label>
                          <Input
                            type="time"
                            value={day.startTime}
                            onChange={(e) =>
                              updateWorkingDay(day.dayOfWeek, "startTime", e.target.value)
                            }
                            className="w-32"
                            data-testid={`input-start-${day.dayOfWeek}`}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">End</Label>
                          <Input
                            type="time"
                            value={day.endTime}
                            onChange={(e) =>
                              updateWorkingDay(day.dayOfWeek, "endTime", e.target.value)
                            }
                            className="w-32"
                            data-testid={`input-end-${day.dayOfWeek}`}
                          />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {(() => {
                            const [sh, sm] = day.startTime.split(":").map(Number);
                            const [eh, em] = day.endTime.split(":").map(Number);
                            const hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
                            return hours > 0 ? `${hours.toFixed(1)}h` : "--";
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="rounded-md bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Weekly hours:{" "}
                  <span className="font-medium">
                    {editWorkingHours
                      .filter((d) => d.isWorkingDay)
                      .reduce((sum, day) => {
                        const [sh, sm] = day.startTime.split(":").map(Number);
                        const [eh, em] = day.endTime.split(":").map(Number);
                        return sum + (eh * 60 + em - (sh * 60 + sm)) / 60;
                      }, 0)
                      .toFixed(1)}
                    h
                  </span>
                  {" | "}
                  Working days:{" "}
                  <span className="font-medium">
                    {editWorkingHours.filter((d) => d.isWorkingDay).length}
                  </span>
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={updateStaffMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateStaffMutation.isPending}
              data-testid="button-save-staff"
            >
              {updateStaffMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
