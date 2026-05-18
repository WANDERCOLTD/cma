import { motion } from "framer-motion";
import { CheckCircle2, Loader2, CircleDashed, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MergeStatus, QueueStatus } from "@/types";

type Status = MergeStatus | QueueStatus | "idle";

const META: Record<
  Status,
  { label: string; variant: "merged" | "queued" | "running" | "failed" | "idle"; Icon: React.ComponentType<{ className?: string }> }
> = {
  merged: { label: "MERGED", variant: "merged", Icon: CheckCircle2 },
  running: { label: "RUNNING", variant: "running", Icon: Loader2 },
  queued: { label: "QUEUED", variant: "queued", Icon: CircleDashed },
  failed: { label: "FAILED", variant: "failed", Icon: XCircle },
  idle: { label: "IDLE", variant: "idle", Icon: CircleDashed },
};

export function StatusChip({ status }: { status: Status }): JSX.Element {
  const { label, variant, Icon } = META[status];
  const spin = status === "running";
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
      <Badge variant={variant} className="uppercase tracking-wider">
        <Icon className={spin ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
        {label}
      </Badge>
    </motion.span>
  );
}
