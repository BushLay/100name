import { cn } from "@/lib/utils"

type ProgressProps = {
  className?: string
  value: number
}

function Progress({ className, value }: ProgressProps) {
  const safeValue = Math.max(0, Math.min(100, value))

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      className={cn("h-3 w-full overflow-hidden rounded-full bg-secondary", className)}
      data-slot="progress"
      role="progressbar"
    >
      <div
        aria-hidden="true"
        className="h-full rounded-full bg-primary transition-[width] duration-500"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  )
}

export { Progress }
