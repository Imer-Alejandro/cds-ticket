"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: "sm" | "md" | "lg"
}) {
  if (!open) return null
  const maxW = size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-sm" : "max-w-lg"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative z-10 w-full ${maxW} bg-card border border-border rounded-2xl shadow-xl overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h3 className="text-sm font-semibold">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/50 bg-muted/20">{footer}</div>}
      </div>
    </div>
  )
}