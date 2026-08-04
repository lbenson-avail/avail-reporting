import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, Megaphone } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AvailLogo } from '@/components/AvailLogo';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/marketing', label: 'Marketing', Icon: Megaphone },
  { to: '/sales', label: 'Sales', Icon: BarChart3 },
];

function NavItem({ to, label, Icon }) {
  const link = (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          isActive
            ? 'bg-accent text-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        )
      }
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="hidden lg:inline">{label}</span>
    </NavLink>
  );
  return (
    <li>
      {/* Icon-only below lg — the tooltip carries the label. */}
      <span className="lg:hidden">
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      </span>
      <span className="hidden lg:block">{link}</span>
    </li>
  );
}

export function AppShell() {
  return (
    <div className="bg-background flex min-h-screen">
      <aside className="border-border sticky top-0 flex h-screen w-14 shrink-0 flex-col border-r px-2 py-4 print:hidden lg:w-52 lg:px-3">
        <div className="mb-6 hidden items-center lg:flex lg:px-2">
          <AvailLogo />
        </div>
        <nav aria-label="Reporting sections">
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </ul>
        </nav>
        <p className="text-muted-foreground mt-auto hidden text-center text-[10px] lg:block">
          HubSpot is the source of truth
        </p>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
