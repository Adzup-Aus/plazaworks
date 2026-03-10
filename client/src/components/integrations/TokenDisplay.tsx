import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TokenDisplayProps {
  token: string;
  className?: string;
}

export function TokenDisplay({ token, className }: TokenDisplayProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Please select and copy the token manually",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Input
        type={visible ? "text" : "password"}
        value={token}
        readOnly
        className="font-mono text-sm"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setVisible(!visible)}
        title={visible ? "Hide token" : "Show token"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleCopy}
        title="Copy to clipboard"
      >
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
