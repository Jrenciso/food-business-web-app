export interface OrdersNavigationIntent {
  orderId: string;
  mode: 'details' | 'edit';
  returnToUpdate?: boolean;
}

const storageKey = 'urban-ops-orders-navigation';

export function queueOrdersNavigation(intent: OrdersNavigationIntent) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(intent));
  } catch {
    // The page transition still works when session storage is unavailable.
  }
}

export function consumeOrdersNavigation(): OrdersNavigationIntent | null {
  try {
    const value = sessionStorage.getItem(storageKey);
    sessionStorage.removeItem(storageKey);
    if (!value) return null;
    const intent = JSON.parse(value) as Partial<OrdersNavigationIntent>;
    if (typeof intent.orderId !== 'string' || !intent.orderId ||
      (intent.mode !== 'details' && intent.mode !== 'edit')) return null;
    return { orderId: intent.orderId, mode: intent.mode, returnToUpdate: intent.returnToUpdate === true };
  } catch {
    return null;
  }
}
