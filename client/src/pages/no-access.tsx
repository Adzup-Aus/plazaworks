import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function NoAccess() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="rounded-full bg-muted p-6">
        <ShieldX className="h-16 w-16 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">No access</h1>
        <p className="max-w-md text-muted-foreground">
          You don&apos;t have access to any sections yet. Please contact an administrator to assign you permissions.
        </p>
      </div>
      <Button variant="outline" onClick={() => logout()} data-testid="button-no-access-logout">
        Sign out
      </Button>
    </div>
  );
}
