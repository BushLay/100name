"use client"

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

type DialogContentProps = {
  className?: string
  children: ReactNode
}

type SimpleChildrenProps = {
  className?: string
  children: ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false)
      }
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [onOpenChange, open])

  if (!open || typeof document === "undefined") {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        type="button"
      />
      <div className="relative z-10 w-full">{children}</div>
    </div>,
    document.body
  )
}

function DialogContent({ className, children }: DialogContentProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-2xl rounded-lg border-2 border-border bg-background p-0 shadow-[6px_6px_0_rgba(36,28,21,0.9)]",
        className
      )}
      data-slot="dialog-content"
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  )
}

function DialogHeader({ className, children }: SimpleChildrenProps) {
  return (
    <div className={cn("flex flex-col gap-2 p-6 pb-3", className)} data-slot="dialog-header">
      {children}
    </div>
  )
}

function DialogTitle({ className, children }: SimpleChildrenProps) {
  return (
    <h2 className={cn("text-2xl font-black", className)} data-slot="dialog-title">
      {children}
    </h2>
  )
}

function DialogDescription({ className, children }: SimpleChildrenProps) {
  return (
    <p className={cn("text-sm leading-7 text-muted-foreground", className)} data-slot="dialog-description">
      {children}
    </p>
  )
}

function DialogFooter({ className, children }: SimpleChildrenProps) {
  return (
    <div className={cn("flex flex-col gap-3 p-6 pt-3 sm:flex-row", className)} data-slot="dialog-footer">
      {children}
    </div>
  )
}

export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle }
