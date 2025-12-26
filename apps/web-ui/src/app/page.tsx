import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Gate</h1>
          <p className="text-muted-foreground">Claude Code Permission Gateway</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome to Gate</CardTitle>
            <CardDescription>
              Manage permission requests from Claude Code CLI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              This application allows you to remotely approve or deny command
              execution requests from Claude Code running on your Mac.
            </p>
            <div className="flex gap-2">
              <Button>Allow Example</Button>
              <Button variant="destructive">Deny Example</Button>
              <Button variant="outline">Outline Example</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
