import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning";

interface BannerProps {
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

export function Banner({
  tone = "info",
  title,
  children,
  action,
}: BannerProps): JSX.Element {
  const Icon = tone === "warning" ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-sm",
        tone === "warning"
          ? "border-amber-500/30 bg-amber-500/5 text-amber-200"
          : "border-border/60 bg-muted/30 text-muted-foreground",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "warning" ? "text-amber-400" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {children && (
          <p className="mt-0.5 text-xs text-muted-foreground">{children}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
