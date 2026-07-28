import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginGate({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(false);
    const ok = await onLogin(password).catch(() => false);
    setBusy(false);
    if (!ok) setError(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Lock className="size-5" />
          </div>
          <CardTitle>Avail Sales Dashboard</CardTitle>
          <CardDescription>Enter the team password to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            />
            {error && <p className="text-sm text-destructive">Incorrect password — try again.</p>}
            <Button type="submit" disabled={!password || busy}>
              {busy ? 'Checking…' : 'View dashboard'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
