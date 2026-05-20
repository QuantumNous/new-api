const CHECKOUT_STORAGE_PREFIX = 'subscription-epay-checkout:';
const CHECKOUT_STORAGE_TTL_MS = 10 * 60 * 1000;

const getStorageKey = (tradeNo) => `${CHECKOUT_STORAGE_PREFIX}${tradeNo}`;

export const saveSubscriptionEpayCheckout = ({ tradeNo, url, params }) => {
  if (!tradeNo || !url) return;

  sessionStorage.setItem(
    getStorageKey(tradeNo),
    JSON.stringify({
      tradeNo,
      url,
      params: params || {},
      createdAt: Date.now(),
    }),
  );
};

export const readSubscriptionEpayCheckout = (tradeNo) => {
  if (!tradeNo) return null;

  const raw = sessionStorage.getItem(getStorageKey(tradeNo));
  if (!raw) return null;

  try {
    const checkout = JSON.parse(raw);
    if (Date.now() - Number(checkout.createdAt || 0) > CHECKOUT_STORAGE_TTL_MS) {
      clearSubscriptionEpayCheckout(tradeNo);
      return null;
    }
    if (!checkout.url || !checkout.params) return null;
    return checkout;
  } catch (e) {
    clearSubscriptionEpayCheckout(tradeNo);
    return null;
  }
};

export const clearSubscriptionEpayCheckout = (tradeNo) => {
  if (!tradeNo) return;
  sessionStorage.removeItem(getStorageKey(tradeNo));
};

export const markSubscriptionEpayCheckoutOpened = (tradeNo) => {
  const checkout = readSubscriptionEpayCheckout(tradeNo);
  if (!checkout) return null;

  const nextCheckout = {
    ...checkout,
    openedAt: Date.now(),
  };
  sessionStorage.setItem(getStorageKey(tradeNo), JSON.stringify(nextCheckout));
  return nextCheckout;
};

export const submitSubscriptionEpayCheckout = (checkout, target) => {
  if (!checkout?.url) return false;

  const form = document.createElement('form');
  form.action = checkout.url;
  form.method = 'POST';
  form.target = target;

  Object.keys(checkout.params || {}).forEach((key) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = checkout.params[key];
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
  return true;
};
