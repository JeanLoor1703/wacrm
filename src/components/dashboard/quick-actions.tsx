'use client';

import Link from 'next/link';
import { UserPlus, Briefcase, Radio, Zap } from 'lucide-react';
import type { ComponentType } from 'react';

import { useTranslations } from 'next-intl';

// Quick-action shortcuts. Each navigates to the page that owns the
// relevant "create" flow. We deliberately don't try to auto-open any
// modal on the target page — that'd require touching those pages,
// which is out of scope here.
interface Action {
  labelKey: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

const ACTIONS: Action[] = [
  { labelKey: 'newContact', href: '/contacts', icon: UserPlus },
  { labelKey: 'newDeal', href: '/pipelines', icon: Briefcase },
  { labelKey: 'newBroadcast', href: '/broadcasts/new', icon: Radio },
  { labelKey: 'newAutomation', href: '/automations/new', icon: Zap },
];

export function QuickActions() {
  const t = useTranslations('Dashboard.quickActions');

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group border-border bg-card hover:border-primary/50 hover:bg-primary-soft flex min-h-14 items-center gap-3 rounded-md border px-4 py-3 shadow-[0_12px_28px_-28px_rgba(21,21,21,0.6)] transition-all hover:-translate-y-0.5"
          >
            <div className="bg-primary-soft text-primary group-hover:bg-primary flex h-9 w-9 items-center justify-center rounded-md group-hover:text-white">
              <Icon className="h-4 w-4" />
            </div>
            <span className="font-heading text-foreground text-xs font-bold tracking-[0.06em] uppercase">
              {t(a.labelKey as string)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
