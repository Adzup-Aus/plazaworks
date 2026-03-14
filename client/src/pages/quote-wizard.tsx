import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  ArrowLeft, ArrowRight, Check, User, DollarSign,
  FileText, Plus, Trash2, UserPlus, CalendarIcon, ListOrdered,
  ChevronDown, Send, CheckCircle
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
import { RichTextEditor } from "@/components/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, TermsTemplate } from "@shared/schema";

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

const milestoneSchema = z.object({
  id: z.string().optional(),
  richDescription: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be 0 or greater"),
});

const customSectionSchema = z.object({
  id: z.string().optional(),
  content: z.string().optional(),
});

const quoteWizardSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  clientAddress: z.string().min(1, "Address is required"),
  description: z.string().optional(),
  validUntil: z.date().optional(),
  notes: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  isPriceInclusive: z.boolean().default(false),
  depositType: z.enum(["none", "percentage", "fixed"]).default("none"),
  depositPercentage: z.coerce.number().min(0).max(100).optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  depositBalanceStrategy: z.enum(["on_completion", "milestones"]).default("on_completion"),
  useSinglePrice: z.boolean().default(true),
  singleTotalPrice: z.coerce.number().min(0).optional(),
  milestones: z.array(milestoneSchema).min(1, "At least one milestone is required"),
  customSections: z.array(customSectionSchema).default([]),
  termsOfTradeTemplateId: z.string().optional(),
  termsOfTradeContent: z.string().optional(),
}).refine((data) => {
  if (!data.useSinglePrice) {
    return data.milestones.every(m => m.price !== undefined && m.price > 0);
  }
  return true;
}, {
  message: "Each milestone must have a price when not using single pricing",
  path: ["milestones"],
});

type QuoteWizardValues = z.infer<typeof quoteWizardSchema>;

const STEPS = [
  { id: 1, title: "Select Client", icon: User },
  { id: 2, title: "Payment Structure", icon: DollarSign },
  { id: 3, title: "Milestones", icon: ListOrdered },
  { id: 4, title: "Custom Sections", icon: FileText },
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
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${isCompleted
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
  const submissionModeRef = useRef<"draft" | "send" | "mark_sent">("draft");

  const { data: clientsData, isLoading: clientsLoading } = useQuery<{
    items: Client[];
    total: number;
    page: number;
    limit: number;
    nextPageUrl: string | null;
  }>({
    queryKey: ["/api/clients"],
  });
  const clients = clientsData?.items ?? [];

  const { data: termsTemplates } = useQuery<TermsTemplate[]>({
    queryKey: ["/api/terms-templates"],
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
      validUntil: undefined,
      notes: "",
      taxRate: 10,
      isPriceInclusive: false,
      depositType: "none",
      depositPercentage: 20,
      depositAmount: 0,
      depositBalanceStrategy: "on_completion",
      useSinglePrice: true,
      singleTotalPrice: 0,
      milestones: [
        { richDescription: "", price: 0 }
      ],
      customSections: [],
      termsOfTradeTemplateId: "",
      termsOfTradeContent: "",
    },
  });

  const { fields: milestoneFields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "milestones",
  });

  const {
    fields: customSectionFields,
    append: appendSection,
    remove: removeSection
  } = useFieldArray({
    control: form.control,
    name: "customSections",
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
        fields = ["milestones"];
        break;
      case 4:
        fields = ["customSections"];
        break;
    }

    const result = await form.trigger(fields);
    return result;
  };

  const nextStep = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < STEPS.length) {
      requestAnimationFrame(() => {
        setCurrentStep(currentStep + 1);
      });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleMilestoneCountChange = (count: number) => {
    const currentMilestones = form.getValues("milestones");
    const newMilestones = [];

    for (let i = 0; i < count; i++) {
      if (currentMilestones[i]) {
        newMilestones.push(currentMilestones[i]);
      } else {
        newMilestones.push({ heading: "", richDescription: "", price: 0 });
      }
    }

    replace(newMilestones);
  };

  const createMutation = useMutation({
    mutationFn: async (data: QuoteWizardValues) => {
      const useSinglePrice = data.useSinglePrice;
      const isPriceInclusive = data.isPriceInclusive;
      const taxRate = data.taxRate || 10;

      const enteredPrice = useSinglePrice
        ? (data.singleTotalPrice || 0)
        : data.milestones.reduce((sum, m) => sum + (m.price || 0), 0);

      let subtotal: number;
      let taxAmount: number;
      let total: number;

      if (isPriceInclusive) {
        total = enteredPrice;
        subtotal = total / (1 + taxRate / 100);
        taxAmount = total - subtotal;
      } else {
        subtotal = enteredPrice;
        taxAmount = subtotal * (taxRate / 100);
        total = subtotal + taxAmount;
      }

      const milestones = data.milestones.map((m, index) => {
        const title = `Milestone ${index + 1}`;
        const itemPrice = useSinglePrice
          ? (index === data.milestones.length - 1 ? (data.singleTotalPrice || 0) : 0)
          : (m.price || 0);
        return {
          title,
          description: m.richDescription || null,
          sequence: index + 1,
          lineItem: {
            heading: title,
            description: title,
            richDescription: m.richDescription || null,
            quantity: "1",
            unitPrice: itemPrice.toFixed(2),
            amount: itemPrice.toFixed(2),
            sortOrder: 0,
          },
        };
      });

      let paymentSchedules: Array<{ type: string; name: string; isPercentage?: boolean; percentage?: string; fixedAmount?: string; calculatedAmount?: string; sortOrder: number }> = [];
      if (data.depositType !== "none") {
        if (data.depositType === "percentage") {
          const depositAmount = (total * (data.depositPercentage || 20)) / 100;
          const remainingAmount = total - depositAmount;
          paymentSchedules.push({
            type: "deposit",
            name: "Deposit",
            isPercentage: true,
            percentage: data.depositPercentage?.toString() || "20",
            calculatedAmount: depositAmount.toFixed(2),
            sortOrder: 0,
          });
          if (data.depositBalanceStrategy === "milestones" && data.milestones.length > 0) {
            const milestoneCount = data.milestones.length;
            const baseAmountPerMilestone = Math.floor((remainingAmount * 100) / milestoneCount) / 100;
            let allocatedTotal = 0;
            data.milestones.forEach((_, index) => {
              const milestoneAmount = index === milestoneCount - 1
                ? Math.round((remainingAmount - allocatedTotal) * 100) / 100
                : baseAmountPerMilestone;
              if (index < milestoneCount - 1) allocatedTotal += milestoneAmount;
              paymentSchedules.push({
                type: "milestone",
                name: `Milestone ${index + 1}`,
                isPercentage: false,
                fixedAmount: milestoneAmount.toFixed(2),
                calculatedAmount: milestoneAmount.toFixed(2),
                sortOrder: index + 1,
              });
            });
          } else {
            paymentSchedules.push({
              type: "final",
              name: "Final Payment",
              isPercentage: true,
              percentage: (100 - (data.depositPercentage || 20)).toString(),
              calculatedAmount: remainingAmount.toFixed(2),
              sortOrder: 1,
            });
          }
        } else if (data.depositType === "fixed") {
          paymentSchedules = [
            { type: "deposit", name: "Deposit", isPercentage: false, fixedAmount: data.depositAmount?.toString() || "0", calculatedAmount: data.depositAmount?.toFixed(2) || "0", sortOrder: 0 },
            { type: "final", name: "Final Payment", isPercentage: false, fixedAmount: (total - (data.depositAmount || 0)).toFixed(2), calculatedAmount: (total - (data.depositAmount || 0)).toFixed(2), sortOrder: 1 },
          ];
        }
      }

      const customSections = data.customSections?.length
        ? data.customSections.map((section, index) => ({
            heading: `Section ${index + 1}`,
            content: section.content || null,
            sortOrder: index,
          }))
        : undefined;

      const mode = submissionModeRef.current;
      const options = {
        status: (mode === "send" || mode === "mark_sent" ? "sent" : "draft") as "draft" | "sent",
        sendEmail: mode === "send",
      };

      const response = await apiRequest("POST", "/api/quotes/full", {
        clientId: data.clientId,
        clientName: data.clientName,
        clientEmail: data.clientEmail || null,
        clientPhone: data.clientPhone || null,
        clientAddress: data.clientAddress,
        jobType: "general",
        description: data.description || null,
        validUntil: data.validUntil ? format(data.validUntil, "yyyy-MM-dd") : null,
        notes: data.notes || null,
        taxRate: (data.taxRate || 10).toString(),
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        termsOfTradeTemplateId: data.termsOfTradeTemplateId || null,
        termsOfTradeContent: data.termsOfTradeContent || null,
        milestones,
        paymentSchedules: paymentSchedules.length > 0 ? paymentSchedules : undefined,
        customSections,
        options,
      });
      const newQuote = await response.json();
      return { quote: newQuote, mode };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      const message = result.mode === "send"
        ? "Quote created and sent to client"
        : result.mode === "mark_sent"
          ? "Quote created and marked as sent"
          : "Quote created successfully";
      toast({ title: message });
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
    const useSinglePrice = form.watch("useSinglePrice");
    const singleTotalPrice = parseFloat(String(form.watch("singleTotalPrice"))) || 0;
    const taxRate = parseFloat(String(form.watch("taxRate"))) || 10;
    const isPriceInclusive = form.watch("isPriceInclusive");

    const enteredPrice = useSinglePrice
      ? singleTotalPrice
      : milestones.reduce((sum, m) => sum + (parseFloat(String(m.price)) || 0), 0);

    let subtotal: number;
    let taxAmount: number;
    let total: number;

    if (isPriceInclusive) {
      total = enteredPrice;
      subtotal = total / (1 + taxRate / 100);
      taxAmount = total - subtotal;
    } else {
      subtotal = enteredPrice;
      taxAmount = subtotal * (taxRate / 100);
      total = subtotal + taxAmount;
    }

    return { subtotal, taxAmount, total, isPriceInclusive };
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
              <Step3Milestones
                form={form}
                milestoneFields={milestoneFields}
                onMilestoneCountChange={handleMilestoneCountChange}
                onAppend={() => append({ richDescription: "", price: 0 })}
                onRemove={remove}
              />
            )}

            {currentStep === 4 && (
              <Step4CustomSections
                form={form}
                customSectionFields={customSectionFields}
                onAppendSection={() => appendSection({ content: "" })}
                onRemoveSection={removeSection}
                termsTemplates={termsTemplates || []}
              />
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
                <Button type="button" onClick={(e) => nextStep(e)} data-testid="button-next-step">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      disabled={createMutation.isPending}
                      data-testid="button-create-quote"
                    >
                      {createMutation.isPending ? "Creating..." : "Create Quote"}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        submissionModeRef.current = "send";
                        form.handleSubmit(onSubmit)();
                      }}
                      data-testid="menu-create-and-send"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Create and Send
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        submissionModeRef.current = "mark_sent";
                        form.handleSubmit(onSubmit)();
                      }}
                      data-testid="menu-mark-as-sent"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark as sent
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        submissionModeRef.current = "draft";
                        form.handleSubmit(onSubmit)();
                      }}
                      data-testid="menu-save-as-draft"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Save as draft
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

      setIsNewClientDialogOpen(false);
      newClientForm.reset();
      toast({ title: "Client created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create client", variant: "destructive" });
    },
  });

  const handleNewClientSubmit = (data: NewClientFormValues) => {
    const submitData = {
      ...data,
      phone: formatPhoneWithCountryCode(data.phone || "", data.country),
      mobilePhone: formatPhoneWithCountryCode(data.mobilePhone || "", data.country),
    };
    createClientMutation.mutate(submitData);
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
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Client</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      onClientSelect(value);
                    }}
                    disabled={clientsLoading}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-client">
                        <SelectValue placeholder={clientsLoading ? "Loading..." : "Select a client"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.firstName} {client.lastName} {client.company ? `(${client.company})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewClientDialogOpen(true)}
              className="mt-6"
              data-testid="button-new-client"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              New Client
            </Button>
          </div>

          {selectedClient && (
            <div className="p-4 bg-muted/50 rounded-md space-y-3">
              <div className="text-sm font-medium">Selected Client Details</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name: </span>
                  {selectedClient.firstName} {selectedClient.lastName}
                </div>
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  {selectedClient.email || "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  {selectedClient.phone || selectedClient.mobilePhone || "-"}
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Address: </span>
                  {[selectedClient.streetAddress, selectedClient.city, selectedClient.state, selectedClient.postalCode]
                    .filter(Boolean).join(", ") || "-"}
                </div>
              </div>
            </div>
          )}

          <FormField
            control={form.control}
            name="clientAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Address</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Enter the job site address"
                    className="min-h-[80px]"
                    data-testid="input-job-address"
                  />
                </FormControl>
                <FormDescription>
                  This may differ from the client's address
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Dialog open={isNewClientDialogOpen} onOpenChange={setIsNewClientDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
            <DialogDescription>Add a new client to your database</DialogDescription>
          </DialogHeader>

          <form onSubmit={newClientForm.handleSubmit(handleNewClientSubmit)}>
            <div className="space-y-4 py-4">
              <div className="flex gap-4">
                <RadioGroup
                  value={newClientType}
                  onValueChange={(value: "individual" | "company") => newClientForm.setValue("type", value)}
                  className="flex gap-4"
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
                        className={`flex items-start gap-4 p-4 rounded-md border cursor-pointer transition-colors ${field.value === type.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
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
            <div className="mt-6 p-4 rounded-md bg-muted/50 space-y-4">
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="depositBalanceStrategy"
                render={({ field }) => {
                  const depositPercentage = form.watch("depositPercentage") || 0;
                  const remainingPercentage = 100 - depositPercentage;
                  return (
                    <FormItem>
                      <FormLabel>Remaining Balance Payment</FormLabel>
                      <FormDescription className="mb-2">
                        How should the remaining {remainingPercentage}% be paid?
                      </FormDescription>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid gap-3"
                        >
                          <label
                            className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${field.value === "on_completion" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                              }`}
                            data-testid="radio-balance-on-completion"
                          >
                            <RadioGroupItem value="on_completion" />
                            <div>
                              <div className="font-medium">On completion</div>
                              <div className="text-sm text-muted-foreground">Single payment when job is complete</div>
                            </div>
                          </label>
                          <label
                            className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${field.value === "milestones" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                              }`}
                            data-testid="radio-balance-milestones"
                          >
                            <RadioGroupItem value="milestones" />
                            <div>
                              <div className="font-medium">Based on milestones</div>
                              <div className="text-sm text-muted-foreground">Split across milestone completions</div>
                            </div>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
              <FormItem className="flex flex-col">
                <FormLabel>Quote Valid Until</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={`w-[280px] justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`}
                        data-testid="button-valid-until"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : "Select a date"}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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
  onMilestoneCountChange,
  onAppend,
  onRemove,
}: {
  form: ReturnType<typeof useForm<QuoteWizardValues>>;
  milestoneFields: { id: string }[];
  onMilestoneCountChange: (count: number) => void;
  onAppend: () => void;
  onRemove: (index: number) => void;
}) {
  const milestones = form.watch("milestones");
  const useSinglePrice = form.watch("useSinglePrice");
  const singleTotalPrice = parseFloat(String(form.watch("singleTotalPrice"))) || 0;

  const itemizedTotal = milestones.reduce((sum, m) => sum + (parseFloat(String(m.price)) || 0), 0);
  const displayTotal = useSinglePrice ? singleTotalPrice : itemizedTotal;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Milestones</h2>
        <p className="text-muted-foreground">Define the work milestones and their pricing</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Number of Milestones</CardTitle>
              <CardDescription>How many milestones does this project have?</CardDescription>
            </div>
            <Select
              value={milestoneFields.length.toString()}
              onValueChange={(value) => onMilestoneCountChange(parseInt(value))}
            >
              <SelectTrigger className="w-24" data-testid="select-milestone-count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-lg">Pricing Option</CardTitle>
              <CardDescription>Choose how to display pricing</CardDescription>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="single-price-toggle"
                  checked={useSinglePrice}
                  onCheckedChange={(checked) => form.setValue("useSinglePrice", checked)}
                  data-testid="switch-single-price"
                />
                <Label htmlFor="single-price-toggle">
                  {useSinglePrice ? "Single total price" : "Itemized pricing per milestone"}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="tax-inclusive-toggle"
                  checked={form.watch("isPriceInclusive")}
                  onCheckedChange={(checked) => form.setValue("isPriceInclusive", checked)}
                  data-testid="switch-tax-inclusive"
                />
                <Label htmlFor="tax-inclusive-toggle">
                  {form.watch("isPriceInclusive") ? "Price includes tax" : "Price excludes tax"}
                </Label>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-right mb-4">
            <div className="text-sm text-muted-foreground">
              {form.watch("isPriceInclusive") ? "Total (incl. tax)" : "Total (excl. tax)"}
            </div>
            <div className="text-lg font-semibold" data-testid="text-subtotal">
              ${displayTotal.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </CardContent>
      </Card>

      {milestoneFields.map((field, index) => (
        <Card key={field.id}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <Badge variant="outline">Milestone {index + 1}</Badge>
              {milestoneFields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(index)}
                  data-testid={`button-remove-milestone-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name={`milestones.${index}.richDescription`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Rich Text)</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Detailed description of the work included in this milestone..."
                      data-testid={`input-milestone-desc-${index}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!useSinglePrice && (
              <FormField
                control={form.control}
                name={`milestones.${index}.price`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-40"
                          placeholder="0.00"
                          data-testid={`input-milestone-price-${index}`}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Enter the price for this milestone
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>
      ))}

      {useSinglePrice && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Price</CardTitle>
            <CardDescription>Enter the single total price for all work</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="singleTotalPrice"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-lg">$</span>
                      <Input
                        {...field}
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-48 text-lg"
                        placeholder="0.00"
                        data-testid="input-single-total-price"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={onAppend}
        className="w-full"
        data-testid="button-add-milestone"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Milestone
      </Button>
    </div>
  );
}

function Step4CustomSections({
  form,
  customSectionFields,
  onAppendSection,
  onRemoveSection,
  termsTemplates,
}: {
  form: ReturnType<typeof useForm<QuoteWizardValues>>;
  customSectionFields: { id: string }[];
  onAppendSection: () => void;
  onRemoveSection: (index: number) => void;
  termsTemplates: TermsTemplate[];
}) {
  const handleApplyTemplate = (index: number, templateId: string) => {
    const template = termsTemplates.find(t => t.id.toString() === templateId);
    if (template) {
      form.setValue(`customSections.${index}.content`, template.content);
    }
  };

  const handleTermsOfTradeChange = (templateId: string) => {
    const effectiveId = templateId === "none" ? "" : templateId;
    form.setValue("termsOfTradeTemplateId", effectiveId, { shouldDirty: true, shouldTouch: true });
    const template = termsTemplates.find(t => t.id.toString() === templateId);
    if (template) {
      form.setValue("termsOfTradeContent", template.content, { shouldDirty: true, shouldTouch: true });
    } else {
      form.setValue("termsOfTradeContent", "", { shouldDirty: true, shouldTouch: true });
    }
  };

  const selectedTermsTemplateId = form.watch("termsOfTradeTemplateId");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Custom Sections</h2>
        <p className="text-muted-foreground">Add additional sections like warranty information, special conditions, etc.</p>
      </div>

      {customSectionFields.map((field, index) => (
        <Card key={field.id}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <Badge variant="outline">
                <FileText className="w-3 h-3 mr-1" />
                Section {index + 1}
              </Badge>
              <div className="flex items-center gap-2">
                {termsTemplates.length > 0 && (
                  <Select onValueChange={(value) => handleApplyTemplate(index, value)}>
                    <SelectTrigger className="w-[180px]" data-testid={`select-template-${index}`}>
                      <SelectValue placeholder="Apply template" />
                    </SelectTrigger>
                    <SelectContent>
                      {termsTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveSection(index)}
                  data-testid={`button-remove-section-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name={`customSections.${index}.content`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content (Rich Text)</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Enter section content..."
                      data-testid={`input-section-content-${index}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={onAppendSection}
        className="w-full"
        data-testid="button-add-section"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Custom Section
      </Button>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Terms of Trade
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Select terms of trade to include with this quote. These can be sent as a separate PDF.
          </p>
        </CardHeader>
        <CardContent>
          <FormField
            control={form.control}
            name="termsOfTradeTemplateId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Terms of Trade Template</FormLabel>
                <Select
                  onValueChange={handleTermsOfTradeChange}
                  value={field.value || ""}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-terms-of-trade">
                      <SelectValue placeholder="Select terms template..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No terms of trade</SelectItem>
                    {termsTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {selectedTermsTemplateId && selectedTermsTemplateId !== "none" && (
            <div className="mt-4 p-4 bg-muted/50 rounded-md">
              <div className="text-sm text-muted-foreground mb-2">Preview:</div>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: form.watch("termsOfTradeContent") || "" }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Step5Review({
  form,
  calculateTotals,
  formatCurrency
}: {
  form: ReturnType<typeof useForm<QuoteWizardValues>>;
  calculateTotals: () => { subtotal: number; taxAmount: number; total: number; isPriceInclusive: boolean };
  formatCurrency: (value: number) => string;
}) {
  const data = form.watch();
  const { subtotal, taxAmount, total, isPriceInclusive } = calculateTotals();
  const depositType = data.depositType;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Review Quote</h2>
        <p className="text-muted-foreground">Review all details before creating the quote</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Client Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Client</div>
              <div className="font-medium" data-testid="text-review-client">{data.clientName}</div>
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
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Job Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Valid Until</div>
              <div className="font-medium">{data.validUntil ? format(data.validUntil, "PPP") : "Not specified"}</div>
            </div>
            <div className="lg:col-span-3">
              <div className="text-muted-foreground">Description</div>
              <div className="font-medium">{data.description || "-"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Milestones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.milestones.map((milestone, index) => (
            <div key={index} className="p-4 border rounded-md">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="font-medium">Milestone {index + 1}</div>
                {!data.useSinglePrice && milestone.price && milestone.price > 0 && (
                  <span className="font-medium">{formatCurrency(milestone.price)}</span>
                )}
              </div>
              {milestone.richDescription && (
                <div
                  className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: milestone.richDescription }}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {data.termsOfTradeContent && data.termsOfTradeTemplateId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Terms of Trade
            </CardTitle>
            <p className="text-sm text-muted-foreground">Will be included with the quote and can be sent as a separate PDF</p>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: data.termsOfTradeContent }}
            />
          </CardContent>
        </Card>
      )}

      {data.customSections && data.customSections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Additional Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.customSections.map((section, index) => (
              <div key={index} className="p-4 border rounded-md">
                <div className="font-medium mb-2">Section {index + 1}</div>
                {section.content && (
                  <div
                    className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: section.content }}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isPriceInclusive && (
              <div className="text-xs text-muted-foreground mb-2 p-2 bg-muted/50 rounded">
                Prices entered include GST - amounts below have been calculated
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal (excl. GST)</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST ({data.taxRate}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-3">
              <span>Total (incl. GST)</span>
              <span data-testid="text-review-total">{formatCurrency(total)}</span>
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
