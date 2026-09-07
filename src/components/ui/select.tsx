import type { SelectHTMLAttributes } from "react"

/** Select nativo con el estilo visual de la app y opción vacía opcional. */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 rounded-xl border border-border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${className || ""}`}
    >
      {children}
    </select>
  )
}