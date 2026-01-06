import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type AuthStep = "email" | "otp" | "password";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [authMethod, setAuthMethod] = useState<"otp" | "password">("otp");
  const [step, setStep] = useState<AuthStep>("email");
  const [isLoading, setIsLoading] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const handleRequestOTP = async () => {
    if (!email) {
      toast({ title: "Please enter your email", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/otp/request", { email });
      const data = await res.json();
      
      toast({ title: "Verification code sent", description: "Check your email for the code" });
      setStep("otp");
      
      if (data.code) {
        setOtpCode(data.code);
      }
    } catch (err: any) {
      toast({ title: "Failed to send code", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode) {
      toast({ title: "Please enter the verification code", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/otp/verify", { email, code: otpCode });
      const data = await res.json();
      
      toast({ title: "Login successful" });
      
      if (data.memberships && data.memberships.length > 0) {
        navigate("/dashboard");
      } else {
        navigate("/onboarding");
      }
    } catch (err: any) {
      toast({ title: "Invalid code", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!email || !password) {
      toast({ title: "Please enter email and password", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await res.json();
      
      if (data.useOTP) {
        toast({ title: "Use OTP login", description: data.message });
        setAuthMethod("otp");
        return;
      }
      
      toast({ title: "Login successful" });
      
      if (data.memberships && data.memberships.length > 0) {
        navigate("/dashboard");
      } else {
        navigate("/onboarding");
      }
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
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
            <CardTitle className="text-2xl">Sign In</CardTitle>
            <CardDescription>
              Sign in to your Plaza Works account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as "otp" | "password")}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="otp" data-testid="tab-otp">
                  <Mail className="mr-2 h-4 w-4" />
                  Email Code
                </TabsTrigger>
                <TabsTrigger value="password" data-testid="tab-password">
                  <Lock className="mr-2 h-4 w-4" />
                  Password
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="otp">
                {step === "email" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email-otp">Email address</Label>
                      <Input
                        id="email-otp"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        data-testid="input-email-otp"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleRequestOTP}
                      disabled={isLoading}
                      data-testid="button-request-otp"
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="mr-2 h-4 w-4" />
                      )}
                      Send Verification Code
                    </Button>
                  </div>
                )}
                
                {step === "otp" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otp-code">Verification Code</Label>
                      <Input
                        id="otp-code"
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        maxLength={6}
                        data-testid="input-otp-code"
                      />
                      <p className="text-sm text-muted-foreground">
                        We sent a code to {email}
                      </p>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleVerifyOTP}
                      disabled={isLoading}
                      data-testid="button-verify-otp"
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="mr-2 h-4 w-4" />
                      )}
                      Verify & Sign In
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full"
                      onClick={() => setStep("email")}
                      data-testid="button-back-email"
                    >
                      Use different email
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="password">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-password">Email address</Label>
                    <Input
                      id="email-password"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-email-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <a 
                        href="/forgot-password" 
                        className="text-sm text-primary hover:underline"
                        data-testid="link-forgot-password"
                      >
                        Forgot password?
                      </a>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-password"
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handlePasswordLogin}
                    disabled={isLoading}
                    data-testid="button-password-login"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Sign In
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <a 
                  href="/register" 
                  className="text-primary hover:underline"
                  data-testid="link-register"
                >
                  Create one
                </a>
              </p>
            </div>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full" 
              asChild
              data-testid="button-replit-auth"
            >
              <a href="/api/login">Replit Account</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
