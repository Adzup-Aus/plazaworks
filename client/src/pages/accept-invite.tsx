import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { Wrench, ArrowRight, Loader2, CheckCircle2, XCircle, Building2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function AcceptInvite() {
  const [, params] = useRoute("/invite/:code");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptResult, setAcceptResult] = useState<{ success: boolean; message: string; orgName?: string } | null>(null);

  const { data: session, isLoading: sessionLoading } = useQuery<{
    isAuthenticated: boolean;
    userId?: string;
    authType?: string;
  }>({
    queryKey: ["/api/auth/session"],
  });

  const handleAcceptInvite = async () => {
    if (!session?.isAuthenticated) {
      const returnUrl = `/invite/${params?.code}`;
      navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsAccepting(true);
    try {
      const res = await apiRequest("POST", `/api/invites/${params?.code}/accept`);
      const data = await res.json();
      
      setAcceptResult({
        success: true,
        message: "You've joined the organization!",
        orgName: data.organization?.name,
      });
      
      toast({ title: "Invite accepted!", description: `You're now a member of ${data.organization?.name}` });
      
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (err: any) {
      setAcceptResult({
        success: false,
        message: err.message || "Failed to accept invite",
      });
      toast({ title: "Failed to accept invite", description: err.message, variant: "destructive" });
    } finally {
      setIsAccepting(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
              <Wrench className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Plaza Works</span>
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Team Invitation</CardTitle>
            <CardDescription>
              You've been invited to join an organization on Plaza Works
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {acceptResult ? (
              <div className="text-center space-y-4">
                {acceptResult.success ? (
                  <>
                    <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
                    <div>
                      <p className="font-medium">{acceptResult.message}</p>
                      {acceptResult.orgName && (
                        <p className="text-muted-foreground">
                          Welcome to {acceptResult.orgName}
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Redirecting to dashboard...
                    </p>
                  </>
                ) : (
                  <>
                    <XCircle className="mx-auto h-12 w-12 text-destructive" />
                    <div>
                      <p className="font-medium text-destructive">{acceptResult.message}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate("/")}
                      data-testid="button-go-home"
                    >
                      Go to Homepage
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <>
                <p className="text-center text-muted-foreground">
                  Invite code: <code className="rounded bg-muted px-2 py-1">{params?.code}</code>
                </p>
                
                {!session?.isAuthenticated && (
                  <p className="text-center text-sm text-muted-foreground">
                    You'll need to sign in or create an account to accept this invitation.
                  </p>
                )}

                <Button 
                  className="w-full" 
                  onClick={handleAcceptInvite}
                  disabled={isAccepting}
                  data-testid="button-accept-invite"
                >
                  {isAccepting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  {session?.isAuthenticated ? "Accept Invitation" : "Sign In to Accept"}
                </Button>

                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => navigate("/")}
                  data-testid="button-decline-invite"
                >
                  Decline
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
