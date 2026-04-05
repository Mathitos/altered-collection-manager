import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { signOut } from "@/lib/auth"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Altered TCG Collection Manager",
  description: "Gerencie sua coleção e decks do Altered TCG",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth()

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b border-border bg-background">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-bold text-sm">
                Altered TCG
              </Link>
              <Link href="/cards" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cartas
              </Link>
              {session?.user && (
                <Link href="/decks" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Meus Decks
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2">
              {session?.user ? (
                <form
                  action={async () => {
                    "use server"
                    await signOut({ redirectTo: "/" })
                  }}
                >
                  <Button type="submit" variant="ghost" size="sm">
                    Sair
                  </Button>
                </form>
              ) : (
                <Link href="/login">
                  <Button size="sm">Entrar</Button>
                </Link>
              )}
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
