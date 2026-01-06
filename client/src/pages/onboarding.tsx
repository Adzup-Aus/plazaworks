import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { Wrench, ArrowRight, Loader2, Check, Building2, Users, Briefcase } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

type OnboardingStep = "business" | "plan";

const subscriptionTiers = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    priceNote: "Forever free",
    description: "Perfect for solo tradespeople or very small teams",
    features: [
      "Up to 3 team members",
      "50 jobs per month",
      "Basic job tracking",
      "Schedule calendar",
      "Mobile access",
    ],
    maxUsers: 3,
    maxJobs: 50,
  },
  {
    id: "professional",
    name: "Professional",
    price: "$99",
    priceNote: "per month",
    description: "For growing businesses with more staff",
    features: [
      "Up to 15 team members",
      "500 jobs per month",
      "Quotes & Invoices",
      "Time tracking",
      "Vehicle management",
      "Checklists",
      "Email support",
    ],
    maxUsers: 15,
    maxJobs: 500,
    popular: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "$249",
    priceNote: "per month",
    description: "For established companies with large teams",
    features: [
      "Unlimited team members",
      "Unlimited jobs",
      "Everything in Professional",
      "KPI dashboards",
      "Capacity planning",
      "Backcosting & analytics",
      "Priority support",
      "Custom integrations",
    ],
    maxUsers: -1,
    maxJobs: -1,
  },
];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState<OnboardingStep>("business");
  const [isLoading, setIsLoading] = useState(false);
  
  const [businessName, setBusinessName] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedTier, setSelectedTier] = useState("starter");

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const handleBusinessNameChange = (value: string) => {
    setBusinessName(value);
    setBusinessSlug(generateSlug(value));
  };

  const handleContinue = () => {
    if (!businessName || !businessSlug) {
      toast({ title: "Please enter your business name", variant: "destructive" });
      return;
    }
    setStep("plan");
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const tier = subscriptionTiers.find(t => t.id === selectedTier);
      
      const res = await apiRequest("POST", "/api/organizations", {
        name: businessName,
        slug: businessSlug,
        type: "customer",
        phone,
      });
      
      const org = await res.json();
      
      if (selectedTier !== "starter") {
        await apiRequest("PATCH", `/api/organizations/${org.id}/subscription`, {
          tier: selectedTier,
          maxUsers: tier?.maxUsers,
          maxJobs: tier?.maxJobs,
          features: tier?.features || [],
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      
      toast({ title: "Welcome to Plaza Works!", description: "Your business is set up and ready to go." });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message, variant: "destructive" });
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
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold">Welcome to Plaza Works</h1>
            <p className="mt-2 text-muted-foreground">
              {step === "business" 
                ? "Let's set up your business" 
                : "Choose the plan that's right for you"}
            </p>
          </div>

          <div className="mb-8 flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${step === "business" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step === "business" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {step === "plan" ? <Check className="h-4 w-4" /> : "1"}
              </div>
              <span className="text-sm font-medium">Business Details</span>
            </div>
            <div className="h-px w-12 bg-border" />
            <div className={`flex items-center gap-2 ${step === "plan" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step === "plan" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                2
              </div>
              <span className="text-sm font-medium">Choose Plan</span>
            </div>
          </div>

          {step === "business" && (
            <Card className="mx-auto max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Business Information
                </CardTitle>
                <CardDescription>
                  Tell us about your trade business
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input
                    id="business-name"
                    placeholder="e.g., Smith Plumbing"
                    value={businessName}
                    onChange={(e) => handleBusinessNameChange(e.target.value)}
                    data-testid="input-business-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-slug">URL Slug</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">plazaworks.com/</span>
                    <Input
                      id="business-slug"
                      placeholder="smith-plumbing"
                      value={businessSlug}
                      onChange={(e) => setBusinessSlug(e.target.value)}
                      data-testid="input-business-slug"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (optional)</Label>
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
                  onClick={handleContinue}
                  data-testid="button-continue-plan"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {step === "plan" && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                {subscriptionTiers.map((tier) => (
                  <Card 
                    key={tier.id}
                    className={`relative cursor-pointer transition-all ${
                      selectedTier === tier.id 
                        ? "border-primary ring-2 ring-primary ring-offset-2" 
                        : "hover-elevate"
                    }`}
                    onClick={() => setSelectedTier(tier.id)}
                    data-testid={`card-tier-${tier.id}`}
                  >
                    {tier.popular && (
                      <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                        Most Popular
                      </Badge>
                    )}
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {tier.name}
                        {selectedTier === tier.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </CardTitle>
                      <div>
                        <span className="text-3xl font-bold">{tier.price}</span>
                        <span className="text-sm text-muted-foreground ml-1">
                          {tier.priceNote}
                        </span>
                      </div>
                      <CardDescription>{tier.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {tier.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="flex flex-wrap justify-center gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => setStep("business")}
                  data-testid="button-back-business"
                >
                  Back
                </Button>
                <Button 
                  size="lg"
                  onClick={handleComplete}
                  disabled={isLoading}
                  data-testid="button-complete-setup"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  {selectedTier === "starter" ? "Start Free" : "Continue to Payment"}
                </Button>
              </div>
              
              <p className="text-center text-sm text-muted-foreground">
                {selectedTier === "starter" 
                  ? "No credit card required. Upgrade anytime." 
                  : "You can cancel or change your plan at any time."}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
