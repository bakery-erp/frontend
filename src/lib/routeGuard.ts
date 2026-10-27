/**
 * Centralized Role-Based Route Authorization & Guard
 *
 * Enforces strict automatic redirection across all roles and routes
 * preventing unauthorized navigation via direct URL entry.
 */

export type UserRole =
  | 'OWNER'
  | 'ADMIN'
  | 'CASHIER'
  | 'BAKER'
  | 'CAKE_WORKER'
  | 'SAMBUSA_WORKER'
  | 'STOCK_KEEPER'
  | 'EMPLOYEE';

/**
 * Returns the default designated home route for a given user role.
 */
export function getRoleHomeRoute(role?: string | null): string {
  switch (role) {
    case 'OWNER':
      return '/';
    case 'ADMIN':
      return '/production/history';
    case 'CASHIER':
      return '/customer-credits';
    case 'BAKER':
      return '/production';
    case 'CAKE_WORKER':
      return '/production';
    case 'SAMBUSA_WORKER':
      return '/production';
    case 'STOCK_KEEPER':
      return '/stock';
    case 'EMPLOYEE':
      return '/my-profile';
    default:
      return '/login';
  }
}

/**
 * Normalizes a path to ensure clean matching without query parameters or trailing slashes.
 */
function normalizePath(pathname: string): string {
  const pathWithoutQuery = pathname.split('?')[0].split('#')[0];
  if (pathWithoutQuery.length > 1 && pathWithoutQuery.endsWith('/')) {
    return pathWithoutQuery.slice(0, -1);
  }
  return pathWithoutQuery;
}

/**
 * Checks whether a given route is accessible by a specific role.
 */
export function isRouteAllowed(role: string | undefined | null, pathname: string): boolean {
  if (!role) return false;
  const path = normalizePath(pathname);

  // OWNER has unrestricted access to the entire ERP system
  if (role === 'OWNER') {
    return true;
  }

  // Public / auth routes are accessible to all
  if (path === '/login' || path.startsWith('/login/')) {
    return true;
  }

  // Every authenticated user can access their own profile & salary payslips
  if (path === '/my-profile' || path.startsWith('/my-profile/')) {
    return true;
  }

  // 1. ADMIN
  if (role === 'ADMIN') {
    // Admin is restricted from executive dashboard, branch setup, categories, product catalog, owner loans, reports, and full monthly payroll
    if (path === '/') return false;
    if (path === '/branches' || path.startsWith('/branches/')) return false;
    if (path === '/product-categories' || path.startsWith('/product-categories/')) return false;
    if (path === '/products' || path.startsWith('/products/')) return false;
    if (path === '/owner-loans' || path.startsWith('/owner-loans/')) return false;
    if (path === '/reports' || path.startsWith('/reports/')) return false;
    if (path === '/payroll' || (path.startsWith('/payroll/') && !path.startsWith('/payroll/loans'))) {
      return false;
    }

    // Allowed Admin routes:
    return (
      path === '/production' ||
      path.startsWith('/production/') ||
      path === '/daily-sessions' ||
      path.startsWith('/daily-sessions/') ||
      path === '/users' ||
      path.startsWith('/users/') ||
      path === '/customer-credits' ||
      path.startsWith('/customer-credits/') ||
      path === '/customers' ||
      path.startsWith('/customers/') ||
      path === '/product-conversions' ||
      path.startsWith('/product-conversions/') ||
      path === '/stock' ||
      path.startsWith('/stock/') ||
      path === '/stock-movements' ||
      path.startsWith('/stock-movements/') ||
      path === '/suppliers' ||
      path.startsWith('/suppliers/') ||
      path === '/expenses' ||
      path.startsWith('/expenses/') ||
      path.startsWith('/payroll/loans') ||
      path.startsWith('/mobile')
    );
  }

  // 2. CASHIER
  if (role === 'CASHIER') {
    // Note: /daily-sessions is strictly ADMIN and OWNER
    return (
      path === '/customer-credits' ||
      path.startsWith('/customer-credits/') ||
      path === '/customers' ||
      path.startsWith('/customers/') ||
      path === '/product-conversions' ||
      path.startsWith('/product-conversions/') ||
      path === '/suppliers' ||
      path.startsWith('/suppliers/') ||
      path === '/expenses' ||
      path.startsWith('/expenses/') ||
      path === '/mobile/cashier' ||
      path === '/mobile'
    );
  }

  // 3. BAKER
  if (role === 'BAKER') {
    // Baker can only access general production batch entry and mobile baker station
    if (path === '/production/history') return false;
    return (
      path === '/production' ||
      path === '/mobile/baker' ||
      path === '/mobile'
    );
  }

  // 4. CAKE WORKER
  if (role === 'CAKE_WORKER') {
    if (path === '/production/history') return false;
    return (
      path === '/production' ||
      path === '/mobile'
    );
  }

  // 5. SAMBUSA WORKER
  if (role === 'SAMBUSA_WORKER') {
    if (path === '/production/history') return false;
    return (
      path === '/production' ||
      path === '/mobile/sambusa' ||
      path === '/mobile'
    );
  }

  // 6. STOCK KEEPER
  if (role === 'STOCK_KEEPER') {
    return (
      path === '/stock' ||
      path.startsWith('/stock/') ||
      path === '/stock-movements' ||
      path.startsWith('/stock-movements/')
    );
  }

  // 7. GENERAL EMPLOYEE
  if (role === 'EMPLOYEE') {
    // Employee can strictly only view /my-profile
    return false;
  }

  return false;
}
