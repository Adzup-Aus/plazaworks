import type { Scope } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ScopeSelectorProps {
  scopes: Scope[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

export function ScopeSelector({ scopes, selected, onChange, className }: ScopeSelectorProps) {
  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((s) => s !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Label>Scopes (permissions)</Label>
      <div className="grid gap-2 rounded-md border p-3">
        {scopes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scopes available. Run seed script: npx tsx scripts/seed-integration-scopes.ts</p>
        ) : (
          scopes.map((scope) => (
            <div key={scope.id} className="flex items-center space-x-2">
              <Checkbox
                id={`scope-${scope.id}`}
                checked={selected.includes(scope.name)}
                onCheckedChange={() => toggle(scope.name)}
              />
              <label
                htmlFor={`scope-${scope.id}`}
                className="cursor-pointer text-sm font-medium leading-none"
              >
                {scope.name}
              </label>
              <span className="text-xs text-muted-foreground">— {scope.description}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
