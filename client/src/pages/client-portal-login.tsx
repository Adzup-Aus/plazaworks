import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Building2, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const otpSchema = z.object({
  code: z.string().length(6, "Please enter the 6-digit code"),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type OTPFormValues = z.infer<typeof otpSchema>;

interface ClientInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  portalAccountId: string;
}

interface VerifyOTPResponse {
  success: boolean;
  token: string;
  client: ClientInfo;
}

export default function ClientPortalLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<OTPFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  const requestOTPMutation = useMutation({
    mutationFn: async (data: EmailFormValues) => {
      const response = await fetch("/api/client-portal/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to send code");
      }
      return response.json();
    },
    onSuccess: () => {
      setEmail(emailForm.getValues("email"));
      setStep("otp");
      toast({
        title: "Code sent",
        description: "If your email is registered, you'll receive a login code shortly.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send login code. Please try again.",
        variant: "destructive",
      });
    },
  });

  const verifyOTPMutation = useMutation({
    mutationFn: async (data: OTPFormValues) => {
      const response = await fetch("/api/client-portal/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: data.code }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Invalid code");
      }
      return response.json();
    },
    onSuccess: (data: VerifyOTPResponse) => {
      localStorage.setItem("clientPortalToken", data.token);
      localStorage.setItem("clientPortalId", data.client.id);
      localStorage.setItem("clientPortalEmail", data.client.email || "");
      localStorage.setItem("clientPortalName", 
        [data.client.firstName, data.client.lastName].filter(Boolean).join(" ") || "Client"
      );
      toast({
        title: "Welcome!",
        description: "You've successfully logged in.",
      });
      setLocation("/portal/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Invalid code",
        description: error.message || "The code you entered is incorrect or has expired.",
        variant: "destructive",
      });
    },
  });

  const handleEmailSubmit = (data: EmailFormValues) => {
    requestOTPMutation.mutate(data);
  };

  const handleOTPSubmit = (data: OTPFormValues) => {
    verifyOTPMutation.mutate(data);
  };

  const handleBackToEmail = () => {
    setStep("email");
    otpForm.reset();
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <header className="fixed right-4 top-4 z-50">
          <ThemeToggle />
        </header>

        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary">
                <Building2 className="h-6 w-6 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl">Client Portal</CardTitle>
              <CardDescription>
                {step === "email" 
                  ? "Enter your email to access your project updates"
                  : "Enter the 6-digit code sent to your email"
                }
              </CardDescription>
            </CardHeader>

            <CardContent>
              {step === "email" ? (
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
                    <FormField
                      control={emailForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                type="email"
                                placeholder="your@email.com"
                                className="pl-9"
                                {...field}
                                data-testid="input-portal-email"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            We'll send you a one-time login code
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={requestOTPMutation.isPending}
                      data-testid="button-request-code"
                    >
                      {requestOTPMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Continue"
                      )}
                    </Button>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToEmail}
                    className="mb-2"
                    data-testid="button-back-to-email"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Use a different email
                  </Button>

                  <div className="rounded-md bg-muted p-3 text-center text-sm">
                    Code sent to <span className="font-medium">{email}</span>
                  </div>

                  <Form {...otpForm}>
                    <form onSubmit={otpForm.handleSubmit(handleOTPSubmit)} className="space-y-4">
                      <FormField
                        control={otpForm.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem className="flex flex-col items-center">
                            <FormLabel>Verification Code</FormLabel>
                            <FormControl>
                              <InputOTP
                                maxLength={6}
                                value={field.value}
                                onChange={field.onChange}
                                data-testid="input-portal-otp"
                              >
                                <InputOTPGroup>
                                  <InputOTPSlot index={0} />
                                  <InputOTPSlot index={1} />
                                  <InputOTPSlot index={2} />
                                  <InputOTPSlot index={3} />
                                  <InputOTPSlot index={4} />
                                  <InputOTPSlot index={5} />
                                </InputOTPGroup>
                              </InputOTP>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={verifyOTPMutation.isPending}
                        data-testid="button-verify-code"
                      >
                        {verifyOTPMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </Button>

                      <div className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => requestOTPMutation.mutate({ email })}
                          disabled={requestOTPMutation.isPending}
                          data-testid="button-resend-code"
                        >
                          Didn't receive a code? Resend
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ThemeProvider>
  );
}
