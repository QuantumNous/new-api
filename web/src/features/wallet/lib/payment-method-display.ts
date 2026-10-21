export function normalizePaymentMethodName(name: string): string {
  if (name === 'Wechat Pay') return 'WeChat Pay'
  return name
}

export function getPaymentMethodDisplayName(
  name: string,
  t: (key: string) => string
) {
  const normalized = normalizePaymentMethodName(name)
  const translated = t(normalized)
  return translated || normalized
}
