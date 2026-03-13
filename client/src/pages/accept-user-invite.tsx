import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Loader2, ArrowRight, XCircle, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

function getTokenFromQuery(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? "";
}

export default function AcceptUserInvite() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = getTokenFromQuery();
    setToken(t);
    if (!t) {
      setLoading(false);
      setValid(false);
      return;
    }
    fetch(`/api/invites/accept?token=${encodeURIComponent(t)}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setLoading(false);
        setValid(data.valid === true && data.email);
        setEmail(data.email ?? "");
        const first = data.firstName ?? "";
        const last = data.lastName ?? "";
        setDisplayName([first, last].filter(Boolean).join(" ") || "");
      })
      .catch(() => {
        setLoading(false);
        setValid(false);
      });
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (password.length < 8) errs.password = "Password must be at least 8 characters";
    if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/invites/accept", { token, password });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.message || "Failed to create account", variant: "destructive" });
        return;
      }
      toast({ title: "Account created", description: "You can now sign in." });
      navigate("/login?registered=1");
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

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
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <UserPlus className="h-6 w-6" />
              Set your password
            </CardTitle>
            <CardDescription>
              {loading
                ? "Checking invite…"
                : valid
                  ? displayName
                    ? `Set a password for ${displayName} (${email})`
                    : `Set a password for ${email}`
                  : "Invalid or expired invite link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && !valid && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5 shrink-0" />
                  <span>
                    This invite link is invalid or has expired. Ask your admin for a new invite, or
                    sign in if you already have an account.
                  </span>
                </div>
                <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
                  Go to sign in
                </Button>
              </div>
            )}

            {!loading && valid && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Create account
                </Button>
              </form>
            )}

            {!loading && valid && (
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => navigate("/login")}
                  >
                    Sign in
                  </button>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
