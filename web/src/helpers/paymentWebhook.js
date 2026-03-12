export function getPaymentWebhookUrl(serverAddress, provider) {
  const normalizedServerAddress = String(serverAddress || '').trim().replace(
    /\/+$/,
    '',
  );
  const baseUrl = normalizedServerAddress || '网站地址';
  return `${baseUrl}/api/${provider}/webhook`;
}
