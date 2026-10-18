// Built-in expense categories ('Other' is always listed last)
export const DEFAULT_EXPENSE_CATEGORIES = ['Food & Dining', 'Transport', 'Shopping', 'Entertainment', 'Other'];

export const MAX_CATEGORY_NAME_LENGTH = 24;

/**
 * Full category list: built-ins, then the user's own, then any other category found on
 * saved expenses (e.g. from a restored backup), with 'Other' last and no case-insensitive duplicates.
 */
export function getExpenseCategories(customCategories = [], usedCategories = []) {
  // 'other' is reserved so the built-in spelling is always used, and it goes last
  const seen = new Set(['other']);
  const result = [];
  const add = (cat) => {
    const name = (cat || '').trim();
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    result.push(name);
  };
  DEFAULT_EXPENSE_CATEGORIES.filter((c) => c !== 'Other').forEach(add);
  customCategories.forEach(add);
  usedCategories.forEach(add);
  result.push('Other');
  return result;
}

export function isDefaultExpenseCategory(name) {
  return DEFAULT_EXPENSE_CATEGORIES.some((c) => c.toLowerCase() === (name || '').trim().toLowerCase());
}
