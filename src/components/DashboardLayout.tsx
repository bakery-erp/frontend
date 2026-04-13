'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Store, Users, MapPin, Package, Settings, Banknote } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Menu items - filtering conditionally based on role
  const menuItems = [
    ...(user?.role === 'OWNER' ? [{ icon: MapPin, label: 'Branches', href: '/branches' }] : []),
    { icon: Users, label: 'Users & Roles', href: '/users' },
    { icon: Package, label: 'Product Categories', href: '/product-categories' },
    { icon: Package, label: 'Products', href: '/products' },
    { icon: Banknote, label: 'Payroll & HR', href: '/payroll' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-zinc-200 min-h-screen flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-zinc-100">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center mr-3">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Bakery ERP</span>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1 mb-6">
            <li>
              <Link href="/" className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors ${pathname === '/' ? 'bg-zinc-100 text-black' : 'text-zinc-600 hover:bg-zinc-50 hover:text-black'}`}>
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
            </li>
          </ul>

          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-3">Management</div>
          <ul className="space-y-1">
            {menuItems.map((item, i) => (
              <li key={i}>
                <Link href={item.href} className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors ${pathname.startsWith(item.href) ? 'bg-zinc-100 text-black' : 'text-zinc-600 hover:bg-zinc-50 hover:text-black'}`}>
                  <item.icon className="w-4 h-4 opacity-70" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <div className="mb-4">
            <p className="text-sm font-semibold text-zinc-800 truncate">{user?.fullName}</p>
            <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">{user?.role}</p>
          </div>
          <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto relative h-screen">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
