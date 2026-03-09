import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, X, UserCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB

export default function Account() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
    }
  }, [user]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const f = firstName.trim();
    const l = lastName.trim();
    if (!f) errs.firstName = "First name is required";
    if (!l) errs.lastName = "Last name is required";
    if (f.length > 100) errs.firstName = "First name must be 100 characters or less";
    if (l.length > 100) errs.lastName = "Last name must be 100 characters or less";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      let finalProfileUrl: string | null | undefined = undefined;
      if (profileFile) {
        setUploadingPhoto(true);
        const urlRes = await fetch("/api/auth/user/request-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
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
        finalProfileUrl = objectPath;
        setUploadingPhoto(false);
      }
      const body: Record<string, unknown> = {
        firstName: firstName.trim().slice(0, 100),
        lastName: lastName.trim().slice(0, 100),
      };
      if (finalProfileUrl !== undefined) body.profileImageUrl = finalProfileUrl ?? null;
      const res = await apiRequest("PATCH", "/api/auth/user", body);
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.message || "Failed to update profile", variant: "destructive" });
        return;
      }
      toast({ title: "Profile updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      setUploadingPhoto(false);
    }
  };

  const currentImageUrl = profilePreview ?? user?.profileImageUrl ?? null;

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <UserCircle className="h-6 w-6" />
            Account
          </CardTitle>
          <CardDescription>
            Update your profile photo, first name, and last name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-photo">Profile photo (optional)</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/25 bg-muted/50 flex items-center justify-center shrink-0">
                  {currentImageUrl ? (
                    <img
                      src={currentImageUrl}
                      alt="Profile"
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
                  {(profilePreview || profileFile) && (
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

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || uploadingPhoto}
            >
              {submitting || uploadingPhoto ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save changes"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
