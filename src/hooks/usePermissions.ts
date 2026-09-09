"use client"

import { useMemo } from "react"
import { useAuthStore } from "@/store/useAuthStore"
import { resolvePermission, type Permissions } from "@/lib/permissions"

export function usePermissions() {
  const user = useAuthStore((s) => s.user)

  const permissions = (user?.permisos as Permissions | undefined) || null

  const hasPermission = useMemo(() => {
    return (key: string): boolean => {
      if (!permissions) return false
      return resolvePermission(permissions, key)
    }
  }, [permissions])

  const hasAnyPermission = useMemo(() => {
    return (keys: string[]): boolean => {
      if (!permissions) return false
      return keys.some((key) => resolvePermission(permissions, key))
    }
  }, [permissions])

  const hasAllPermissions = useMemo(() => {
    return (keys: string[]): boolean => {
      if (!permissions) return false
      return keys.every((key) => resolvePermission(permissions, key))
    }
  }, [permissions])

  return { hasPermission, hasAnyPermission, hasAllPermissions, permissions }
}
