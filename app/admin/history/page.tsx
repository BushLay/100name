import type { Metadata } from "next"

import { AdminHistoryBoard } from "@/components/AdminHistoryBoard"
import { AdminPageShell } from "@/components/AdminPageShell"

export const metadata: Metadata = {
  title: "Admin History",
  description:
    "Protected operator history console for incident timelines and archived operational reports.",
}

export default function AdminHistoryPage() {
  return (
    <AdminPageShell
      active="history"
      description="Focused history console for incident timelines, archived reports, and longer operator review windows."
      title="Operator History"
    >
      <AdminHistoryBoard />
    </AdminPageShell>
  )
}
