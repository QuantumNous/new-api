import https from 'node:https';

const key = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGCdOPJc6BU2x1
2GN/qGgc7WVEf1RXU0Am27Zt2kA+xmS53y8WH2wmGgK6dCRrqw5WOMvki7yqrB3R
XEvFZGJnBN4b9CE986HKLjqK/QlPzkxsjOB5rqzgaOz1Rc0lhg+2VGdOzpBPafOy
JX7wUQOaN83x+1rTjNR4OocR3Wr36SObSw48Oo32u3uarRG/wmlgRRW957tx6pP6
Sqh2994q7eZ9t3wGbL9espKrxQOyObQRsmdqRPSVJht7rbzuqiTmh4huLQJ9Lg5y
xBxR4OOoEay5mUzlDkIERl8ZrYqk/YtdY8stHAEO8mWcbU+oXrz2l1x+j4BC0coL
1bkmR/r7AgMBAAECggEAAIhxHHO5c/kcmtEO/AgWI77u+VVWOcW0P9TGdBDHWtRM
kK2/lfH3nsFAupfifCHyuJftchACR8BRRSJG71bWPC/isAiOEvP6oGO9DrsOJLaY
6Lq4TEZLcURhgvqI0ZrsyQbG4+3igY727WpS9M5dOq5K18JFqZuR1SuF6RVHx5Yh
Mh9xGmMXuPbBIn4ecUcZbXfhq79euDKkfRaL81dwmzvbE5mHn395zV4z3AcRj+bB
sVifUFAUlw1h0Zf6tHP6zg/lU3W4CUltc8ANiV1C73KM4Ak2izAIQ0YoZZcB8Kr2
ptWeDqNr986hwvsn9fBw0rbdA3z5TYV0wICZOZc5EQKBgQDxuPnQCsur2E0FcrqJ
Ch7LWlm+RvM4AneBbmRjtv/K5RQRah8LHzgYxgirZAM6DjwRAr+uJbwZIKEAZ1kA
EYfZ3URKsdm8Cq8fRnyDY4fWWx6ZiQL1qHATsKdgF8hKArlb5tqjJgXzemjKOaM6
zO6t0XVSXrmJgS8awFguOrKNcwKBgQDRvFA+ht5cs17Q8dDB6Q4oXZGNvhCCpdWU
ATTbndYrnaG9YCQgIcDn6vLv++x2WuuTtj8bMWL+KGQUuTJJj7PaqrIVgad4PR62
xdZGVpUpi0pNXAbFjJLtmsPIq7Lg66YBBJelHQdEvmR4qYEVFbFaOTZ8b3mhzmCh
49ISiwR6WQKBgE+a+nJgS8jxOBRWP0ZIVfHkdG+skAbfERpID7mjF8RrAtvlVgnk
oyXNeidvjXx+GZwEirnAZZzk2QD4CCB0pYfDTe1HewxpfFjRbsoaai7W3VH1BEuA
yEBDyitkSarOENtKQLDAIe+YXZBTwQTpXqVRuNCCr5mwOKIXvDKlVA4vAoGAcLkM
S77CzgHdiOEeeMmgQVOgwhSP3RfyBTzswsg+7mwnHJgKcnaRrlPZQ+AbQ7Uz/cyq
eBv//2eH+pdajqy8Vl79nY90iawX0NXdhypLuutRAOjf/tbBtRBD/5tAZaBhNRTZ
x/UlDe5iI3O+m61wB3TOcuya67r2tquyISM0QekCgYEAnhcLrAbpLz0bXpqJcyvb
XoK/l0jBlzeiEBPPB5BbNp421uLlqCMypTZcIdAEyEGMC+hVjQt6tC9VEoEG/uTp
DZq6czqy0FPagDmbcBhgDjDaU0xVuhjBmW2t1i9NFI/PHno+8RCW3busFb1sT0zU
a3FyHuVHmwaym+yshAz/er0=
-----END PRIVATE KEY-----`;

const cert = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUGel5XLK4BrbLRVxg3+cK7F/XJAYwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJMTI3LjAuMC4xMB4XDTI2MDMyMTE2MzYwOVoXDTI2MDMy
MjE2MzYwOVowFDESMBAGA1UEAwwJMTI3LjAuMC4xMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAxgnTjyXOgVNsddhjf6hoHO1lRH9UV1NAJtu2bdpAPsZk
ud8vFh9sJhoCunQka6sOVjjL5Iu8qqwd0VxLxWRiZwTeG/QhPfOhyi46iv0JT85M
bIzgea6s4Gjs9UXNJYYPtlRnTs6QT2nzsiV+8FEDmjfN8fta04zUeDqHEd1q9+kj
m0sOPDqN9rt7mq0Rv8JpYEUVvee7ceqT+kqodvfeKu3mfbd8Bmy/XrKSq8UDsjm0
EbJnakT0lSYbe6287qok5oeIbi0CfS4OcsQcUeDjqBGsuZlM5Q5CBEZfGa2KpP2L
XWPLLRwBDvJlnG1PqF689pdcfo+AQtHKC9W5Jkf6+wIDAQABo1MwUTAdBgNVHQ4E
FgQUkXE7g0MXB8yRyQKFG/iK1/IWykQwHwYDVR0jBBgwFoAUkXE7g0MXB8yRyQKF
G/iK1/IWykQwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEALcrI
wiCQdplgzTwNoiGHOI2jPQRZ+6vRzGgfCE+xOJKv0/0pVtz2U06jbil4dBcTWVCx
5ebGOD8TU5wFIP3IOgxcsjaKUJblf/Nd0Y3RnO50313rxJsEgnJIghPbyIxs0ZAx
/3gUYZf0cht2fTe5Yn42/HNx9SgrLIYjvh86J1cVzsn8ELxsbJKm7umCey0BKL6r
wHhDePIh4wQixSEDAXgFy8aVWgnK/94ttd1rYqT+G56xZdwX1sLryRRtUl6FyYl+
C+fXCbr/P9zcLm5J0Mxah0y84YuRKY2RPxnPHJ0d/9Je3DpGdmURNjMe2dMN1AJ3
/fYqoOqMNRF3SS4mxA==
-----END CERTIFICATE-----`;

export type LarkWebhookRequest = {
  headers: Record<string, string>;
  body: any;
};

export async function withLarkWebhookStub(
  port: number,
  run: (requests: LarkWebhookRequest[]) => Promise<void>,
): Promise<void> {
  const requests: LarkWebhookRequest[] = [];
  const server = https.createServer({ key, cert }, (req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf-8');
      requests.push({
        headers: Object.fromEntries(
          Object.entries(req.headers).map(([headerKey, headerValue]) => [
            headerKey,
            Array.isArray(headerValue) ? headerValue.join(',') : headerValue ?? '',
          ]),
        ),
        body: rawBody ? JSON.parse(rawBody) : {},
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 0, msg: 'success', data: {} }));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  try {
    await run(requests);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}
