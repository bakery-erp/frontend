'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import DashboardLayout from './DashboardLayout';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Exclude standalone pages such as login and mobile worker interfaces
  const isExcluded = pathname === '/login' || (pathname ? pathname.startsWith('/mobile') : false);

  if (isExcluded) {
    return <>{children}</>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
