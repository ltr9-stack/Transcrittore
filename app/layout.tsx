import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TrapTranscriptor',
  description: 'Analisi automatica di riunioni registrate: trascrizione e resoconto AI',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="it" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  )
}
