'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Sparkles, FolderOpen, BookOpen, BarChart2,
  TrendingUp, CreditCard, Settings, Eye, Bot, Brain, Activity,
  Shield, Target, Lightbulb, DollarSign, PieChart, Zap,
  ChevronRight, LogOut, Wrench, Building2, Loader2,
} from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

// ─── Nav structure ─────────────────────────────────────────────────────────────

const MAIN_NAV = [
  { label: 'Dashboard',      icon: LayoutDashboard, href: '/dashboard'     },
  { label: 'Create',         icon: Sparkles,        href: '/create'         },
  { label: 'My Campaigns',   icon: FolderOpen,      href: '/campaigns'      },
  { label: 'Resources',      icon: BookOpen,        href: '/resources'      },
  { label: 'Analytics',      icon: BarChart2,       href: '/analytics'      },
  { label: 'Ad Performance', icon: TrendingUp,      href: '/ad-performance' },
  { label: 'Billing',        icon: CreditCard,      href: '/billing'        },
  { label: 'Settings',       icon: Settings,        href: '/settings'       },
  { label: 'Observatory',    icon: Eye,             href: '/observatory'    },
];

const INTELLIGENCE_NAV = [
  { label: 'Autonomous System', icon: Bot,       href: '/autonomous'               },
  { label: 'AI Brain Stream',   icon: Brain,     href: '/ai-stream'                },
  { label: 'Pro Diagnostics',   icon: Activity,  href: '/pro-mode'                 },
  { label: 'System Audit',      icon: Shield,    href: '/system-audit'             },
  { label: 'Competitor Intel',  icon: Target,    href: '/competitor-intelligence'  },
  { label: 'Trend Prediction',  icon: TrendingUp,href: '/trends'                   },
  { label: 'Ad Intelligence',   icon: Lightbulb, href: '/ad-intelligence'          },
];

const FINANCIAL_NAV = [
  { label: 'Overview',       icon: DollarSign, href: '/financial-os'               },
  { label: 'Cost Tracking',  icon: PieChart,   href: '/financial-os/cost'          },
  { label: 'Optimizer',      icon: Zap,        href: '/financial-os/optimizer'     },
  { label: 'Profit Zones',   icon: TrendingUp, href: '/financial-os/profit'        },
  { label: 'AI CFO',         icon: Brain,      href: '/financial-os/cfo'           },
  { label: 'Budget',         icon: BarChart2,  href: '/financial-os/budget'        },
  { label: 'Revenue',        icon: DollarSign, href: '/financial-os/revenue'       },
  { label: 'AI CEO',         icon: Building2,  href: '/financial-os/ceo'           },
  { label: 'Unit Economics', icon: PieChart,   href: '/financial-os/unit-economics'},
];

const TOOLS_NAV = [
  { label: 'Generated Tools', icon: Wrench, href: '/system-generated' },
];

// ─── Admin gate ────────────────────────────────────────────────────────────────

const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_USER_IDS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean);

function isAdminUser(userId: string) { return ADMIN_IDS.includes(userId); }

// ─── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({
  href, label, icon: Icon, active, badge,
}: {
  href: string; label: string; icon: React.ElementType;
  active: boolean; badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
      <span className="truncate">{label}</span>
      {badge}
    </Link>
  );
}

// ─── NavSection ────────────────────────────────────────────────────────────────

function NavSection({
  label,
  items,
  isActive,
  defaultOpen = false,
}: {
  label: string;
  items: { label: string; icon: React.ElementType; href: string }[];
  isActive: (href: string) => boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-1">
      <Separator className="mb-2 opacity-50" />
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        {label}
        <ChevronRight className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="mt-1 space-y-0.5">
          {items.map(item => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActive(item.href)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  useRequireAuth();
  const pathname = usePathname();
  const [userInfo, setUserInfo] = useState<{ name: string; email: string; initial: string; id: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    try { setGenerating(!!sessionStorage.getItem('cos_active_job')); } catch {}
    const onStart = () => setGenerating(true);
    const onEnd   = () => setGenerating(false);
    window.addEventListener('cos:generation:start', onStart);
    window.addEventListener('cos:generation:end',   onEnd);
    return () => {
      window.removeEventListener('cos:generation:start', onStart);
      window.removeEventListener('cos:generation:end',   onEnd);
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = (user.user_metadata?.full_name as string) ?? user.email?.split('@')[0] ?? 'User';
        setUserInfo({ name, email: user.email ?? '', initial: name[0]?.toUpperCase() ?? 'U', id: user.id });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        const name = (session.user.user_metadata?.full_name as string) ?? session.user.email?.split('@')[0] ?? 'User';
        setUserInfo({ name, email: session.user.email ?? '', initial: name[0]?.toUpperCase() ?? 'U', id: session.user.id });
      } else {
        setUserInfo(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    window.location.href = '/login';
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href;
    if (href === '/create')    return pathname === '/create' || pathname === '/ad-builder' || pathname === '/campaigns/new';
    if (href === '/campaigns') return pathname === href || (pathname.startsWith('/campaigns/') && !pathname.startsWith('/campaigns/new'));
    if (href === '/financial-os') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }

  const inIntelligence = INTELLIGENCE_NAV.some(i => pathname.startsWith(i.href));
  const inFinancial    = FINANCIAL_NAV.some(i => isActive(i.href));
  const inTools        = TOOLS_NAV.some(i => pathname.startsWith(i.href));

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-[hsl(var(--sidebar-background))]">

        {/* ── Logo ─────────────────────────────────────────────────────────── */}
        <Link
          href="/dashboard"
          className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4 hover:opacity-90 transition-opacity"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-[0_0_14px_rgba(249,115,22,0.4)]">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-foreground">Creative OS</span>
        </Link>

        {/* ── Scrollable nav ───────────────────────────────────────────────── */}
        <ScrollArea className="flex-1 px-3 py-3">
          {/* Main nav */}
          <div className="space-y-0.5">
            {MAIN_NAV.map(item => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isActive(item.href)}
                badge={
                  item.href === '/create' && generating ? (
                    <span className="ml-auto flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold text-primary">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      Live
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>

          {/* Collapsible sections */}
          <NavSection label="Intelligence" items={INTELLIGENCE_NAV} isActive={isActive} defaultOpen={inIntelligence} />
          <NavSection label="Financial OS"  items={FINANCIAL_NAV}    isActive={isActive} defaultOpen={inFinancial} />
          <NavSection label="Tools"         items={TOOLS_NAV}         isActive={isActive} defaultOpen={inTools} />

          {/* Admin */}
          {isAdminUser(userInfo?.id ?? '') && (
            <div className="mt-1">
              <Separator className="mb-2 opacity-50" />
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Admin</p>
              <NavItem href="/admin/profit" label="Admin OS" icon={Shield} active={pathname.startsWith('/admin')} />
            </div>
          )}
        </ScrollArea>

        {/* ── User footer ──────────────────────────────────────────────────── */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs">{userInfo?.initial ?? '?'}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{userInfo?.name ?? '—'}</p>
              <p className="truncate text-[10px] text-muted-foreground">{userInfo?.email ?? ''}</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </div>
        </div>

      </aside>
    </TooltipProvider>
  );
}
