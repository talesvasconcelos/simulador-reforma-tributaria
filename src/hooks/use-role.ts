'use client'
import { useAuth } from '@clerk/nextjs'

export function useIsGestor(): boolean {
  const { orgRole } = useAuth()
  return orgRole === 'org:admin'
}
