import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "lucide-react";
import { userRoles, employmentTypes, userPermissions, type StaffProfile, type User } from "@shared/schema";

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

function formatRole(role: string): string {
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

  const updateStaffMutation = useMutation({
    mutationFn: async (data: { id: string; roles: string[]; employmentType: string; permissions: string[] }) => {
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

  const openEditDialog = (staff: StaffWithUser) => {
    setEditingStaff(staff);
    setEditRoles(staff.roles || []);
    setEditEmploymentType(staff.employmentType || "permanent");
    setEditPermissions(staff.permissions || []);
    setIsDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingStaff) return;
    updateStaffMutation.mutate({
      id: editingStaff.id,
      roles: editRoles,
      employmentType: editEmploymentType,
      permissions: editPermissions,
    });
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
                  {userRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {formatRole(role)}
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
                              {formatRole(role)}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update roles, employment type, and permissions for{" "}
              {editingStaff?.user?.firstName} {editingStaff?.user?.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Roles</Label>
              <p className="text-sm text-muted-foreground">
                Select one or more roles for this team member
              </p>
              <div className="grid grid-cols-2 gap-3">
                {userRoles.map((role) => (
                  <div
                    key={role}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`role-${role}`}
                      checked={editRoles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                      data-testid={`checkbox-role-${role}`}
                    />
                    <Label
                      htmlFor={`role-${role}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {formatRole(role)}
                    </Label>
                  </div>
                ))}
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
                  <div
                    key={permission}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`perm-${permission}`}
                      checked={editPermissions.includes(permission)}
                      onCheckedChange={() => togglePermission(permission)}
                      data-testid={`checkbox-perm-${permission}`}
                    />
                    <Label
                      htmlFor={`perm-${permission}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {formatPermission(permission)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

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
