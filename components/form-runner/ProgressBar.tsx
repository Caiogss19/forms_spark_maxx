"use client";

import { motion } from "framer-motion";

interface Props {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: Props) {
  const pct = total <= 0 ? 0 : Math.min(100, Math.round((current / total) * 100));
  return (
    <div className="h-1 w-full overflow-hidden bg-muted">
      <motion.div
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        className="h-full bg-[var(--form-primary,var(--primary))]"
      />
    </div>
  );
}
