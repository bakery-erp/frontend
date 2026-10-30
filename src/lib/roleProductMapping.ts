/**
 * Role-Based Product & Production Station Scoping Utility
 *
 * 100% database-driven role mapping based on category.productionRole.
 * Eliminates keyword guessing and enforces backend database consistency.
 */

export type ProductionRole =
  | 'OWNER'
  | 'ADMIN'
  | 'BAKER'
  | 'CAKE_WORKER'
  | 'SAMBUSA_WORKER'
  | 'STOCK_KEEPER'
  | 'CASHIER'
  | 'EMPLOYEE';

export interface CategoryLike {
  id?: string;
  name?: string;
  type?: string;
  productionRole?: string | null;
  parentId?: string | null;
  parent?: { id?: string; name?: string; type?: string; productionRole?: string | null } | null;
}

export interface ProductLike {
  id?: string;
  name: string;
  flavor?: string | null;
  category?: CategoryLike | null;
}

export interface StockItemLike {
  id?: string;
  name: string;
  nameLatin?: string | null;
  category?: string | null;
  categoryLatin?: string | null;
  unitType?: string;
  currentQuantity?: number | string;
  allowedRoles?: string[];
}

/**
 * Returns true if the user role has full admin access across all production lines.
 */
export function isGlobalAdminRole(role?: string): boolean {
  return role === 'ADMIN' || role === 'OWNER';
}

/**
 * Validates whether a raw stock material is allowed to be viewed/consumed by a worker's role.
 * - OWNER has access to all materials.
 * - If allowedRoles is empty or undefined, only OWNER can access it.
 * - Otherwise, the worker's role must be explicitly in allowedRoles.
 */
export function isStockItemAllowedForRole(item: StockItemLike, role?: string): boolean {
  if (role === 'OWNER') return true;
  if (!item.allowedRoles || item.allowedRoles.length === 0) return false;
  return !!role && item.allowedRoles.includes(role);
}

/**
 * Validates whether a category is appropriate for a worker's role using database productionRole.
 */
export function isCategoryAllowedForRole(category: CategoryLike | string | null | undefined, role?: string): boolean {
  if (!role || isGlobalAdminRole(role)) return true;
  if (!category) return false;

  // Resell categories should never be logged in production
  if (typeof category === 'object' && category.type === 'RESELL') return false;

  const prodRole = typeof category === 'object'
    ? (category.productionRole || category.parent?.productionRole)
    : null;

  if (prodRole) {
    return prodRole === role;
  }

  // If no productionRole is set, only global admins can access
  return isGlobalAdminRole(role);
}

/**
 * Validates whether a specific product is produced by the specified worker role.
 * Derived purely from the product category's database productionRole.
 */
export function isProductAllowedForRole(product: ProductLike, role?: string): boolean {
  if (!role || isGlobalAdminRole(role)) return true;

  // Never allow resell products in production batches
  if (product.category?.type === 'RESELL') return false;

  const prodRole = product.category?.productionRole || product.category?.parent?.productionRole;
  if (prodRole) {
    return prodRole === role;
  }

  // If unassigned, only global admins can produce
  return isGlobalAdminRole(role);
}

/**
 * Filters a list of products by both role and assigned branch.
 */
export function filterProductsByRoleAndBranch<T extends ProductLike>(
  products: T[],
  role?: string,
  branchId?: string | null
): T[] {
  return products.filter((p) => {
    // Role filter
    if (!isProductAllowedForRole(p, role)) return false;

    // Branch filter if product has branch specificity or active branch attached
    if (branchId && (p as any).branchId && (p as any).branchId !== branchId) {
      return false;
    }

    return true;
  });
}

/**
 * Returns station branding and label for the worker's production interface.
 */
export function getStationMeta(role?: string): {
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
} {
  switch (role) {
    case 'BAKER':
      return {
        title: 'Bakery & Bread Station',
        subtitle: 'Log daily bread, buns, rolls, and baguette production',
        badge: 'Baker Station',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    case 'CAKE_WORKER':
      return {
        title: 'Cake & Pastry Station',
        subtitle: 'Log birthday cakes, decorated pastries, and sweet desserts',
        badge: 'Cake Station',
        badgeColor: 'bg-pink-100 text-pink-800 border-pink-300',
      };
    case 'SAMBUSA_WORKER':
      return {
        title: 'Sambusa & Snack Station',
        subtitle: 'Log sambusa, fetira, pizza, and quick fried snacks',
        badge: 'Sambusa Station',
        badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
      };
    default:
      return {
        title: 'Production Logging',
        subtitle: 'Select produced items and consumed raw materials',
        badge: 'All Production Lines',
        badgeColor: 'bg-[#EDE4D5] text-[#4A2E1B] border-[#D8C7B5]',
      };
  }
}
