const promotionLinkReferralStorageKey = 'promotion_link_referral';
const promotionManualReferralStorageKey = 'promotion_manual_referral';

export function persistPromotionLinkReferral(search = window.location.search) {
  const params = new URLSearchParams(search);
  const referral =
    params.get('aff') || params.get('ref') || params.get('promoter') || '';
  const normalizedReferral = referral.trim();
  if (normalizedReferral) {
    localStorage.setItem(promotionLinkReferralStorageKey, normalizedReferral);
  }
  return normalizedReferral;
}

export function getPromotionLinkReferral() {
  return (localStorage.getItem(promotionLinkReferralStorageKey) || '').trim();
}

export function setPromotionManualReferral(value) {
  const normalizedValue = value.trim();
  if (normalizedValue) {
    localStorage.setItem(promotionManualReferralStorageKey, normalizedValue);
  } else {
    localStorage.removeItem(promotionManualReferralStorageKey);
  }
}

export function getPromotionManualReferral() {
  return (localStorage.getItem(promotionManualReferralStorageKey) || '').trim();
}

export function clearPromotionReferral() {
  localStorage.removeItem(promotionLinkReferralStorageKey);
  localStorage.removeItem(promotionManualReferralStorageKey);
}
