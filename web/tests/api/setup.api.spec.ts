import { expect, test } from '@playwright/test';
import { withDockerHubStub } from '../helpers/dockerHubStub';
import { withLarkWebhookStub } from '../helpers/larkWebhookStub';

const adminUsername = 'apitestroot';
const adminPassword = 'apitest-password';
const dockerHubStubPort = 3403;
const larkWebhookStubPort = 3404;

async function loginAsRoot(request: import('@playwright/test').APIRequestContext) {
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
  return loginBody.data.id as number;
}

test.describe.serial('API baseline', () => {
  test('status endpoint exposes uninitialized system state', async ({ request }) => {
    const response = await request.get('/api/status');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.setup).toBe(false);
    expect(body.data.system_name).toBeTruthy();
    expect(body.data.version).toBe('v0.11.5');
    expect(body.data.app_version).toBeTruthy();
    expect(body.data.docker_image_repository).toBe('playwright/new-api');
    expect(body.data.docker_image_tag).toBe('v0.11.5');
  });

  test('home page content endpoint defaults to empty content', async ({ request }) => {
    const response = await request.get('/api/home_page_content');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBe('');
  });

  test('docker version endpoint reports the latest published docker tag', async ({ request }) => {
    await withDockerHubStub(
      dockerHubStubPort,
      {
        results: [
          { name: 'latest', last_updated: '2026-03-21T10:00:00Z' },
          { name: 'v0.11.6', last_updated: '2026-03-21T10:00:00Z' },
          { name: 'v0.11.5', last_updated: '2026-03-20T10:00:00Z' },
        ],
      },
      async () => {
        const response = await request.get('/api/status/docker-version');
        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data.repository).toBe('playwright/new-api');
        expect(body.data.current_tag).toBe('v0.11.5');
        expect(body.data.latest_tag).toBe('v0.11.6');
        expect(body.data.update_available).toBe(true);
      },
    );
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

    await loginAsRoot(request);

    const setupStatusResponse = await request.get('/api/setup');
    expect(setupStatusResponse.ok()).toBeTruthy();

    const setupStatusBody = await setupStatusResponse.json();
    expect(setupStatusBody.success).toBe(true);
    expect(setupStatusBody.data.status).toBe(true);
  });

  test('contact feedback can be submitted and reviewed by admin', async ({ request }) => {
    const submitResponse = await request.post('/api/contact/feedback', {
      data: {
        username: 'API Feedback User',
        email: 'feedback@example.com',
        category: 'bug',
        content: 'A reproducible bug appears after opening the contact page in playwright api tests.',
      },
    });
    expect(submitResponse.ok()).toBeTruthy();

    const submitBody = await submitResponse.json();
    expect(submitBody.success).toBe(true);

    const rootUserId = await loginAsRoot(request);

    const listResponse = await request.get('/api/user/feedback?p=1&page_size=10', {
      headers: {
        'New-API-User': String(rootUserId),
      },
    });
    expect(listResponse.ok()).toBeTruthy();

    const listBody = await listResponse.json();
    expect(listBody.success).toBe(true);
    expect(listBody.data.items.length).toBeGreaterThan(0);
    expect(
      listBody.data.items.some(
        (item: { username: string; email: string; category: string }) =>
          item.username === 'API Feedback User' &&
          item.email === 'feedback@example.com' &&
          item.category === 'bug',
      ),
    ).toBe(true);
  });

  test('root can upload a logo image and receive a hosted path', async ({ request }) => {
    const rootUserId = await loginAsRoot(request);

    const uploadResponse = await request.post('/api/upload/logo', {
      headers: {
        'New-API-User': String(rootUserId),
      },
      multipart: {
        file: {
          name: 'logo.png',
          mimeType: 'image/png',
          buffer: Buffer.from('fake-png-content'),
        },
      },
    });
    expect(uploadResponse.ok()).toBeTruthy();

    const uploadBody = await uploadResponse.json();
    expect(uploadBody.success).toBe(true);
    expect(uploadBody.data.url).toMatch(/^\/uploads\/branding\/logo-\d+\.png$/);
  });

  test('submitting feedback triggers the configured lark webhook', async ({ request }) => {
    await withLarkWebhookStub(larkWebhookStubPort, async (requests) => {
      const rootUserId = await loginAsRoot(request);
      const rootHeaders = {
        'New-API-User': String(rootUserId),
      };

      const optionsToUpdate = [
        { key: 'fetch_setting.enable_ssrf_protection', value: false },
        {
          key: 'FeedbackLarkWebhookURL',
          value: `https://127.0.0.1:${larkWebhookStubPort}/feedback`,
        },
        { key: 'FeedbackLarkWebhookSecret', value: 'playwright-lark-secret' },
        { key: 'FeedbackLarkWebhookMentionAllEnabled', value: true },
        { key: 'FeedbackLarkWebhookMentionOpenIDs', value: 'ou_alpha,ou_beta' },
        { key: 'FeedbackLarkWebhookEnabled', value: true },
      ];

      for (const option of optionsToUpdate) {
        const response = await request.put('/api/option/', {
          headers: rootHeaders,
          data: option,
        });
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(body.success).toBe(true);
      }

      const submitResponse = await request.post('/api/contact/feedback', {
        data: {
          username: 'Lark Feedback User',
          email: 'lark-feedback@example.com',
          category: 'consulting',
          content: 'Please send this feedback to the configured lark webhook for verification.',
        },
      });
      expect(submitResponse.ok()).toBeTruthy();
      const submitBody = await submitResponse.json();
      expect(submitBody.success).toBe(true);

      expect(requests.length).toBe(1);
      expect(requests[0].body.msg_type).toBe('interactive');
      expect(requests[0].body.timestamp).toBeTruthy();
      expect(requests[0].body.sign).toBeTruthy();
      expect(requests[0].body.card.header.title.content).toContain('反馈');
      expect(requests[0].body.card.elements[0].text.content).toContain(
        'lark-feedback@example.com',
      );
      expect(requests[0].body.card.elements[0].text.content).toContain('<at id=all></at>');
      expect(requests[0].body.card.elements[0].text.content).toContain(
        '<at id=ou_alpha></at>',
      );
    });
  });
});
