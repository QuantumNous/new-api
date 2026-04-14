export function canAccessWalletManagement(user) {
  return !!user && user.allow_recharge !== false;
}

export function isRechargeRestricted(user) {
  return !!user && user.allow_recharge === false;
}
