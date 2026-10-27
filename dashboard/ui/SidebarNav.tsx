'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from './Icons';
import type { NavItem } from './Shell';

export function SidebarNav({ items }: { items: NavItem[] }) {
  const path = usePathname() || '';
  return (
    <nav className="d-nav" aria-label="Dashboard">
      {items.map((n) => {
        const Icon = Icons[n.icon];
        const active = n.href === '/admin' ? path === '/admin' || path === '/admin/' : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
            <Icon /> {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
