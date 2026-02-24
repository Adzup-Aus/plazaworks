import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useRolePermissions,
  useAvailablePermissions,
  useSetRolePermissions,
  type PermissionInfo,
} from "@/hooks/use-roles";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type PermissionEditorProps = {
  roleId: string | null;
  roleName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PermissionEditor({ roleId, roleName, open, onOpenChange }: PermissionEditorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: permsData, isLoading: permsLoading } = useRolePermissions(roleId);
  const { data: availableData, isLoading: availableLoading } = useAvailablePermissions();
  const setPermissions = useSetRolePermissions(roleId ?? "");
  const { toast } = useToast();

  useEffect(() => {
    if (permsData?.permissions) {
      setSelected(new Set(permsData.permissions));
    }
  }, [permsData?.permissions]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!roleId) return;
    try {
      await setPermissions.mutateAsync(Array.from(selected));
      toast({ title: "Permissions saved" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to save permissions", variant: "destructive" });
    }
  };

  const loading = permsLoading || availableLoading;
  const byCategory = (availableData?.permissions ?? []).reduce(
    (acc, p) => {
      const cat = p.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    },
    {} as Record<string, PermissionInfo[]>
  );
  const categories = availableData?.categories ?? Object.keys(byCategory).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissions: {roleName}</DialogTitle>
          <DialogDescription>
            Toggle which permissions this role has. Changes take effect when you save.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="grid gap-6 py-4">
            {categories.map((cat) => (
              <div key={cat}>
                <h4 className="text-sm font-medium mb-2">{cat}</h4>
                <div className="grid gap-2">
                  {(byCategory[cat] ?? []).map((p) => (
                    <div
                      key={p.key}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium text-sm">{p.displayName}</p>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                      </div>
                      <Switch
                        checked={selected.has(p.key)}
                        onCheckedChange={() => toggle(p.key)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || setPermissions.isPending}>
            {setPermissions.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
