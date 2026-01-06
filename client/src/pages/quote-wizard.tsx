import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ArrowLeft, ArrowRight, Check, User, DollarSign, 
  Milestone, FileText, Plus, Trash2, ChevronRight, UserPlus
} from "lucide-react";

const COUNTRIES = [
  { code: "AU", name: "Australia", dialCode: "+61" },
  { code: "NZ", name: "New Zealand", dialCode: "+64" },
  { code: "US", name: "United States", dialCode: "+1" },
  { code: "GB", name: "United Kingdom", dialCode: "+44" },
  { code: "CA", name: "Canada", dialCode: "+1" },
  { code: "SG", name: "Singapore", dialCode: "+65" },
  { code: "HK", name: "Hong Kong", dialCode: "+852" },
  { code: "MY", name: "Malaysia", dialCode: "+60" },
  { code: "PH", name: "Philippines", dialCode: "+63" },
  { code: "IN", name: "India", dialCode: "+91" },
  { code: "ID", name: "Indonesia", dialCode: "+62" },
  { code: "TH", name: "Thailand", dialCode: "+66" },
  { code: "JP", name: "Japan", dialCode: "+81" },
  { code: "KR", name: "South Korea", dialCode: "+82" },
  { code: "CN", name: "China", dialCode: "+86" },
  { code: "DE", name: "Germany", dialCode: "+49" },
  { code: "FR", name: "France", dialCode: "+33" },
  { code: "IT", name: "Italy", dialCode: "+39" },
  { code: "ES", name: "Spain", dialCode: "+34" },
  { code: "NL", name: "Netherlands", dialCode: "+31" },
  { code: "IE", name: "Ireland", dialCode: "+353" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971" },
] as const;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client } from "@shared/schema";

const newClientFormSchema = z.object({
  type: z.enum(["individual", "company"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  country: z.string().default("AU"),
  phone: z.string().optional(),
  mobilePhone: z.string().optional(),
  streetAddress: z.string().optional(),
  streetAddress2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
}).refine((data) => {
  if (data.type === "individual") {
    return data.firstName && data.firstName.length > 0;
  }
  if (data.type === "company") {
    return data.companyName && data.companyName.length > 0;
  }
  return true;
}, {
  message: "Individual clients require a first name. Company clients require a company name.",
  path: ["firstName"],
});

function formatPhoneWithCountryCode(phone: string, countryCode: string): string {
  if (!phone) return "";
  const country = COUNTRIES.find(c => c.code === countryCode);
  const dialCode = country?.dialCode || "+61";
  
  let cleaned = phone.replace(/[^\d]/g, "");
  
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }
  
  if (!phone.startsWith("+")) {
    return `${dialCode} ${cleaned}`;
  }
  
  return phone;
}

type NewClientFormValues = z.infer<typeof newClientFormSchema>;

const depositTypes = [
  { id: "none", label: "No Deposit", description: "Full payment on completion" },
  { id: "percentage", label: "Percentage Deposit", description: "Percentage of total upfront" },
  { id: "fixed", label: "Fixed Deposit", description: "Fixed amount upfront" },
  { id: "milestone", label: "Milestone Payments", description: "Pay as milestones complete" },
] as const;

const lineItemSchema = z.object({
  id: z.string().optional(),
  heading: z.string().min(1, "Heading is required"),
  description: z.string().min(1, "Description is required"),
  richDescription: z.string().optional(),
  quantity: z.coerce.number().min(0.01, "Quantity must be positive"),
  unitPrice: z.coerce.number().min(0, "Unit price must be non-negative"),
});

const milestoneSchema = z.object({
  title: z.string().min(1, "Milestone title is required"),
  description: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

const quoteWizardSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  clientAddress: z.string().min(1, "Address is required"),
  description: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  depositType: z.enum(["none", "percentage", "fixed", "milestone"]).default("none"),
  depositPercentage: z.coerce.number().min(0).max(100).optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  milestoneCount: z.coerce.number().min(1).max(10).default(1),
  milestones: z.array(milestoneSchema),
});

type QuoteWizardValues = z.infer<typeof quoteWizardSchema>;

const STEPS = [
  { id: 1, title: "Select Client", icon: User },
  { id: 2, title: "Payment Structure", icon: DollarSign },
  { id: 3, title: "Milestones", icon: Milestone },
  { id: 4, title: "Line Items", icon: FileText },
  { id: 5, title: "Review", icon: Check },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div 
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    isCompleted 
                      ? "bg-primary border-primary text-primary-foreground" 
                      : isActive 
                        ? "border-primary text-primary" 
                        : "border-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs mt-2 text-center ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                  {step.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          );
        })}
      </div>
      <Progress value={(currentStep / STEPS.length) * 100} className="h-2" />
    </div>
  );
}

export default function QuoteWizard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<QuoteWizardValues>({
    resolver: zodResolver(quoteWizardSchema),
    defaultValues: {
      clientId: "",
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      clientAddress: "",
      description: "",
      validUntil: "",
      notes: "",
      taxRate: 10,
      depositType: "none",
      depositPercentage: 20,
      depositAmount: 0,
      milestoneCount: 1,
      milestones: [
        { 
          title: "Phase 1", 
          description: "", 
          lineItems: [{ heading: "", description: "", richDescription: "", quantity: 1, unitPrice: 0 }] 
        }
      ],
    },
  });

  const { fields: milestoneFields, replace: replaceMilestones } = useFieldArray({
    control: form.control,
    name: "milestones",
  });

  const handleClientSelect = (clientId: string) => {
    const client = clients?.find(c => c.id === clientId);
    if (client) {
      const fullName = `${client.firstName} ${client.lastName}`.trim();
      const fullAddress = [client.streetAddress, client.streetAddress2, client.city, client.state, client.postalCode]
        .filter(Boolean).join(", ");
      form.setValue("clientId", clientId);
      form.setValue("clientName", fullName);
      form.setValue("clientEmail", client.email || "");
      form.setValue("clientPhone", client.phone || client.mobilePhone || "");
      form.setValue("clientAddress", fullAddress);
    }
  };

  const handleMilestoneCountChange = (count: number) => {
    const currentMilestones = form.getValues("milestones");
    const newMilestones = [];
    
    for (let i = 0; i < count; i++) {
      if (i < currentMilestones.length) {
        newMilestones.push(currentMilestones[i]);
      } else {
        newMilestones.push({
          title: `Phase ${i + 1}`,
          description: "",
          lineItems: [{ heading: "", description: "", richDescription: "", quantity: 1, unitPrice: 0 }],
        });
      }
    }
    
    form.setValue("milestoneCount", count);
    replaceMilestones(newMilestones);
  };

  const validateStep = async (step: number): Promise<boolean> => {
    let fields: (keyof QuoteWizardValues)[] = [];
    
    switch (step) {
      case 1:
        fields = ["clientId", "clientName", "clientAddress"];
        break;
      case 2:
        fields = ["depositType"];
        break;
      case 3:
        fields = ["milestoneCount"];
        break;
      case 4:
        fields = ["milestones"];
        break;
    }
    
    const result = await form.trigger(fields);
    return result;
  };

  const nextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: QuoteWizardValues) => {
      const allLineItems = data.milestones.flatMap(m => m.lineItems);
      const subtotal = allLineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const taxAmount = subtotal * ((data.taxRate || 0) / 100);
      const total = subtotal + taxAmount;

      const response = await apiRequest("POST", "/api/quotes", {
        clientId: data.clientId,
        clientName: data.clientName,
        clientEmail: data.clientEmail || null,
        clientPhone: data.clientPhone || null,
        clientAddress: data.clientAddress,
        description: data.description || null,
        validUntil: data.validUntil || null,
        notes: data.notes || null,
        taxRate: (data.taxRate || 10).toString(),
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
      });
      const newQuote = await response.json();

      for (let milestoneIndex = 0; milestoneIndex < data.milestones.length; milestoneIndex++) {
        const milestone = data.milestones[milestoneIndex];
        
        const milestoneResponse = await apiRequest("POST", `/api/quotes/${newQuote.id}/milestones`, {
          title: milestone.title,
          description: milestone.description || null,
          sequence: milestoneIndex + 1,
        });
        const newMilestone = await milestoneResponse.json();

        for (let itemIndex = 0; itemIndex < milestone.lineItems.length; itemIndex++) {
          const item = milestone.lineItems[itemIndex];
          if (item.description.trim()) {
            await apiRequest("POST", `/api/quotes/${newQuote.id}/line-items`, {
              quoteMilestoneId: newMilestone.id,
              heading: item.heading || null,
              description: item.description,
              richDescription: item.richDescription || null,
              quantity: item.quantity.toString(),
              unitPrice: item.unitPrice.toFixed(2),
              amount: (item.quantity * item.unitPrice).toFixed(2),
              sortOrder: itemIndex,
            });
          }
        }
      }

      if (data.depositType !== "none") {
        const schedules = [];
        
        if (data.depositType === "percentage") {
          schedules.push({
            type: "deposit",
            name: "Deposit",
            isPercentage: true,
            percentage: data.depositPercentage?.toString() || "20",
            calculatedAmount: ((total * (data.depositPercentage || 20)) / 100).toFixed(2),
            sortOrder: 0,
          });
          schedules.push({
            type: "final",
            name: "Final Payment",
            isPercentage: true,
            percentage: (100 - (data.depositPercentage || 20)).toString(),
            calculatedAmount: (total - (total * (data.depositPercentage || 20)) / 100).toFixed(2),
            sortOrder: 1,
          });
        } else if (data.depositType === "fixed") {
          schedules.push({
            type: "deposit",
            name: "Deposit",
            isPercentage: false,
            fixedAmount: data.depositAmount?.toString() || "0",
            calculatedAmount: data.depositAmount?.toFixed(2) || "0",
            sortOrder: 0,
          });
          schedules.push({
            type: "final",
            name: "Final Payment",
            isPercentage: false,
            fixedAmount: (total - (data.depositAmount || 0)).toFixed(2),
            calculatedAmount: (total - (data.depositAmount || 0)).toFixed(2),
            sortOrder: 1,
          });
        } else if (data.depositType === "milestone") {
          for (let i = 0; i < data.milestones.length; i++) {
            const milestoneTotal = data.milestones[i].lineItems.reduce(
              (sum, item) => sum + item.quantity * item.unitPrice, 0
            );
            schedules.push({
              type: i === 0 ? "deposit" : i === data.milestones.length - 1 ? "final" : "progress",
              name: data.milestones[i].title,
              isPercentage: false,
              fixedAmount: milestoneTotal.toFixed(2),
              calculatedAmount: milestoneTotal.toFixed(2),
              milestoneDescription: data.milestones[i].title,
              sortOrder: i,
            });
          }
        }

        for (const schedule of schedules) {
          await apiRequest("POST", `/api/quotes/${newQuote.id}/payment-schedules`, schedule);
        }
      }

      return newQuote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote created successfully" });
      navigate("/quotes");
    },
    onError: () => {
      toast({ title: "Failed to create quote", variant: "destructive" });
    },
  });

  const onSubmit = (data: QuoteWizardValues) => {
    createMutation.mutate(data);
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculateTotals = () => {
    const milestones = form.watch("milestones");
    const taxRate = form.watch("taxRate") || 10;
    const subtotal = milestones.flatMap(m => m.lineItems).reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0
    );
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold">Create Quote</h1>
      </div>

      <div className="max-w-4xl">
        <StepIndicator currentStep={currentStep} />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {currentStep === 1 && (
              <Step1ClientSelector 
                form={form} 
                clients={clients || []} 
                clientsLoading={clientsLoading}
                onClientSelect={handleClientSelect}
              />
            )}

            {currentStep === 2 && (
              <Step2PaymentStructure form={form} calculateTotals={calculateTotals} />
            )}

            {currentStep === 3 && (
              <Step3Milestones 
                form={form} 
                milestoneFields={milestoneFields}
                onMilestoneCountChange={handleMilestoneCountChange}
              />
            )}

            {currentStep === 4 && (
              <Step4LineItems form={form} />
            )}

            {currentStep === 5 && (
              <Step5Review form={form} calculateTotals={calculateTotals} formatCurrency={formatCurrency} />
            )}

            <div className="flex justify-between mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                data-testid="button-prev-step"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {currentStep < STEPS.length ? (
                <Button type="button" onClick={nextStep} data-testid="button-next-step">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  data-testid="button-create-quote"
                >
                  {createMutation.isPending ? "Creating..." : "Create Quote"}
                  <Check className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

function Step1ClientSelector({ 
  form, 
  clients, 
  clientsLoading,
  onClientSelect 
}: { 
  form: ReturnType<typeof useForm<QuoteWizardValues>>;
  clients: Client[];
  clientsLoading: boolean;
  onClientSelect: (clientId: string) => void;
}) {
  const { toast } = useToast();
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false);
  const selectedClientId = form.watch("clientId");
  const selectedClient = clients.find(c => c.id === selectedClientId);

  const newClientForm = useForm<NewClientFormValues>({
    resolver: zodResolver(newClientFormSchema),
    defaultValues: {
      type: "individual",
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      country: "AU",
      phone: "",
      mobilePhone: "",
      streetAddress: "",
      streetAddress2: "",
      city: "",
      state: "",
      postalCode: "",
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: NewClientFormValues) => {
      const response = await apiRequest("POST", "/api/clients", data);
      return response.json();
    },
    onSuccess: (newClient: Client) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
      const fullName = `${newClient.firstName || ""} ${newClient.lastName || ""}`.trim() || newClient.companyName || "";
      const fullAddress = [newClient.streetAddress, newClient.streetAddress2, newClient.city, newClient.state, newClient.postalCode]
        .filter(Boolean).join(", ");
      
      form.setValue("clientId", newClient.id);
      form.setValue("clientName", fullName);
      form.setValue("clientEmail", newClient.email || "");
      form.setValue("clientPhone", newClient.phone || newClient.mobilePhone || "");
      form.setValue("clientAddress", fullAddress);
      
      toast({
        title: "Client created",
        description: "The new client has been added and selected.",
      });
      setIsNewClientDialogOpen(false);
      newClientForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create client",
        variant: "destructive",
      });
    },
  });

  const handleCreateClient = (data: NewClientFormValues) => {
    const formattedData = {
      ...data,
      phone: formatPhoneWithCountryCode(data.phone || "", data.country),
      mobilePhone: formatPhoneWithCountryCode(data.mobilePhone || "", data.country),
    };
    createClientMutation.mutate(formattedData);
  };

  const newClientType = newClientForm.watch("type");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Select Client</h2>
        <p className="text-muted-foreground">Choose an existing client or create a new one</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <div className="flex gap-2">
                    <Select 
                      value={field.value} 
                      onValueChange={(value) => {
                        field.onChange(value);
                        onClientSelect(value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-client" className="flex-1">
                          <SelectValue placeholder={clientsLoading ? "Loading clients..." : "Select a client"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.firstName} {client.lastName} - {client.email || client.phone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => setIsNewClientDialogOpen(true)}
                      data-testid="button-new-client"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      New Client
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedClient && (
              <div className="p-4 rounded-md bg-muted/50 space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium" data-testid="text-client-name">
                    {selectedClient.firstName} {selectedClient.lastName}
                  </span>
                </div>
                {selectedClient.email && (
                  <div className="text-sm text-muted-foreground">{selectedClient.email}</div>
                )}
                {(selectedClient.phone || selectedClient.mobilePhone) && (
                  <div className="text-sm text-muted-foreground">
                    {selectedClient.phone || selectedClient.mobilePhone}
                  </div>
                )}
                {selectedClient.streetAddress && (
                  <div className="text-sm text-muted-foreground">
                    {[selectedClient.streetAddress, selectedClient.city, selectedClient.state, selectedClient.postalCode]
                      .filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Description</FormLabel>
                <FormControl>
                  <Textarea 
                    {...field} 
                    placeholder="Brief description of the work to be done"
                    className="min-h-[100px]"
                    data-testid="input-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Dialog open={isNewClientDialogOpen} onOpenChange={setIsNewClientDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
            <DialogDescription>
              Add a new client to use for this quote
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={newClientForm.handleSubmit(handleCreateClient)} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Client Type</label>
                <Select
                  value={newClientType}
                  onValueChange={(value: "individual" | "company") => {
                    newClientForm.setValue("type", value);
                  }}
                >
                  <SelectTrigger data-testid="select-client-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newClientType === "company" && (
                <div>
                  <label className="text-sm font-medium">Company Name *</label>
                  <Input
                    {...newClientForm.register("companyName")}
                    placeholder="Company name"
                    data-testid="input-company-name"
                  />
                  {newClientForm.formState.errors.companyName && (
                    <p className="text-sm text-destructive mt-1">
                      {newClientForm.formState.errors.companyName.message}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">
                    First Name {newClientType === "individual" ? "*" : ""}
                  </label>
                  <Input
                    {...newClientForm.register("firstName")}
                    placeholder="First name"
                    data-testid="input-first-name"
                  />
                  {newClientForm.formState.errors.firstName && (
                    <p className="text-sm text-destructive mt-1">
                      {newClientForm.formState.errors.firstName.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <Input
                    {...newClientForm.register("lastName")}
                    placeholder="Last name"
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  {...newClientForm.register("email")}
                  type="email"
                  placeholder="email@example.com"
                  data-testid="input-email"
                />
                {newClientForm.formState.errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {newClientForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Country</label>
                <Select
                  value={newClientForm.watch("country")}
                  onValueChange={(value) => newClientForm.setValue("country", value)}
                >
                  <SelectTrigger data-testid="select-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name} ({country.dialCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 border rounded-md bg-muted text-muted-foreground text-sm min-w-[60px] justify-center">
                      {COUNTRIES.find(c => c.code === newClientForm.watch("country"))?.dialCode || "+61"}
                    </div>
                    <Input
                      {...newClientForm.register("phone")}
                      placeholder="Phone number"
                      data-testid="input-phone"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Mobile</label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 border rounded-md bg-muted text-muted-foreground text-sm min-w-[60px] justify-center">
                      {COUNTRIES.find(c => c.code === newClientForm.watch("country"))?.dialCode || "+61"}
                    </div>
                    <Input
                      {...newClientForm.register("mobilePhone")}
                      placeholder="Mobile number"
                      data-testid="input-mobile"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Street Address</label>
                <Input
                  {...newClientForm.register("streetAddress")}
                  placeholder="Street address"
                  data-testid="input-street-address"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Address Line 2</label>
                <Input
                  {...newClientForm.register("streetAddress2")}
                  placeholder="Apartment, suite, etc."
                  data-testid="input-street-address-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">City</label>
                  <Input
                    {...newClientForm.register("city")}
                    placeholder="City"
                    data-testid="input-city"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">State</label>
                  <Input
                    {...newClientForm.register("state")}
                    placeholder="State"
                    data-testid="input-state"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Postal Code</label>
                  <Input
                    {...newClientForm.register("postalCode")}
                    placeholder="Postal code"
                    data-testid="input-postal-code"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsNewClientDialogOpen(false);
                  newClientForm.reset();
                }}
                data-testid="button-cancel-new-client"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createClientMutation.isPending}
                data-testid="button-save-new-client"
              >
                {createClientMutation.isPending ? "Creating..." : "Create Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Step2PaymentStructure({ 
  form,
  calculateTotals
}: { 
  form: ReturnType<typeof useForm<QuoteWizardValues>>;
  calculateTotals: () => { subtotal: number; taxAmount: number; total: number };
}) {
  const depositType = form.watch("depositType");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Payment Structure</h2>
        <p className="text-muted-foreground">Choose how the client will pay for this work</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <FormField
            control={form.control}
            name="depositType"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="grid gap-4"
                  >
                    {depositTypes.map((type) => (
                      <label
                        key={type.id}
                        className={`flex items-start gap-4 p-4 rounded-md border cursor-pointer transition-colors ${
                          field.value === type.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                        data-testid={`radio-deposit-${type.id}`}
                      >
                        <RadioGroupItem value={type.id} className="mt-1" />
                        <div className="flex-1">
                          <div className="font-medium">{type.label}</div>
                          <div className="text-sm text-muted-foreground">{type.description}</div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {depositType === "percentage" && (
            <div className="mt-6 p-4 rounded-md bg-muted/50">
              <FormField
                control={form.control}
                name="depositPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deposit Percentage</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          max={100}
                          className="w-24"
                          data-testid="input-deposit-percentage"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      The remaining {100 - (field.value || 0)}% will be due on completion
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {depositType === "fixed" && (
            <div className="mt-6 p-4 rounded-md bg-muted/50">
              <FormField
                control={form.control}
                name="depositAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deposit Amount</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-32"
                          data-testid="input-deposit-amount"
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Fixed deposit amount to be paid upfront
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {depositType === "milestone" && (
            <div className="mt-6 p-4 rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Payment will be split across milestones. Configure milestones in the next step.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <FormField
            control={form.control}
            name="taxRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax Rate (GST)</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <Input
                      {...field}
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      className="w-24"
                      data-testid="input-tax-rate"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="validUntil"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quote Valid Until</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-valid-until" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Step3Milestones({ 
  form,
  milestoneFields,
  onMilestoneCountChange
}: { 
  form: ReturnType<typeof useForm<QuoteWizardValues>>;
  milestoneFields: { id: string }[];
  onMilestoneCountChange: (count: number) => void;
}) {
  const milestoneCount = form.watch("milestoneCount");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Define Milestones</h2>
        <p className="text-muted-foreground">Break the project into phases or milestones</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <FormField
            control={form.control}
            name="milestoneCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Milestones</FormLabel>
                <Select 
                  value={field.value?.toString()} 
                  onValueChange={(value) => onMilestoneCountChange(parseInt(value))}
                >
                  <FormControl>
                    <SelectTrigger className="w-40" data-testid="select-milestone-count">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? "Milestone" : "Milestones"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Each milestone will have its own set of line items
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {milestoneFields.map((field, index) => (
          <Card key={field.id}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Phase {index + 1}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name={`milestones.${index}.title`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Milestone Title</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder={`e.g., Phase ${index + 1} - Preparation`}
                        data-testid={`input-milestone-title-${index}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`milestones.${index}.description`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Brief description of this milestone"
                        data-testid={`input-milestone-desc-${index}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Step4LineItems({ form }: { form: ReturnType<typeof useForm<QuoteWizardValues>> }) {
  const milestones = form.watch("milestones");
  const [activeMilestone, setActiveMilestone] = useState(0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Add Line Items</h2>
        <p className="text-muted-foreground">Add detailed line items for each milestone</p>
      </div>

      {milestones.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {milestones.map((milestone, index) => (
            <Button
              key={index}
              type="button"
              variant={activeMilestone === index ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveMilestone(index)}
              data-testid={`button-milestone-tab-${index}`}
            >
              {milestone.title || `Phase ${index + 1}`}
            </Button>
          ))}
        </div>
      )}

      <MilestoneLineItems 
        form={form} 
        milestoneIndex={activeMilestone}
        milestoneTitle={milestones[activeMilestone]?.title || `Phase ${activeMilestone + 1}`}
      />
    </div>
  );
}

function MilestoneLineItems({ 
  form, 
  milestoneIndex,
  milestoneTitle
}: { 
  form: ReturnType<typeof useForm<QuoteWizardValues>>;
  milestoneIndex: number;
  milestoneTitle: string;
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `milestones.${milestoneIndex}.lineItems`,
  });

  const lineItems = form.watch(`milestones.${milestoneIndex}.lineItems`);
  const milestoneTotal = lineItems.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{milestoneTitle}</CardTitle>
            <CardDescription>Add line items with detailed descriptions</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Milestone Total</div>
            <div className="text-lg font-semibold">
              ${milestoneTotal.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {fields.map((field, itemIndex) => (
          <div key={field.id} className="p-4 border rounded-md space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Badge variant="outline">Item {itemIndex + 1}</Badge>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(itemIndex)}
                  data-testid={`button-remove-item-${milestoneIndex}-${itemIndex}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <FormField
              control={form.control}
              name={`milestones.${milestoneIndex}.lineItems.${itemIndex}.heading`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heading</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="e.g., Kitchen Sink Installation"
                      data-testid={`input-item-heading-${milestoneIndex}-${itemIndex}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`milestones.${milestoneIndex}.lineItems.${itemIndex}.description`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Description</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Brief description of the work"
                      data-testid={`input-item-desc-${milestoneIndex}-${itemIndex}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`milestones.${milestoneIndex}.lineItems.${itemIndex}.richDescription`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detailed Specifications (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Detailed scope of work, materials, specifications..."
                      className="min-h-[100px]"
                      data-testid={`input-item-rich-${milestoneIndex}-${itemIndex}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name={`milestones.${milestoneIndex}.lineItems.${itemIndex}.quantity`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="number"
                        min={0.01}
                        step={0.01}
                        data-testid={`input-item-qty-${milestoneIndex}-${itemIndex}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`milestones.${milestoneIndex}.lineItems.${itemIndex}.unitPrice`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate ($)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="number"
                        min={0}
                        step={0.01}
                        data-testid={`input-item-rate-${milestoneIndex}-${itemIndex}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>Amount</FormLabel>
                <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                  ${((lineItems[itemIndex]?.quantity || 0) * (lineItems[itemIndex]?.unitPrice || 0)).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() => append({ heading: "", description: "", richDescription: "", quantity: 1, unitPrice: 0 })}
          className="w-full"
          data-testid={`button-add-item-${milestoneIndex}`}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Line Item
        </Button>
      </CardContent>
    </Card>
  );
}

function Step5Review({ 
  form, 
  calculateTotals,
  formatCurrency
}: { 
  form: ReturnType<typeof useForm<QuoteWizardValues>>;
  calculateTotals: () => { subtotal: number; taxAmount: number; total: number };
  formatCurrency: (value: number) => string;
}) {
  const data = form.watch();
  const { subtotal, taxAmount, total } = calculateTotals();
  const depositType = data.depositType;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Review Quote</h2>
        <p className="text-muted-foreground">Review all details before creating the quote</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Client</div>
              <div className="font-medium">{data.clientName}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Email</div>
              <div className="font-medium">{data.clientEmail || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Phone</div>
              <div className="font-medium">{data.clientPhone || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Address</div>
              <div className="font-medium">{data.clientAddress}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Job Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Valid Until</div>
              <div className="font-medium">{data.validUntil || "Not specified"}</div>
            </div>
            <div className="col-span-2">
              <div className="text-muted-foreground">Description</div>
              <div className="font-medium">{data.description || "-"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Milestones & Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.milestones.map((milestone, mIndex) => {
            const milestoneTotal = milestone.lineItems.reduce(
              (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0
            );
            return (
              <div key={mIndex} className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Phase {mIndex + 1}</Badge>
                    <span className="font-medium">{milestone.title}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(milestoneTotal)}</span>
                </div>
                <div className="ml-4 space-y-2">
                  {milestone.lineItems.map((item, iIndex) => (
                    <div key={iIndex} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{item.heading}</span>
                        <span className="text-muted-foreground"> - {item.description}</span>
                        <span className="text-muted-foreground ml-2">
                          ({item.quantity} x {formatCurrency(item.unitPrice || 0)})
                        </span>
                      </div>
                      <span>{formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST ({data.taxRate}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-3">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>

            {depositType !== "none" && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="text-sm font-medium">Payment Structure</div>
                {depositType === "percentage" && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Deposit ({data.depositPercentage}%)</span>
                      <span>{formatCurrency(total * (data.depositPercentage || 20) / 100)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Final Payment ({100 - (data.depositPercentage || 20)}%)</span>
                      <span>{formatCurrency(total - (total * (data.depositPercentage || 20) / 100))}</span>
                    </div>
                  </>
                )}
                {depositType === "fixed" && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Deposit</span>
                      <span>{formatCurrency(data.depositAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Final Payment</span>
                      <span>{formatCurrency(total - (data.depositAmount || 0))}</span>
                    </div>
                  </>
                )}
                {depositType === "milestone" && (
                  <>
                    {data.milestones.map((milestone, index) => {
                      const milestoneTotal = milestone.lineItems.reduce(
                        (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0
                      );
                      return (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{milestone.title}</span>
                          <span>{formatCurrency(milestoneTotal)}</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Notes</FormLabel>
                <FormControl>
                  <Textarea 
                    {...field} 
                    placeholder="Any additional notes or terms for the client..."
                    className="min-h-[100px]"
                    data-testid="input-notes"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
