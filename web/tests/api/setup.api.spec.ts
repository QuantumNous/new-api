import { expect, test } from '@playwright/test';

const adminUsername = 'apitestroot';
const adminPassword = 'apitest-password';

test.describe.serial('API baseline', () => {
  test('status endpoint exposes uninitialized system state', async ({ request }) => {
    const response = await request.get('/api/status');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.setup).toBe(false);
    expect(body.data.system_name).toBeTruthy();
  });

  test('setup endpoint reports sqlite before initialization', async ({ request }) => {
    const response = await request.get('/api/setup');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe(false);
    expect(body.data.root_init).toBe(false);
    expect(body.data.database_type).toBe('sqlite');
  });

  test('setup rejects too-short admin passwords', async ({ request }) => {
    const response = await request.post('/api/setup', {
      data: {
        username: adminUsername,
        password: 'short',
        confirmPassword: 'short',
        SelfUseModeEnabled: false,
        DemoSiteEnabled: false,
      },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('至少为8个字符');
  });

  test('setup can initialize the system and create an authenticated root session', async ({ request }) => {
    const setupResponse = await request.post('/api/setup', {
      data: {
        username: adminUsername,
        password: adminPassword,
        confirmPassword: adminPassword,
        SelfUseModeEnabled: false,
        DemoSiteEnabled: false,
      },
    });
    expect(setupResponse.ok()).toBeTruthy();

    const setupBody = await setupResponse.json();
    expect(setupBody.success).toBe(true);

    const loginResponse = await request.post('/api/user/login', {
      data: {
        username: adminUsername,
        password: adminPassword,
      },
    });
    expect(loginResponse.ok()).toBeTruthy();

    const loginBody = await loginResponse.json();
    expect(loginBody.success).toBe(true);
    expect(loginBody.data.username).toBe(adminUsername);
    expect(loginBody.data.role).toBe(100);

    const setupStatusResponse = await request.get('/api/setup');
    expect(setupStatusResponse.ok()).toBeTruthy();

    const setupStatusBody = await setupStatusResponse.json();
    expect(setupStatusBody.success).toBe(true);
    expect(setupStatusBody.data.status).toBe(true);
  });
});
