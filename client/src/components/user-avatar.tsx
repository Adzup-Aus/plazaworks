import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface UserAvatarUser {
  profileImageUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

/** Get initials: firstName+lastName, else first letter of email (local part), else "?". */
export function getUserInitials(user: UserAvatarUser | null | undefined): string {
  if (!user) return "?";
  const first = user.firstName?.charAt(0) || "";
  const last = user.lastName?.charAt(0) || "";
  const initials = (first + last).trim().toUpperCase();
  if (initials) return initials;
  if (user.email) {
    const local = user.email.split("@")[0];
    return local?.charAt(0)?.toUpperCase() || "?";
  }
  return "?";
}

interface UserAvatarProps {
  user: UserAvatarUser | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

export function UserAvatar({ user, className, size = "md" }: UserAvatarProps) {
  const initials = getUserInitials(user);
  const displayUrl = user?.profileImageUrl?.trim() || undefined;

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={displayUrl} alt={user?.firstName || "User"} />
      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
    </Avatar>
  );
}
