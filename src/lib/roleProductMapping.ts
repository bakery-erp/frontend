/**
 * Role-Based Product & Production Station Scoping Utility
 *
 * Ensures bakery floor workers (Bakers, Cake Workers, Sambusa Workers) only see
 * and interact with the catalog products and ingredients relevant to their role,
 * eliminating cognitive overload, confusion, and wrong product logging.
 */

export type ProductionRole = 'OWNER' | 'ADMIN' | 'BAKER' | 'CAKE_WORKER' | 'SAMBUSA_WORKER' | 'STOCK_KEEPER' | 'CASHIER' | 'EMPLOYEE';

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
  unitType?: string;
  currentQuantity?: number | string;
}

// Normalized keywords for matching category and product names
const BAKER_KEYWORDS = [
  'bread', 'machine', 'loaf', 'bun', 'roll', 'baguette', 'toast', 'donut',
  'doughnut', 'bomboloni', 'croissant', 'dabbo', 'dabboo', 'bakery', 'ዳቦ', 'ቦምቦሊኖ'
];

const CAKE_KEYWORDS = [
  'cake', 'cupcake', 'torte', 'sponge', 'gateau', 'tart', 'dessert',
  'sweet', 'fondant', 'icing', 'crepe', 'muffin', 'keek', 'keekii', 'ኬክ', 'ፓስትሪ'
];

const SAMBUSA_KEYWORDS = [
  'sambusa', 'sambuusa', 'spring', 'roll', 'fetira', 'pizza', 'sandwich',
  'wrap', 'sheet', 'snack', 'pie', 'pasty', 'pastry', 'lentil', 'meat', 'ሳምቡሳ', 'ፒዛ', 'ሳንድዊች', 'ፈጢራ'
];

/**
 * Returns true if the user role has full admin access across all production lines.
 */
export function isGlobalAdminRole(role?: string): boolean {
  return role === 'ADMIN' || role === 'OWNER';
}

/**
 * Validates whether a category is appropriate for a worker's role.
 */
export function isCategoryAllowedForRole(category: CategoryLike | string | null | undefined, role?: string): boolean {
  if (!role || isGlobalAdminRole(role)) return true;

  const catName = typeof category === 'string' ? category : category?.name;
  const catType = typeof category === 'object' ? category?.type : undefined;
  const catProdRole = typeof category === 'object' ? category?.productionRole : undefined;

  // Direct explicit match on database productionRole
  if (catProdRole) {
    return catProdRole === role;
  }

  // Resell categories should never be logged in production
  if (catType === 'RESELL') return false;
  if (!catName) return true;

  const normalized = catName.toLowerCase();

  if (role === 'SAMBUSA_WORKER') {
    // If category has sambusa, snack, or pastry (e.g. "Pastry & Snacks")
    if (normalized.includes('sambusa') || normalized.includes('snack') || normalized.includes('pastry')) {
      return true;
    }
    return SAMBUSA_KEYWORDS.some(k => normalized.includes(k));
  }

  if (role === 'BAKER') {
    const hasCake = CAKE_KEYWORDS.some(k => normalized.includes(k));
    const hasSambusa = SAMBUSA_KEYWORDS.some(k => normalized.includes(k));
    if (hasCake || hasSambusa) return false;

    return BAKER_KEYWORDS.some(k => normalized.includes(k)) || normalized.includes('bread');
  }

  if (role === 'CAKE_WORKER') {
    const hasBread = BAKER_KEYWORDS.some(k => normalized.includes(k));
    const hasSambusa = normalized.includes('sambusa') || normalized.includes('snack');
    if (hasBread || hasSambusa) return false;

    return CAKE_KEYWORDS.some(k => normalized.includes(k));
  }

  return true;
}

/**
 * Validates whether a specific product is produced by the specified worker role.
 */
export function isProductAllowedForRole(product: ProductLike, role?: string): boolean {
  if (!role || isGlobalAdminRole(role)) return true;

  // Never allow resell products in production batches
  if (product.category?.type === 'RESELL') return false;

  // 1. Direct explicit category productionRole match
  const catProdRole = product.category?.productionRole || product.category?.parent?.productionRole;
  if (catProdRole) {
    return catProdRole === role;
  }

  const pName = (product.name || '').toLowerCase();
  const cName = (product.category?.name || '').toLowerCase();
  const parentName = (product.category?.parent?.name || '').toLowerCase();

  // 2. Check if product name itself contains explicit Sambusa keywords
  const isExplicitSambusa = SAMBUSA_KEYWORDS.some(k => pName.includes(k));
  if (isExplicitSambusa) {
    return role === 'SAMBUSA_WORKER';
  }

  // 3. Check if product name itself contains explicit Baker / Bread keywords
  const isExplicitBread = BAKER_KEYWORDS.some(k => pName.includes(k));
  if (isExplicitBread) {
    return role === 'BAKER';
  }

  // 4. Check if product name itself contains explicit Cake keywords
  const isExplicitCake = CAKE_KEYWORDS.some(k => pName.includes(k));
  if (isExplicitCake) {
    return role === 'CAKE_WORKER';
  }

  // 5. Fallback matching via category name
  const catText = `${cName} ${parentName}`;

  if (role === 'SAMBUSA_WORKER') {
    if (catText.includes('sambusa') || catText.includes('snack') || (catText.includes('pastry') && !catText.includes('cake'))) {
      return true;
    }
    return SAMBUSA_KEYWORDS.some(k => catText.includes(k));
  }

  if (role === 'CAKE_WORKER') {
    if (catText.includes('sambusa') || catText.includes('snack')) return false;
    return CAKE_KEYWORDS.some(k => catText.includes(k));
  }

  if (role === 'BAKER') {
    if (catText.includes('sambusa') || catText.includes('cake') || catText.includes('snack')) return false;
    return BAKER_KEYWORDS.some(k => catText.includes(k)) || catText.includes('bread');
  }

  return true;
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
