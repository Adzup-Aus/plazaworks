import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ArrowLeft, ArrowRight, Check, User, DollarSign, 
  FileText, Plus, Trash2, UserPlus
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
] as const;

const lineItemSchema = z.object({
  id: z.string().optional(),
  heading: z.string().min(1, "Heading is required"),
  description: z.string().min(1, "Description is required"),
  richDescription: z.string().optional(),
  quantity: z.coerce.number().min(0.01, "Quantity must be positive"),
  unitPrice: z.coerce.number().min(0, "Unit price must be non-negative"),
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
  depositType: z.enum(["none", "percentage", "fixed"]).default("none"),
  depositPercentage: z.coerce.number().min(0).max(100).optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

type QuoteWizardValues = z.infer<typeof quoteWizardSchema>;

const STEPS = [
  { id: 1, title: "Select Client", icon: User },
  { id: 2, title: "Payment Structure", icon: DollarSign },
  { id: 3, title: "Line Items", icon: FileText },
  { id: 4, title: "Review", icon: Check },
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
      lineItems: [
        { heading: "", description: "", richDescription: "", quantity: 1, unitPrice: 0 }
      ],
    },
  });

  const { fields: lineItemFields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
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
        fields = ["lineItems"];
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
      const subtotal = data.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const taxAmount = subtotal * ((data.taxRate || 0) / 100);
      const total = subtotal + taxAmount;

      const response = await apiRequest("POST", "/api/quotes", {
        clientId: data.clientId,
        clientName: data.clientName,
        clientEmail: data.clientEmail || null,
        clientPhone: data.clientPhone || null,
        clientAddress: data.clientAddress,
        jobType: "general",
        description: data.description || null,
        validUntil: data.validUntil || null,
        notes: data.notes || null,
        taxRate: (data.taxRate || 10).toString(),
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
      });
      const newQuote = await response.json();

      const milestoneResponse = await apiRequest("POST", `/api/quotes/${newQuote.id}/milestones`, {
        title: "Work Items",
        description: null,
        sequence: 1,
      });
      const milestone = await milestoneResponse.json();

      for (let itemIndex = 0; itemIndex < data.lineItems.length; itemIndex++) {
        const item = data.lineItems[itemIndex];
        if (item.description.trim()) {
          await apiRequest("POST", `/api/quotes/${newQuote.id}/line-items`, {
            quoteMilestoneId: milestone.id,
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
    const lineItems = form.watch("lineItems");
    const taxRate = form.watch("taxRate") || 10;
    const subtotal = lineItems.reduce(
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
              <Step2PaymentStructure form={form} />
            )}

            {currentStep === 3 && (
              <Step3LineItems 
                form={form} 
                lineItemFields={lineItemFields}
                onAppend={() => append({ heading: "", description: "", richDescription: "", quantity: 1, unitPrice: 0 })}
                onRemove={remove}
              />
            )}

            {currentStep === 4 && (
              <Step4Review form={form} calculateTotals={calculateTotals} formatCurrency={formatCurrency} />
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
      
      const fullName = `${newClient.firstName || ""} ${newClient.lastName || ""}`.trim() || newClient.company || "";
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
  const selectedCountry = newClientForm.watch("country");
  const dialCode = COUNTRIES.find(c => c.code === selectedCountry)?.dialCode || "+61";

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
                    <Select value={field.value} onValueChange={(value) => {
                      field.onChange(value);
                      onClientSelect(value);
                    }}>
                      <FormControl>
                        <SelectTrigger className="flex-1" data-testid="select-client">
                          <SelectValue placeholder="Select a client..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientsLoading ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : clients.length === 0 ? (
                          <SelectItem value="none" disabled>No clients found</SelectItem>
                        ) : (
                          clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.firstName} {client.lastName}
                              {client.company && ` (${client.company})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsNewClientDialogOpen(true)}
                      data-testid="button-new-client"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      New
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedClient && (
              <div className="p-4 bg-muted/50 rounded-md space-y-2">
                <div className="font-medium">{selectedClient.firstName} {selectedClient.lastName}</div>
                {selectedClient.email && <div className="text-sm text-muted-foreground">{selectedClient.email}</div>}
                {(selectedClient.phone || selectedClient.mobilePhone) && (
                  <div className="text-sm text-muted-foreground">{selectedClient.phone || selectedClient.mobilePhone}</div>
                )}
                {selectedClient.streetAddress && (
                  <div className="text-sm text-muted-foreground">
                    {[selectedClient.streetAddress, selectedClient.city, selectedClient.state, selectedClient.postalCode].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="clientAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Address</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter job site address" data-testid="input-job-address" />
                  </FormControl>
                  <FormDescription>The address where the work will be performed</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Brief description of the work..." data-testid="input-job-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={isNewClientDialogOpen} onOpenChange={setIsNewClientDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
            <DialogDescription>Add a new client to your database</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={newClientForm.handleSubmit(handleCreateClient)} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Client Type</label>
                <RadioGroup
                  value={newClientType}
                  onValueChange={(value) => newClientForm.setValue("type", value as "individual" | "company")}
                  className="flex gap-4 mt-2"
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="individual" />
                    <span>Individual</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="company" />
                    <span>Company</span>
                  </label>
                </RadioGroup>
              </div>

              {newClientType === "individual" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">First Name *</label>
                    <Input
                      {...newClientForm.register("firstName")}
                      placeholder="First name"
                      data-testid="input-new-first-name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Name</label>
                    <Input
                      {...newClientForm.register("lastName")}
                      placeholder="Last name"
                      data-testid="input-new-last-name"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium">Company Name *</label>
                  <Input
                    {...newClientForm.register("companyName")}
                    placeholder="Company name"
                    data-testid="input-new-company-name"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  {...newClientForm.register("email")}
                  type="email"
                  placeholder="email@example.com"
                  data-testid="input-new-email"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Country</label>
                <Select
                  value={selectedCountry}
                  onValueChange={(value) => newClientForm.setValue("country", value)}
                >
                  <SelectTrigger data-testid="select-new-country">
                    <SelectValue />
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
                  <div className="flex">
                    <div className="flex items-center justify-center px-3 bg-muted border border-r-0 rounded-l-md text-sm text-muted-foreground select-none min-w-[60px]">
                      {dialCode}
                    </div>
                    <Input
                      {...newClientForm.register("phone")}
                      placeholder="Phone number"
                      className="rounded-l-none"
                      data-testid="input-new-phone"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Mobile</label>
                  <div className="flex">
                    <div className="flex items-center justify-center px-3 bg-muted border border-r-0 rounded-l-md text-sm text-muted-foreground select-none min-w-[60px]">
                      {dialCode}
                    </div>
                    <Input
                      {...newClientForm.register("mobilePhone")}
                      placeholder="Mobile number"
                      className="rounded-l-none"
                      data-testid="input-new-mobile"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Street Address</label>
                <Input
                  {...newClientForm.register("streetAddress")}
                  placeholder="Street address"
                  data-testid="input-new-street"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">City</label>
                  <Input
                    {...newClientForm.register("city")}
                    placeholder="City"
                    data-testid="input-new-city"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">State</label>
                  <Input
                    {...newClientForm.register("state")}
                    placeholder="State"
                    data-testid="input-new-state"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Postal Code</label>
                  <Input
                    {...newClientForm.register("postalCode")}
                    placeholder="Postal code"
                    data-testid="input-new-postal"
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
  form
}: { 
  form: ReturnType<typeof useForm<QuoteWizardValues>>;
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

function Step3LineItems({ 
  form,
  lineItemFields,
  onAppend,
  onRemove
}: { 
  form: ReturnType<typeof useForm<QuoteWizardValues>>;
  lineItemFields: { id: string }[];
  onAppend: () => void;
  onRemove: (index: number) => void;
}) {
  const lineItems = form.watch("lineItems");
  const total = lineItems.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Add Line Items</h2>
        <p className="text-muted-foreground">Add detailed line items for the quote</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Work Items</CardTitle>
              <CardDescription>Add line items with detailed descriptions</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total (excl. tax)</div>
              <div className="text-lg font-semibold">
                ${total.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {lineItemFields.map((field, itemIndex) => (
            <div key={field.id} className="p-4 border rounded-md space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Badge variant="outline">Item {itemIndex + 1}</Badge>
                {lineItemFields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(itemIndex)}
                    data-testid={`button-remove-item-${itemIndex}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <FormField
                control={form.control}
                name={`lineItems.${itemIndex}.heading`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heading</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., Kitchen Sink Installation"
                        data-testid={`input-item-heading-${itemIndex}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`lineItems.${itemIndex}.description`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Description</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Brief description of the work"
                        data-testid={`input-item-desc-${itemIndex}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`lineItems.${itemIndex}.richDescription`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detailed Specifications (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Detailed scope of work, materials, specifications..."
                        className="min-h-[100px]"
                        data-testid={`input-item-rich-${itemIndex}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name={`lineItems.${itemIndex}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          type="number"
                          min={0.01}
                          step={0.01}
                          data-testid={`input-item-qty-${itemIndex}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`lineItems.${itemIndex}.unitPrice`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate ($)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          type="number"
                          min={0}
                          step={0.01}
                          data-testid={`input-item-rate-${itemIndex}`}
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
            onClick={onAppend}
            className="w-full"
            data-testid="button-add-item"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Line Item
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Step4Review({ 
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
          <CardTitle className="text-lg">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.lineItems.map((item, iIndex) => (
            <div key={iIndex} className="flex items-center justify-between text-sm py-2 border-b last:border-b-0">
              <div>
                <span className="font-medium">{item.heading}</span>
                <span className="text-muted-foreground"> - {item.description}</span>
                <span className="text-muted-foreground ml-2">
                  ({item.quantity} x {formatCurrency(item.unitPrice || 0)})
                </span>
              </div>
              <span className="font-medium">{formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}</span>
            </div>
          ))}
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
