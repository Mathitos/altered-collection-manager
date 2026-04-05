import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const results: Record<string, unknown> = {}

  // Test 1: basic query
  try {
    results.cardCount = await prisma.card.count()
  } catch (e) {
    results.cardCountError = String(e)
  }

  // Test 2: create and delete a test user (simulates what NextAuth does)
  try {
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@health.check`,
        name: "Health Check",
        emailVerified: null,
      },
    })
    results.userCreate = "ok"
    await prisma.user.delete({ where: { id: user.id } })
    results.userDelete = "ok"
  } catch (e) {
    results.userError = String(e)
  }

  return NextResponse.json(results)
}
