import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UserCircle,
  Plus,
  Mail,
  Phone,
  MapPin,
  Building2,
  Globe,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PermissionGate } from "@/components/permission-gate";

const COUNTRIES = [
  { code: "AU", name: "Australia", dialCode: "+61" },
  { code: "NZ", name: "New Zealand", dialCode: "+64" },
  { code: "US", name: "United States", dialCode: "+1" },
  { code: "GB", name: "United Kingdom", dialCode: "+44" },
  { code: "CA", name: "Canada", dialCode: "+1" },
  { code: "SG", name: "Singapore", dialCode: "+65" },
  { code: "HK", name: "Hong Kong", dialCode: "+852" },
  { code: "JP", name: "Japan", dialCode: "+81" },
  { code: "KR", name: "South Korea", dialCode: "+82" },
  { code: "CN", name: "China", dialCode: "+86" },
  { code: "IN", name: "India", dialCode: "+91" },
  { code: "PH", name: "Philippines", dialCode: "+63" },
  { code: "MY", name: "Malaysia", dialCode: "+60" },
  { code: "ID", name: "Indonesia", dialCode: "+62" },
  { code: "TH", name: "Thailand", dialCode: "+66" },
  { code: "VN", name: "Vietnam", dialCode: "+84" },
  { code: "DE", name: "Germany", dialCode: "+49" },
  { code: "FR", name: "France", dialCode: "+33" },
  { code: "IT", name: "Italy", dialCode: "+39" },
  { code: "ES", name: "Spain", dialCode: "+34" },
  { code: "NL", name: "Netherlands", dialCode: "+31" },
  { code: "IE", name: "Ireland", dialCode: "+353" },
] as const;

function stripDialCode(phone: string): string {
  if (!phone) return "";
  for (const country of COUNTRIES) {
    if (phone.startsWith(country.dialCode + " ") || phone.startsWith(country.dialCode)) {
      const stripped = phone.replace(country.dialCode, "").trim();
      return stripped.replace(/^0+/, "");
    }
  }
  return phone.replace(/^0+/, "");
}

function formatPhoneWithCountryCode(phone: string, countryCode: string): string {
  if (!phone) return "";
  const country = COUNTRIES.find(c => c.code === countryCode);
  if (!country) return phone;
  const localNumber = stripDialCode(phone);
  if (!localNumber) return "";
  return `${country.dialCode} ${localNumber}`;
}

function getDialCodeFromCountry(countryCode: string): string {
  const country = COUNTRIES.find(c => c.code === countryCode);
  return country?.dialCode || "+61";
}

function normalizeCountryCode(country: string | null): string {
  if (!country) return "AU";
  const foundByCode = COUNTRIES.find(c => c.code === country);
  if (foundByCode) return foundByCode.code;
  const foundByName = COUNTRIES.find(c => c.name.toLowerCase() === country.toLowerCase());
  if (foundByName) return foundByName.code;
  return "AU";
}

interface Client {
  id: string;
  entityType: "individual" | "company";
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  streetAddress: string | null;
  streetAddress2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  portalEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const clientFormSchema = z.object({
  type: z.enum(["individual", "company"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  mobilePhone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
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

type ClientFormValues = z.infer<typeof clientFormSchema>;

const defaultClientFormValues: ClientFormValues = {
  type: "individual",
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phone: "",
  mobilePhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "AU",
  notes: "",
};

export default function Clients() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: defaultClientFormValues,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      return apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client created successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create client", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientFormValues> }) => {
      return apiRequest("PATCH", `/api/clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client updated successfully" });
      setIsDialogOpen(false);
      setEditingClient(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update client", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete client", variant: "destructive" });
    },
  });

  const portalAccessMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest("POST", `/api/clients/${id}/portal-access`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Portal access updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update portal access", 
        description: error.message || "Client must have an email to enable portal access",
        variant: "destructive" 
      });
    },
  });

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      form.reset({
        type: (client.entityType || "individual") as "individual" | "company",
        firstName: client.firstName || "",
        lastName: client.lastName || "",
        companyName: client.company || "",
        email: client.email || "",
        phone: stripDialCode(client.phone || ""),
        mobilePhone: stripDialCode(client.mobilePhone || ""),
        addressLine1: client.streetAddress || "",
        addressLine2: client.streetAddress2 || "",
        city: client.city || "",
        state: client.state || "",
        postalCode: client.postalCode || "",
        country: normalizeCountryCode(client.country),
        notes: client.notes || "",
      });
    } else {
      setEditingClient(null);
      form.reset(defaultClientFormValues);
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ClientFormValues) => {
    const formattedData = {
      ...data,
      phone: data.phone ? formatPhoneWithCountryCode(data.phone, data.country || "AU") : "",
      mobilePhone: data.mobilePhone ? formatPhoneWithCountryCode(data.mobilePhone, data.country || "AU") : "",
      streetAddress: data.addressLine1 || null,
      streetAddress2: data.addressLine2 || null,
      entityType: data.type,
      company: data.companyName || null,
    };
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data: formattedData });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const getClientDisplayName = (client: Client) => {
    if (client.entityType === "company") {
      return client.company || "Unnamed Company";
    }
    const parts = [client.firstName, client.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Unnamed Client";
  };

  const getClientAddress = (client: Client) => {
    const parts = [
      client.streetAddress,
      client.city,
      client.state,
      client.postalCode,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const filteredClients = clients?.filter((client) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const name = getClientDisplayName(client).toLowerCase();
    const email = (client.email || "").toLowerCase();
    const phone = (client.phone || "").toLowerCase();
    return name.includes(searchLower) || email.includes(searchLower) || phone.includes(searchLower);
  }) || [];

  const clientType = form.watch("type");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Clients</h1>
          <p className="text-muted-foreground">Manage your client contacts and portal access</p>
        </div>
        <PermissionGate permission="create_clients">
          <Button onClick={() => handleOpenDialog()} data-testid="button-add-client">
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </PermissionGate>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-clients"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredClients.length === 0 ? (
            <div className="py-12 text-center">
              <UserCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No clients found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery ? "Try adjusting your search" : "Add your first client to get started"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          {client.entityType === "company" ? (
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <UserCircle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium" data-testid={`text-client-name-${client.id}`}>
                            {getClientDisplayName(client)}
                          </div>
                          <Badge variant="secondary" className="mt-1">
                            {client.entityType === "company" ? "Company" : "Individual"}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {client.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            <span data-testid={`text-client-email-${client.id}`}>{client.email}</span>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getClientAddress(client) ? (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{getClientAddress(client)}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No address</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={client.portalEnabled}
                          onCheckedChange={(enabled) => {
                            portalAccessMutation.mutate({ id: client.id, enabled });
                          }}
                          disabled={portalAccessMutation.isPending}
                          data-testid={`switch-portal-${client.id}`}
                        />
                        <span className="text-sm text-muted-foreground">
                          {client.portalEnabled ? (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
                              <Globe className="mr-1 h-3 w-3" />
                              Active
                            </Badge>
                          ) : (
                            "Disabled"
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <PermissionGate permission="edit_clients">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(client)}
                            data-testid={`button-edit-client-${client.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate permission="delete_clients">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this client?")) {
                                deleteMutation.mutate(client.id);
                              }
                            }}
                            data-testid={`button-delete-client-${client.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingClient(null);
            form.reset(defaultClientFormValues);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? "Edit Client" : "Add New Client"}
            </DialogTitle>
            <DialogDescription>
              {editingClient
                ? "Update the client's information below"
                : "Enter the client's details to add them to your system"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-client-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {clientType === "company" ? (
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter company name"
                          {...field}
                          data-testid="input-company-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {clientType === "company" ? "Contact First Name" : "First Name *"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="First name"
                          {...field}
                          data-testid="input-first-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {clientType === "company" ? "Contact Last Name" : "Last Name"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Last name"
                          {...field}
                          data-testid="input-last-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          {...field}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormDescription>Required for portal access</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <div className="flex items-center px-3 border rounded-md bg-muted text-muted-foreground text-sm min-w-[60px] justify-center select-none">
                            {getDialCodeFromCountry(form.watch("country") || "AU")}
                          </div>
                          <Input
                            placeholder="2 1234 5678"
                            {...field}
                            data-testid="input-phone"
                            className="flex-1"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="mobilePhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Phone</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <div className="flex items-center px-3 border rounded-md bg-muted text-muted-foreground text-sm min-w-[60px] justify-center select-none">
                          {getDialCodeFromCountry(form.watch("country") || "AU")}
                        </div>
                        <Input
                          placeholder="400 123 456"
                          {...field}
                          data-testid="input-mobile"
                          className="flex-1"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Address</h4>
                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123 Main Street"
                          {...field}
                          data-testid="input-address1"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="addressLine2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Apartment, suite, unit, etc."
                          {...field}
                          data-testid="input-address2"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Sydney"
                            {...field}
                            data-testid="input-city"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="NSW"
                            {...field}
                            data-testid="input-state"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="2000"
                            {...field}
                            data-testid="input-postal"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-country">
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COUNTRIES.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.name} ({country.dialCode})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any additional notes about this client..."
                        className="resize-none"
                        {...field}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-client"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingClient
                      ? "Update Client"
                      : "Add Client"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
