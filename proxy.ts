import { NextResponse, type NextRequest } from 'next/server'

// Proxy leggero — nessun import pesante, compatibile Edge runtime
// La verifica reale della sessione avviene nei Server Components
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Route pubbliche — passa sempre
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next()
  }

  // Controlla presenza cookie di sessione Supabase
  // Supabase SSR usa cookie nel formato sb-<ref>-auth-token
  const projectRef = 'mrvqpdnjotqngsletbqd'
  const hasSession =
    request.cookies.has(`sb-${projectRef}-auth-token`) ||
    request.cookies.has(`sb-${projectRef}-auth-token.0`) ||
    request.cookies.has(`sb-${projectRef}-auth-token.1`) ||
    // Formato alternativo usato da versioni più recenti
    request.cookies.getAll().some(c => c.name.startsWith(`sb-${projectRef}`))

  if (!hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect utente loggato che torna su /login
  if (pathname === '/login' && hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
