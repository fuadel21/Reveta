export const COMPARISON_STORAGE_KEY = 'reveta-product-comparison';
export const COMPARISON_EVENT = 'reveta-comparison-updated';
export const MAX_COMPARISON_PRODUCTS = 4;

export const getComparedProductIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COMPARISON_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_COMPARISON_PRODUCTS) : [];
  } catch {
    return [];
  }
};

export const setComparedProductIds = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  const unique = [...new Set(ids)].slice(0, MAX_COMPARISON_PRODUCTS);
  window.localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(unique));
  window.dispatchEvent(new CustomEvent(COMPARISON_EVENT, { detail: unique }));
};

export const toggleComparedProduct = (productId: string) => {
  const current = getComparedProductIds();
  if (current.includes(productId)) {
    const next = current.filter((id) => id !== productId);
    setComparedProductIds(next);
    return { ids: next, added: false, limitReached: false };
  }
  if (current.length >= MAX_COMPARISON_PRODUCTS) {
    return { ids: current, added: false, limitReached: true };
  }
  const next = [...current, productId];
  setComparedProductIds(next);
  return { ids: next, added: true, limitReached: false };
};
