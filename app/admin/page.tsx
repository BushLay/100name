import type { Metadata } from "next"

import { AdminAuditBoard } from "@/components/AdminAuditBoard"
import { AdminPageShell } from "@/components/AdminPageShell"

export const metadata: Metadata = {
  title: "Admin Operations",
  description:
    "Protected operations dashboard for audit review, email delivery monitoring, retention cleanup, and leaderboard recompute jobs.",
}

export default function AdminPage() {
  return (
    <AdminPageShell
      active="overview"
      description="Protected operations dashboard for audit review, delivery monitoring, cleanup, and live admin controls."
      title="Admin Operations"
    >
      <AdminAuditBoard />
    </AdminPageShell>
  )
}
