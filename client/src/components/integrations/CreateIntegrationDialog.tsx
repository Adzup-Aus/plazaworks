import { useState } from "react";
import type { Scope } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScopeSelector } from "./ScopeSelector";
import { TokenDisplay } from "./TokenDisplay";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CreateIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopes: Scope[];
}

export function CreateIntegrationDialog({ open, onOpenChange, scopes }: CreateIntegrationDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [tokenExpiryDate, setTokenExpiryDate] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations", {
        name,
        description: description || undefined,
        scopes: selectedScopes,
        tokenExpiryDate: tokenExpiryDate || null,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setCreatedToken(data.apiToken);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Integration created" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedScopes.length === 0) {
      toast({ title: "Select at least one scope", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setName("");
      setDescription("");
      setSelectedScopes([]);
      setTokenExpiryDate("");
      setCreatedToken(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{createdToken ? "Integration created" : "Create integration"}</DialogTitle>
          <DialogDescription>
            {createdToken
              ? "Copy your API token below. It will not be shown again."
              : "Create a new API integration and choose which scopes (permissions) to grant."}
          </DialogDescription>
        </DialogHeader>
        {createdToken ? (
          <div className="space-y-4 py-4">
            <TokenDisplay token={createdToken} />
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My CRM"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this integration is for"
              />
            </div>
            <ScopeSelector scopes={scopes} selected={selectedScopes} onChange={setSelectedScopes} />
            <div className="space-y-2">
              <Label htmlFor="expiry">Token expiry (optional)</Label>
              <Input
                id="expiry"
                type="datetime-local"
                value={tokenExpiryDate}
                onChange={(e) => setTokenExpiryDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || selectedScopes.length === 0}>
                Create & generate token
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
