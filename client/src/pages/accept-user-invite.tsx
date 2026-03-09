import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Loader2, ArrowRight, XCircle, UserPlus, Upload, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB

function getTokenFromQuery(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? "";
}

export default function AcceptUserInvite() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
      })
      .catch(() => {
        setLoading(false);
        setValid(false);
      });
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const f = firstName.trim();
    const l = lastName.trim();
    if (!f) errs.firstName = "First name is required";
    if (!l) errs.lastName = "Last name is required";
    if (f.length > 100) errs.firstName = "First name must be 100 characters or less";
    if (l.length > 100) errs.lastName = "Last name must be 100 characters or less";
    if (password.length < 8) errs.password = "Password must be at least 8 characters";
    if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    if (confirmPassword && password !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Invalid file type. Use JPEG, PNG, or WebP.", variant: "destructive" });
      return;
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      toast({ title: "File too large. Maximum 5MB.", variant: "destructive" });
      return;
    }
    setProfileFile(file);
    setProfilePreview(URL.createObjectURL(file));
  };

  const removeProfileImage = () => {
    setProfileFile(null);
    if (profilePreview) {
      URL.revokeObjectURL(profilePreview);
      setProfilePreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadProfileImage = async (): Promise<string | null> => {
    if (!profileFile || !token) return null;
    setUploadingPhoto(true);
    try {
      const urlRes = await fetch("/api/invites/accept/request-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          filename: profileFile.name,
          size: profileFile.size,
          contentType: profileFile.type,
        }),
      });
      if (!urlRes.ok) {
        const data = await urlRes.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Failed to get upload URL");
      }
      const { uploadURL, objectPath } = await urlRes.json();
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: profileFile,
        headers: { "Content-Type": profileFile.type },
      });
      if (!putRes.ok) throw new Error("Failed to upload file");
      return objectPath;
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not upload photo",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      let finalProfileUrl: string | null = null;
      if (profileFile) {
        const objPath = await uploadProfileImage();
        if (objPath) finalProfileUrl = objPath;
      }
      const body: Record<string, unknown> = {
        token,
        password,
        firstName: firstName.trim().slice(0, 100),
        lastName: lastName.trim().slice(0, 100),
      };
      if (finalProfileUrl) body.profileImageUrl = finalProfileUrl;
      const res = await apiRequest("POST", "/api/invites/accept", body);
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.message || "Failed to create account", variant: "destructive" });
        return;
      }
      toast({ title: "Account created", description: "You can now sign in." });
      navigate("/login?registered=1");
    } catch (err: any) {
      toast({ title: err.message || "Something went wrong", variant: "destructive" });
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
              Create your account
            </CardTitle>
            <CardDescription>
              {loading
                ? "Checking invite…"
                : valid
                  ? `Set up your account for ${email}`
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
                  <Label htmlFor="profile-photo">Profile photo (optional)</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/25 bg-muted/50 flex items-center justify-center shrink-0">
                      {profilePreview ? (
                        <img
                          src={profilePreview}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileInputRef}
                        id="profile-photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={uploadingPhoto}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                      >
                        {uploadingPhoto ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Choose photo"
                        )}
                      </Button>
                      {profilePreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={removeProfileImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP. Max 5MB.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input
                      id="first-name"
                      type="text"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      maxLength={101}
                      required
                    />
                    {errors.firstName && (
                      <p className="text-sm text-destructive">{errors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input
                      id="last-name"
                      type="text"
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      maxLength={101}
                      required
                    />
                    {errors.lastName && (
                      <p className="text-sm text-destructive">{errors.lastName}</p>
                    )}
                  </div>
                </div>

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
                  disabled={submitting || uploadingPhoto}
                >
                  {submitting || uploadingPhoto ? (
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
