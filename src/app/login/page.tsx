import { signIn } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Altered TCG</CardTitle>
          <CardDescription>
            Entre para gerenciar seus decks e coleção
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server"
              await signIn("google", { redirectTo: "/decks" })
            }}
          >
            <Button type="submit" className="w-full">
              Entrar com Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
