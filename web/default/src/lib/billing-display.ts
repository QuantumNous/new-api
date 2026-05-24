import i18next from 'i18next'

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

const PUBLIC_WELFARE_ZH: Record<BillingDisplayTextKey, string> = {
  wallet: '支持中心',
  walletManagement: '支持中心',
  walletDescription: '项目支持和个人偏好设置。',
  addFunds: '项目支持',
  orderHistory: '支持记录',
  balance: '可用点数',
  currentBalance: '当前可用点数',
  remainingQuota: '剩余模型点数',
  totalConsumedQuota: '总消耗点数',
  quota: '模型点数',
  totalQuota: '总点数',
  rawQuota: '系统原生点数',
  quotaReset: '点数重置',
  walletFirst: '优先可用点数',
  walletOnly: '仅用可用点数',
  transferToBalance: '转入可用点数',
  topupAmount: '支持数量',
  topupConfirm: '支持确认',
  topupBill: '支持记录',
  noTopupRecords: '暂无支持记录',
  availableInvitationQuota: '可用邀请点数',
  transferInvitationQuota: '转入点数',
}

const PUBLIC_WELFARE_EN: Record<BillingDisplayTextKey, string> = {
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

function isChineseLanguage() {
  return (i18next.resolvedLanguage || i18next.language || '')
    .toLowerCase()
    .startsWith('zh')
}

export function getBillingDisplayText(
  key: BillingDisplayTextKey,
  t: (key: string) => string,
  mode?: BillingDisplayMode
) {
  if (!mode?.publicWelfareTextEnabled) {
    return t(DEFAULT_KEYS[key])
  }

  const publicTexts = isChineseLanguage() ? PUBLIC_WELFARE_ZH : PUBLIC_WELFARE_EN
  return publicTexts[key]
}

export function isPublicWelfareBillingDisplay(mode?: BillingDisplayMode) {
  return mode?.publicWelfareTextEnabled === true
}
