export type BillingDisplayMode = {
  publicWelfareTextEnabled?: boolean
}

export type BillingDisplayTextKey =
  | 'wallet'
  | 'walletManagement'
  | 'walletDescription'
  | 'addFunds'
  | 'orderHistory'
  | 'balance'
  | 'currentBalance'
  | 'remainingQuota'
  | 'totalConsumedQuota'
  | 'quota'
  | 'totalQuota'
  | 'rawQuota'
  | 'quotaReset'
  | 'walletFirst'
  | 'walletOnly'
  | 'transferToBalance'
  | 'topupAmount'
  | 'topupConfirm'
  | 'topupBill'
  | 'noTopupRecords'
  | 'availableInvitationQuota'
  | 'transferInvitationQuota'

const DEFAULT_KEYS: Record<BillingDisplayTextKey, string> = {
  wallet: 'Wallet',
  walletManagement: 'Wallet Management',
  walletDescription: 'Wallet management and personal preferences.',
  addFunds: 'Add Funds',
  orderHistory: 'Order History',
  balance: 'Balance',
  currentBalance: 'Current Balance',
  remainingQuota: 'Remaining quota',
  totalConsumedQuota: 'Total consumed quota',
  quota: 'Quota',
  totalQuota: 'Total Quota',
  rawQuota: 'Raw Quota',
  quotaReset: 'Quota Reset',
  walletFirst: 'Wallet First',
  walletOnly: 'Wallet Only',
  transferToBalance: 'Transfer to Balance',
  topupAmount: 'Topup Amount',
  topupConfirm: 'Confirm Payment',
  topupBill: 'Billing History',
  noTopupRecords: 'No billing records found',
  availableInvitationQuota: 'Available Rewards',
  transferInvitationQuota: 'Transfer Amount',
}

const PUBLIC_WELFARE_KEYS: Record<BillingDisplayTextKey, string> = {
  wallet: 'Support Center',
  walletManagement: 'Support Center',
  walletDescription: 'Project support and personal preferences.',
  addFunds: 'Support Project',
  orderHistory: 'Support Records',
  balance: 'Available Points',
  currentBalance: 'Current Points',
  remainingQuota: 'Remaining Model Points',
  totalConsumedQuota: 'Total Consumed Points',
  quota: 'Model Points',
  totalQuota: 'Total Points',
  rawQuota: 'Raw System Points',
  quotaReset: 'Points Reset',
  walletFirst: 'Available Points First',
  walletOnly: 'Available Points Only',
  transferToBalance: 'Transfer to Available Points',
  topupAmount: 'Support Amount',
  topupConfirm: 'Confirm Support',
  topupBill: 'Support Records',
  noTopupRecords: 'No support records found',
  availableInvitationQuota: 'Available Referral Points',
  transferInvitationQuota: 'Transfer Points',
}

export function getBillingDisplayText(
  key: BillingDisplayTextKey,
  t: (key: string) => string,
  mode?: BillingDisplayMode
) {
  if (!mode?.publicWelfareTextEnabled) {
    return t(DEFAULT_KEYS[key])
  }

  return t(PUBLIC_WELFARE_KEYS[key])
}

export function isPublicWelfareBillingDisplay(mode?: BillingDisplayMode) {
  return mode?.publicWelfareTextEnabled === true
}
