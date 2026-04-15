'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface NavbarProps {
  userDisplayName: string
  userEmail: string
  avatarUrl: string | null
}

export default function Navbar({ userDisplayName, userEmail, avatarUrl }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userDisplayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center">
              <span className="text-white font-black text-[10px] tracking-tight">TT</span>
            </div>
            <span className="text-gray-900 font-bold text-sm tracking-tight hidden sm:block">
              TrapTranscriptor
            </span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-0.5">
            <Link
              href="/"
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Trascrivi
            </Link>
            <Link
              href="/reports"
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/reports'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Resoconti
            </Link>
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2.5 px-2 py-1 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700 hidden sm:block">{userDisplayName}</span>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={userDisplayName}
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center ring-1 ring-gray-200">
                  <span className="text-white text-xs font-bold">{initials}</span>
                </div>
              )}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">{userDisplayName}</p>
                    {userEmail && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{userEmail}</p>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Esci
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
