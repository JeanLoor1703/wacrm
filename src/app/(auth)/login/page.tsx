'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { HardHat, UsersRound } from 'lucide-react';

// `useSearchParams` opts the component out of static prerendering
// unless it sits under a Suspense boundary. We split the form into
// a child component so the outer page can prerender the chrome
// (background, card frame) while the form hydrates with the query
// string on the client.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  // Forwarded from `/join/<token>` when the visitor already has an
  // account. After a successful sign-in we send them to the join
  // page to accept rather than to /dashboard.
  const inviteToken = searchParams.get('invite');
  const t = useTranslations('LoginPage');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Full-page navigation (not router.push) so the browser issues a
    // fresh top-level request that carries the just-written Supabase
    // auth cookies to the middleware gating /dashboard. A soft
    // client-side navigation can reach the protected route before the
    // server observes the new session, so the middleware bounces it
    // back to /login — which looks like the page "just refreshing"
    // instead of signing in (issue #365). Mirrors the deliberate full
    // reload the invite-accept flow already uses in join/[token].
    const destination = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : '/dashboard';
    window.location.href = destination;
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5 pt-32 pb-10 sm:px-10 sm:pt-36">
      <Card className="w-full max-w-md border-0 bg-white shadow-[0_24px_70px_-32px_rgba(21,21,21,0.42)] ring-1 ring-[#151515]/10">
        <CardHeader className="px-6 pt-7 pb-2 sm:px-8">
          <div className="bg-primary mb-4 flex h-10 w-10 items-center justify-center rounded-md text-white shadow-sm">
            {inviteToken ? (
              <UsersRound className="h-5 w-5" />
            ) : (
              <HardHat className="h-5 w-5" />
            )}
          </div>
          <p className="font-heading text-primary text-[11px] font-bold tracking-[0.22em] uppercase">
            Portal de ventas
          </p>
          <CardTitle className="text-foreground mt-1 text-3xl leading-none font-bold uppercase">
            {inviteToken ? t('titleAccept') : t('titleWelcome')}
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            {inviteToken ? t('descAccept') : t('descWelcome')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-7 sm:px-8">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-muted-foreground">
                {t('emailLabel')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20 h-11 rounded-md bg-[#f7f7f6] px-3"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-muted-foreground">
                  {t('passwordLabel')}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-primary hover:text-primary/80 text-sm"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20 h-11 rounded-md bg-[#f7f7f6] px-3"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="bg-primary font-heading text-primary-foreground hover:bg-primary-hover mt-2 h-11 w-full rounded-md font-bold tracking-[0.12em] uppercase disabled:opacity-50"
            >
              {loading ? t('signingIn') : t('signIn')}
            </Button>
          </form>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            {t('noAccount')}{' '}
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : '/signup'
              }
              className="text-primary hover:text-primary/80"
            >
              {t('createAccount')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
