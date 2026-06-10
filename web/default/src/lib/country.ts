const COUNTRY_NAMES: Record<string, string> = {
  CN: '中国', TW: '台湾', HK: '香港', MO: '澳门',
  US: '美国', GB: '英国', JP: '日本', KR: '韩国',
  SG: '新加坡', MY: '马来西亚', ID: '印尼', TH: '泰国',
  VN: '越南', PH: '菲律宾', IN: '印度', AU: '澳大利亚',
  CA: '加拿大', DE: '德国', FR: '法国', RU: '俄罗斯',
  BR: '巴西', MX: '墨西哥', NL: '荷兰', SE: '瑞典',
  CH: '瑞士', IT: '意大利', ES: '西班牙', PL: '波兰',
  TR: '土耳其', SA: '沙特', AE: '阿联酋', IL: '以色列',
  NZ: '新西兰', NO: '挪威', FI: '芬兰', DK: '丹麦',
  PT: '葡萄牙', CZ: '捷克', RO: '罗马尼亚', HU: '匈牙利',
  UA: '乌克兰', PK: '巴基斯坦', BD: '孟加拉',
  NG: '尼日利亚', ZA: '南非', EG: '埃及', KE: '肯尼亚',
  AR: '阿根廷', CO: '哥伦比亚', CL: '智利',
}

/** Format a 2-letter country code as "TW（台湾）". Falls back to just the code. */
export function formatCountry(code: string | undefined | null): string {
  if (!code) return '—'
  const upper = code.toUpperCase()
  const name = COUNTRY_NAMES[upper]
  return name ? `${upper}（${name}）` : upper
}
