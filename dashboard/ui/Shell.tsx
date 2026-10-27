import React from 'react';
import Link from 'next/link';
import { Icons, type IconName } from './Icons';
import { SidebarNav } from './SidebarNav';
import { ToastProvider } from './Toast';
import { SignOut } from './SignOut';
import type { DashboardUser } from '../lib/auth';

export type NavItem = { href: string; label: string; icon: IconName; adminOnly?: boolean; group?: string };

/** Sidebar order per the brief. Users and Redirects are admin (GYA) only. */
export const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/pages', label: 'Pages', icon: 'pages' },
  { href: '/admin/posts', label: 'Blog Posts', icon: 'posts' },
  { href: '/admin/media', label: 'Media Library', icon: 'media' },
  { href: '/admin/team', label: 'Team', icon: 'team' },
  { href: '/admin/enquiries', label: 'Enquiries', icon: 'enquiries' },
  { href: '/admin/seo', label: 'SEO', icon: 'seo' },
  { href: '/admin/settings', label: 'Site Settings', icon: 'settings' },
  { href: '/admin/redirects', label: 'Redirects', icon: 'redirects', adminOnly: true },
  { href: '/admin/users', label: 'Users', icon: 'users', adminOnly: true },
];

export function Shell({ user, siteName, siteUrl, title, children }: { user: DashboardUser; siteName: string; siteUrl: string; title?: string; children: React.ReactNode }) {
  const items = NAV.filter((n) => !n.adminOnly || user.role === 'admin');
  const initials = (user.name || user.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');
  const Ext = Icons.external;
  return (
    <ToastProvider>
      <div className="d-shell">
        <aside className="d-sidebar">
          <div className="d-brand">
            <Link href="/admin" className="d-brand-logo" aria-label={`${siteName} dashboard home`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo.png" alt={siteName} />
            </Link>
            <div className="d-brand-sub">Website dashboard</div>
          </div>
          <SidebarNav items={items} />
          <div className="d-sidebar-foot">
            <a href={siteUrl} target="_blank" rel="noopener">
              <Ext width={16} height={16} /> View website
            </a>
            <div style={{ opacity: 0.7, marginTop: 10, fontSize: 12 }}>Signed in as {user.name || user.email}</div>
            <SignOut />
          </div>
        </aside>
        <div className="d-main">
          <header className="d-topbar">
            <div className="d-topbar-title">
              {siteName}
              {title ? <span> / {title}</span> : null}
            </div>
            <div className="d-topbar-spacer" />
            <a className="view" href={siteUrl} target="_blank" rel="noopener">
              <Ext width={16} height={16} /> View site
            </a>
            <div className="d-user">
              <span className="d-avatar" aria-hidden="true">
                {initials || 'U'}
              </span>
              <span>
                {user.name || user.email}
                <span className="role" style={{ display: 'block' }}>
                  {user.role === 'admin' ? 'Admin (GYA)' : 'Editor'}
                </span>
              </span>
            </div>
          </header>
          <div className="d-content">{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}
