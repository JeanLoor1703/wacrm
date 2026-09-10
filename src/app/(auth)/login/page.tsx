'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import {
  ArrowRight,
  Eye,
  EyeOff,
  HardHat,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UsersRound,
} from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
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
    <div className="relative z-10 flex min-h-screen items-center justify-center px-5 pt-32 pb-20 sm:px-10 sm:pt-36 sm:pb-32 lg:h-full lg:min-h-0 lg:overflow-hidden lg:px-12 lg:py-7 xl:px-20 xl:py-10">
      <Card className="w-full max-w-[510px] rounded-[18px] border-0 bg-white py-0 shadow-[0_28px_80px_-38px_rgba(24,31,42,0.42)] ring-1 ring-[#18202b]/10">
        <CardHeader className="px-6 pt-7 pb-3 sm:px-10 sm:pt-8 lg:px-8 lg:pt-7">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#f0f2f4] text-[#ed3237] shadow-[inset_0_0_0_1px_rgba(24,32,43,0.04)]">
            {inviteToken ? (
              <UsersRound aria-hidden="true" className="size-6" />
            ) : (
              <HardHat aria-hidden="true" className="size-6" />
            )}
          </div>
          <p className="font-heading text-primary text-[11px] font-bold tracking-[0.28em] uppercase">
            Portal de ventas
          </p>
          <h1 className="text-foreground font-heading mt-1.5 text-[2rem] leading-none font-extrabold tracking-[-0.025em] text-balance uppercase sm:text-[2.25rem]">
            {inviteToken ? t('titleAccept') : t('titleWelcome')}
          </h1>
          <CardDescription className="text-muted-foreground mt-2 text-[15px] leading-6 sm:text-base">
            {inviteToken ? t('descAccept') : t('descWelcome')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-7 sm:px-10 sm:pb-8 lg:px-8 lg:pb-7">
          <form onSubmit={handleLogin} className="flex flex-col gap-4.5">
            {error && (
              <div
                id="login-error"
                role="alert"
                aria-live="polite"
                className="rounded-lg border border-[#ed3237]/20 bg-[#ed3237]/7 px-4 py-3 text-sm leading-5 text-[#b91f25]"
              >
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="email"
                className="text-sm font-semibold text-[#303641]"
              >
                {t('emailLabel')}
              </Label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  strokeWidth={1.8}
                  className="pointer-events-none absolute top-1/2 left-4 size-[19px] -translate-y-1/2 text-[#525b68]"
                />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                  className="h-13 rounded-lg border-[#d5d9de] bg-[#fafbfc] pr-4 pl-12 text-[#202630] shadow-[inset_0_1px_2px_rgba(18,26,36,0.03)] placeholder:text-[#9aa1aa] focus-visible:border-[#ed3237] focus-visible:ring-[#ed3237]/15"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-sm font-semibold text-[#303641]"
                >
                  {t('passwordLabel')}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-primary rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ed3237]"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <LockKeyhole
                  aria-hidden="true"
                  strokeWidth={1.8}
                  className="pointer-events-none absolute top-1/2 left-4 size-[19px] -translate-y-1/2 text-[#525b68]"
                />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                  className="h-13 rounded-lg border-[#d5d9de] bg-[#fafbfc] pr-13 pl-12 text-[#202630] shadow-[inset_0_1px_2px_rgba(18,26,36,0.03)] placeholder:text-[#9aa1aa] focus-visible:border-[#ed3237] focus-visible:ring-[#ed3237]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={
                    showPassword ? t('hidePassword') : t('showPassword')
                  }
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-1.5 flex size-10 touch-manipulation items-center justify-center rounded-md border border-[#d5d9de] bg-white text-[#515a66] shadow-[0_1px_2px_rgba(18,26,36,0.04)] transition-[background-color,color,border-color] duration-150 hover:border-[#b8bec6] hover:bg-[#f3f5f6] hover:text-[#202630] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ed3237]"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" className="size-[19px]" />
                  ) : (
                    <Eye aria-hidden="true" className="size-[19px]" />
                  )}
                </button>
              </div>
            </div>

            <Label
              htmlFor="remember-device"
              className="flex w-fit cursor-pointer touch-manipulation items-center gap-3 text-sm font-medium text-[#5b6370]"
            >
              <Checkbox
                id="remember-device"
                name="remember-device"
                checked={rememberDevice}
                onCheckedChange={(checked) =>
                  setRememberDevice(checked === true)
                }
                className="size-5 rounded-[5px]"
              />
              <span>{t('rememberDevice')}</span>
            </Label>

            <Button
              type="submit"
              disabled={loading}
              className="group bg-primary font-heading text-primary-foreground hover:bg-primary-hover mt-1 h-13 w-full rounded-lg text-[15px] font-bold tracking-[0.1em] uppercase shadow-[0_8px_22px_-12px_rgba(237,50,55,0.9)] transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-55"
            >
              {loading ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                  {t('signingIn')}
                </>
              ) : (
                <>
                  {t('signIn')}
                  <ArrowRight
                    aria-hidden="true"
                    className="ml-2 size-5 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transform-none"
                  />
                </>
              )}
            </Button>
          </form>

          <p className="text-muted-foreground mt-8 border-t border-[#d9dde1] pt-6 text-center text-sm">
            {t('noAccount')}{' '}
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : '/signup'
              }
              className="text-primary rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ed3237]"
            >
              {t('createAccount')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
