import { clerkMiddleware } from '@clerk/nextjs/server'
import type { NextFetchEvent } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'

const clerkHandler = clerkMiddleware((auth, req) => {
  // Auth handled individually per route
})

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const response = await clerkHandler(request, event)

  // Clerk v7 em dev mode faz "protect-rewrite" para rotas sem o cookie
  // de dev browser. O Vercel CDN cacheia esse rewrite como 404 permanente.
  // Solução: interceptar e retornar redirect/401 que o Vercel não cacheia.
  const authReason = (response as Response | null)?.headers?.get('x-clerk-auth-reason') ?? ''
  if (authReason.includes('protect-rewrite')) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirect_url', request.url)
    return NextResponse.redirect(signInUrl)
  }

  return response ?? NextResponse.next()
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
