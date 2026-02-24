import { useState, useEffect } from "react";
import type { Role } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateRole, useUpdateRole } from "@/hooks/use-roles";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type RoleFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editRole?: Role | null;
};

export function RoleForm({ open, onOpenChange, onSuccess, editRole }: RoleFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createRole = useCreateRole();
  const updateRole = useUpdateRole(editRole?.id ?? "");
  const { toast } = useToast();

  useEffect(() => {
    if (editRole) {
      setName(editRole.name);
      setDescription(editRole.description ?? "");
    } else {
      setName("");
      setDescription("");
    }
  }, [editRole, open]);

  const isEdit = !!editRole;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (isEdit) {
        await updateRole.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
        toast({ title: "Role updated" });
      } else {
        await createRole.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
        toast({ title: "Role created" });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: isEdit ? "Failed to update role" : "Failed to create role", description: msg, variant: "destructive" });
    }
  };

  const pending = createRole.isPending || updateRole.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Role" : "Create Role"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the role name and description." : "Add a new role with a name and optional description."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="role-name">Name *</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Project Manager"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
