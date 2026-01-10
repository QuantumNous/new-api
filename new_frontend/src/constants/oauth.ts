export type OAuthProvider = 'github' | 'discord' | 'oidc' | 'linuxdo' | 'wechat' | 'telegram';

export const PROVIDER_NAMES: Record<OAuthProvider, string> = {
  github: 'GitHub',
  discord: 'Discord',
  oidc: 'OIDC',
  linuxdo: 'LinuxDo',
  wechat: '微信',
  telegram: 'Telegram',
} as const;
