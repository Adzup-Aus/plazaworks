import { useState } from "react";
import type { Role } from "@shared/schema";
import { useRoles, useDeleteRole } from "@/hooks/use-roles";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RoleForm } from "@/components/role-form";
import { PermissionEditor } from "@/components/permission-editor";
import { useToast } from "@/hooks/use-toast";
import { Plus, Shield, Pencil, Trash2 } from "lucide-react";

export default function Roles() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [permissionsRole, setPermissionsRole] = useState<{ id: string; name: string } | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const { data: roles, isLoading } = useRoles();
  const deleteRoleMutation = useDeleteRole();
  const { toast } = useToast();

  const handleDeleteConfirm = async () => {
    if (!deleteRole) return;
    try {
      await deleteRoleMutation.mutateAsync(deleteRole.id);
      setDeleteRole(null);
      toast({ title: "Role deleted" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete role";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Role Management</h1>
          <p className="text-muted-foreground">
            Create and manage roles and their permissions.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px]">System</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!roles || roles.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No roles yet. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {role.name}
                        {role.isSystem && (
                          <Shield className="h-4 w-4 text-muted-foreground" title="System role" />
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.description ?? "—"}
                    </TableCell>
                    <TableCell>{role.isSystem ? "Yes" : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditRole(role)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPermissionsRole({ id: role.id, name: role.name })}
                        >
                          Permissions
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteRole(role)}
                          disabled={role.isSystem}
                          title={role.isSystem ? "System roles cannot be deleted" : "Delete role"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <RoleForm open={createOpen} onOpenChange={setCreateOpen} />
      <RoleForm
        open={!!editRole}
        onOpenChange={(open) => !open && setEditRole(null)}
        editRole={editRole}
        onSuccess={() => setEditRole(null)}
      />
      <AlertDialog open={!!deleteRole} onOpenChange={() => setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteRole?.name}&quot;? This cannot be undone.
              You cannot delete a role that is assigned to staff.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PermissionEditor
        roleId={permissionsRole?.id ?? null}
        roleName={permissionsRole?.name ?? ""}
        open={!!permissionsRole}
        onOpenChange={(open) => !open && setPermissionsRole(null)}
      />
    </div>
  );
}
