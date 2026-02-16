import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Registration is disabled; new users are invited by an admin.
 * Redirects to login with a message.
 */
export default function Register() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/login?message=Registration+is+by+invite+only", { replace: true });
  }, [navigate]);
  return null;
}
