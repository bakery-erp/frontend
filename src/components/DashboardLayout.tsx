'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getImageUrl } from '@/lib/utils';
import {
  LogOut, LayoutDashboard, Users, MapPin, Package,
  Banknote, Layers, Boxes, ArrowRightLeft, ChefHat, BarChart3, Truck,
  CalendarDays, DollarSign, Building2, Utensils, Search, Menu, X, History, UserCheck, CreditCard
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { branches, selectedBranchId, setSelectedBranchId } = useBranch();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF7EE] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 bg-[#E87A18] rounded-2xl flex items-center justify-center animate-bounce shadow-lg">
            <Utensils className="w-6 h-6 text-white" />
          </div>
          <p className="text-[#4A2E1B] font-bold text-sm tracking-wide">Loading Bakery ERP Portal...</p>
        </div>
      </div>
    );
  }

  const role = user?.role;
  const isOwner = role === 'OWNER';
  const isAdmin = role === 'ADMIN';

  const menuItems = [
    ...(isOwner || isAdmin ? [{ icon: LayoutDashboard, label: 'Dashboard', href: '/' }] : []),
    { icon: UserCheck, label: 'My Profile & Salary', href: '/my-profile' },
    ...(isOwner ? [{ icon: MapPin, label: 'Branches', href: '/branches' }] : []),
    ...((isOwner || isAdmin) ? [{ icon: Users, label: 'Users & Staff', href: '/users' }] : []),
    ...((isOwner || isAdmin || role === 'BAKER' || role === 'CAKE_WORKER' || role === 'SAMBUSA_WORKER') ? [
      { icon: ChefHat, label: 'Production Batches', href: '/production' },
      { icon: History, label: 'Daily Product History', href: '/production/history' }
    ] : []),
    ...((isOwner || isAdmin || role === 'CASHIER') ? [
      { icon: CalendarDays, label: 'Daily Sessions', href: '/daily-sessions' },
      { icon: CreditCard, label: 'Customer Credit Sales', href: '/customer-credits' }
    ] : []),
    ...((isOwner || isAdmin) ? [
      { icon: Layers, label: 'Product Categories', href: '/product-categories' }
    ] : []),
    ...((isOwner || isAdmin) ? [
      { icon: Package, label: 'Products', href: '/products' }
    ] : []),
    ...((isOwner || isAdmin || role === 'CASHIER') ? [
      { icon: ArrowRightLeft, label: 'Product Conversions', href: '/product-conversions' }
    ] : []),
    ...((isOwner || isAdmin) ? [
      { icon: Boxes, label: 'Stock & Inventory', href: '/stock' }
    ] : []),
    ...((isOwner || isAdmin) ? [
      { icon: ArrowRightLeft, label: 'Stock Movements', href: '/stock-movements' }
    ] : []),
    ...((isOwner || isAdmin || role === 'CASHIER') ? [
      { icon: Truck, label: 'Suppliers & Purchases', href: '/suppliers' }
    ] : []),
    ...((isOwner || isAdmin || role === 'CASHIER') ? [
      { icon: DollarSign, label: 'Expenses & Costs', href: '/expenses' }
    ] : []),
    ...((isOwner || isAdmin) ? [
      { icon: Banknote, label: 'Payroll', href: '/payroll' },
      { icon: BarChart3, label: 'Financial Reports', href: '/reports' }
    ] : []),
  ];

  // Find the most specific active route match
  const matchingItems = menuItems.filter(
    (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`))
  );
  const activeHref = [...matchingItems].sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo Section */}
      <div className="pt-6 pb-5 px-6 flex items-center justify-between border-b border-[#5A3A23]/60">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-[#E87A18] rounded-2xl flex items-center justify-center mr-3 shadow-md">
            <Utensils className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white block leading-tight">Bakery ERP</span>
            <span className="text-[10px] uppercase font-bold text-[#E2C7B4] tracking-widest block">{user?.role} PORTAL</span>
          </div>
        </div>
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden text-[#E2C7B4] hover:text-white p-1"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3.5 py-5 overflow-y-auto space-y-1 sidebar-scrollbar">
        <div className="text-[11px] font-bold text-[#CBB29F] uppercase tracking-widest mb-3 px-3">Menu Navigation</div>
        <ul className="space-y-1.5">
          {menuItems.map((item, i) => {
            const isActive = item.href === activeHref;
            return (
              <li key={i}>
                <Link
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${isActive
                      ? 'bg-[#E87A18] text-white shadow-[0_4px_16px_rgba(232,122,24,0.45)] transform scale-[1.02]'
                      : 'text-[#E2C7B4] hover:bg-[#5A3A23] hover:text-white'
                    }`}
                >
                  <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#E2C7B4]'}`} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info & Logout Button */}
      <div className="p-4 m-3 bg-[#3D2314] rounded-2xl border border-[#5A3A23]">
        <div className="mb-3 px-1">
          <p className="text-sm font-bold text-white truncate">{user?.fullName}</p>
          <p className="text-xs text-[#CBB29F] truncate">{user?.phone}</p>
        </div>
        <Button
          className="w-full justify-center bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl shadow-md border-0 h-10 transition-all"
          onClick={logout}
        >
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF7EE] text-[#2C1B10] flex p-3 md:p-6 font-sans">
      {/* Mobile & Tablet Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile & Tablet Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 w-72 bg-[#4A2E1B] text-white z-50 transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-[#4A2E1B] text-white rounded-3xl min-h-[calc(100vh-3rem)] hidden lg:flex flex-col fixed left-6 top-6 bottom-6 z-20 shadow-[0_10px_30px_rgba(74,46,27,0.25)] border border-[#5A3A23]">
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full pl-0 lg:pl-72 min-h-screen">
        {/* Top Header Bar */}
        <header className="h-16 bg-[#FFFDF8]/90 backdrop-blur-md border border-[#EDE4D5] rounded-2xl sticky top-3 md:top-6 z-30 px-4 md:px-6 flex items-center justify-between shadow-[0_4px_20px_rgba(74,46,27,0.04)] mb-4 md:mb-6">
          <div className="flex items-center space-x-3 md:space-x-4">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-[#F4ECE1] text-[#4A2E1B] hover:bg-[#E0D5C3] transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 md:w-5 md:h-5 text-[#8C7361] hidden sm:inline" />
              <span className="text-[10px] md:text-xs font-bold text-[#8C7361] uppercase tracking-wider hidden sm:inline">Branch:</span>
              {isOwner ? (
                <select
                  value={selectedBranchId || 'ALL'}
                  onChange={(e) => setSelectedBranchId(e.target.value === 'ALL' ? null : e.target.value)}
                  className="bg-[#F4ECE1] border border-[#E0D5C3] text-[#2C1B10] text-xs md:text-sm rounded-xl focus:ring-[#E87A18] focus:border-[#E87A18] px-2.5 md:px-3 py-1.5 font-bold truncate max-w-[180px] sm:max-w-none"
                >
                  <option value="ALL">🌐 All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      📍 {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="inline-flex items-center px-2.5 md:px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#F4ECE1] text-[#4A2E1B] border border-[#E0D5C3] truncate">
                  📍 {user?.branch?.name || 'Assigned Branch'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 md:space-x-4">
            {/* Role Badge */}
            <span className="hidden sm:inline-block px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#E87A18]/10 text-[#E87A18] border border-[#E87A18]/20 uppercase tracking-wider">
              {user?.role}
            </span>

            {/* Profile Avatar Pill */}
            <Link href="/my-profile" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              {user?.filesUrl ? (
                <img
                  src={getImageUrl(user.filesUrl)!}
                  alt={user.fullName || 'User'}
                  className="w-9 h-9 rounded-xl object-cover border border-[#E87A18]/30 shadow-md"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4A2E1B] to-[#E87A18] text-white flex items-center justify-center font-extrabold text-sm shadow-md border border-white/20">
                  {user?.fullName?.charAt(0) || 'B'}
                </div>
              )}
            </Link>
          </div>
        </header>

        {/* Page Content View */}
        <main className="flex-1 px-1 sm:px-2">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

