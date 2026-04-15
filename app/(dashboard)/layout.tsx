import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single()

  // Genera URL pubblico per l'avatar se presente
  let avatarUrl: string | null = null
  if (profile?.avatar_url) {
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(profile.avatar_url)
    avatarUrl = data.publicUrl
  }

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'Utente'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar
        userDisplayName={displayName}
        userEmail={user.email ?? ''}
        avatarUrl={avatarUrl}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
