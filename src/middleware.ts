import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import type { NextFetchEvent } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'

// Rotas que não exigem autenticação Clerk
// Cron e rag/indexar são protegidas por CRON_SECRET na própria rota
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/cron(.*)',
  '/api/rag/indexar',
])

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const response = await clerkHandler(request, event)

  // Clerk v7 em dev mode emite "protect-rewrite" para rotas sem o cookie de dev browser.
  // O Vercel CDN pode cachear esse rewrite como 404 permanente.
  // Interceptamos e convertemos para redirect/401 que o CDN não cacheia.
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
