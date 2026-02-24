import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { Wrench, ArrowRight, Loader2, Building2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");

  const handleComplete = async () => {
    if (!businessName.trim()) {
      toast({ title: "Please enter your business name", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await apiRequest("PATCH", "/api/settings", {
        companyName: businessName.trim(),
        ...(phone.trim() ? { companyPhone: phone.trim() } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Welcome to Plaza Works!", description: "Your business is set up." });
      navigate("/dashboard");
    } catch (err: unknown) {
      toast({
        title: "Setup failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
              <Wrench className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Plaza Works</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 py-12">
        <div className="mx-auto max-w-md px-6">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold">Welcome to Plaza Works</h1>
            <p className="mt-2 text-muted-foreground">Set up your business</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business information
              </CardTitle>
              <CardDescription>Tell us about your trade business</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-name">Business name</Label>
                <Input
                  id="business-name"
                  placeholder="e.g., Smith Plumbing"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  data-testid="input-business-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(04) 1234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="input-phone"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={handleComplete}
                disabled={isLoading}
                data-testid="button-complete-setup"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Get started
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
