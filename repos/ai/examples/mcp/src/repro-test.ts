import 'dotenv/config';

const GITHUB_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';

async function testRefreshAuthorization() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const refreshToken = process.env.GITHUB_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, or GITHUB_REFRESH_TOKEN',
    );
  }

  const headers = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
    // Accept: 'application/json',
    // UNCOMMENT ABOVE TO FIX
  });

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(GITHUB_TOKEN_ENDPOINT, {
    method: 'POST',
    headers,
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }

  const tokens = await response.json();

  if (!tokens.access_token || !tokens.token_type) {
    throw new Error('Invalid token response: missing required fields');
  }

  return tokens;
}

testRefreshAuthorization()
  .then(() => {
    console.log('====== Test passed ======');
    process.exit(0);
  })
  .catch(error => {
    console.log('====== Test failed ======');
    console.error(error.message);
    process.exit(1);
  });
