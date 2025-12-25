import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Slapjack - Multiplayer Card Game',
  description: 'Play Slapjack online with friends! A fast-paced multiplayer card game.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-felt-dark">
        {children}
      </body>
    </html>
  )
}
