export const billingDisplayTextKeys = {
  wallet: 'wallet',
  walletManagement: 'walletManagement',
  walletDescription: 'walletDescription',
  addFunds: 'addFunds',
  orderHistory: 'orderHistory',
  balance: 'balance',
  currentBalance: 'currentBalance',
  remainingQuota: 'remainingQuota',
  totalConsumedQuota: 'totalConsumedQuota',
  quota: 'quota',
  totalQuota: 'totalQuota',
  rawQuota: 'rawQuota',
  quotaReset: 'quotaReset',
  walletFirst: 'walletFirst',
  walletOnly: 'walletOnly',
  transferToBalance: 'transferToBalance',
  topupAmount: 'topupAmount',
  selectTopupAmount: 'selectTopupAmount',
  redemptionTopup: 'redemptionTopup',
  redeemQuota: 'redeemQuota',
  topupConfirm: 'topupConfirm',
  topupBill: 'topupBill',
  noTopupRecords: 'noTopupRecords',
  availableInvitationQuota: 'availableInvitationQuota',
  transferInvitationQuota: 'transferInvitationQuota',
}

const defaultText = {
  wallet: '钱包',
  walletManagement: '钱包管理',
  walletDescription: '钱包管理和个人偏好设置。',
  addFunds: '账户充值',
  orderHistory: '充值账单',
  balance: '余额',
  currentBalance: '当前余额',
  remainingQuota: '剩余额度',
  totalConsumedQuota: '总消耗额度',
  quota: '额度',
  totalQuota: '总额度',
  rawQuota: '原生额度',
  quotaReset: '额度重置',
  walletFirst: '优先钱包',
  walletOnly: '仅用钱包',
  transferToBalance: '划转到余额',
  topupAmount: '充值数量',
  selectTopupAmount: '选择充值额度',
  redemptionTopup: '兑换码充值',
  redeemQuota: '兑换额度',
  topupConfirm: '充值确认',
  topupBill: '充值账单',
  noTopupRecords: '暂无充值记录',
  availableInvitationQuota: '可用邀请额度',
  transferInvitationQuota: '划转额度',
};

const publicWelfareText = {
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
  selectTopupAmount: '选择支持额度',
  redemptionTopup: '兑换码支持',
  redeemQuota: '兑换点数',
  topupConfirm: '支持确认',
  topupBill: '支持记录',
  noTopupRecords: '暂无支持记录',
  availableInvitationQuota: '可用邀请点数',
  transferInvitationQuota: '转入点数',
};

export function getBillingDisplayText(key, t, publicWelfareTextEnabled) {
  if (publicWelfareTextEnabled) {
    return publicWelfareText[key] || defaultText[key] || key;
  }
  return t(defaultText[key] || key);
}

export function isPublicWelfareBillingDisplay(display) {
  return display?.public_welfare_text_enabled === true;
}
