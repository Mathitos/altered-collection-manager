import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const protectedPaths = ["/decks"]

export default auth((req) => {
  const isProtected = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
