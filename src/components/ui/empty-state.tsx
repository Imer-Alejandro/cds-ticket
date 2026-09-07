import type { ReactNode } from "react"
import { FileText } from "lucide-react"

export function EmptyState({
  icon: Icon = FileText,
  title,
  subtitle,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
        <Icon className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground/60 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}