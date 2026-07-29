/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from 'bun:test';

const apiCalls = [];
const buttonProps = [];
let latestModalProps;
let requestIdSeed = 0;
let SubscriptionPlansCard;
const apiPost = mock(async (url, body) => {
  apiCalls.push({ url, body });
  return {
    data: {
      message: 'success',
      data: { pay_link: 'https://stripe.example.test' },
    },
  };
});

const originalGlobalPropertyDescriptors = new Map();

function defineTestGlobal(key, value) {
  if (!originalGlobalPropertyDescriptors.has(key)) {
    originalGlobalPropertyDescriptors.set(
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    );
  }
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value,
    writable: true,
  });
}

function restoreTestGlobals() {
  for (const [key, descriptor] of originalGlobalPropertyDescriptors) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, key);
    }
  }
}

function setupDom() {
  class NodeShim {
    constructor() {
      this.childNodes = [];
      this.nodeType = 0;
      this.nodeName = '';
      this.parentNode = null;
      this.ownerDocument = globalThis.document;
    }

    appendChild(node) {
      this.childNodes.push(node);
      node.parentNode = this;
      return node;
    }

    insertBefore(node, before) {
      const index = before ? this.childNodes.indexOf(before) : -1;
      if (index < 0) return this.appendChild(node);
      this.childNodes.splice(index, 0, node);
      node.parentNode = this;
      return node;
    }

    removeChild(node) {
      this.childNodes = this.childNodes.filter((child) => child !== node);
      node.parentNode = null;
      return node;
    }

    addEventListener() {}
    removeEventListener() {}
  }

  class ElementShim extends NodeShim {
    constructor(tagName) {
      super();
      this.attributes = {};
      this.disabled = false;
      this.nodeType = 1;
      this.localName = tagName;
      this.namespaceURI = 'http://www.w3.org/1999/xhtml';
      this.style = {};
      this.tagName = tagName.toUpperCase();
      this.nodeName = this.tagName;
      this.type = '';
      this.value = '';
      this.text = '';
    }

    set textContent(value) {
      this.text = String(value);
      this.childNodes = [];
    }

    get textContent() {
      return (
        this.text ||
        this.childNodes
          .map((node) => ('textContent' in node ? node.textContent : ''))
          .join('')
      );
    }

    setAttribute(key, value) {
      this.attributes[key] = String(value);
      if (key === 'disabled') this.disabled = true;
      if (key === 'value') this.value = String(value);
    }

    removeAttribute(key) {
      delete this.attributes[key];
      if (key === 'disabled') this.disabled = false;
    }

    submit() {}
  }

  class TextShim extends NodeShim {
    constructor(text) {
      super();
      this.nodeType = 3;
      this.nodeName = '#text';
      this.textContent = text;
    }
  }

  const body = new ElementShim('body');
  const head = new ElementShim('head');
  const shimDocument = {
    nodeType: 9,
    body,
    head,
    createElement: (tagName) => new ElementShim(tagName),
    createElementNS: (_namespace, tagName) => new ElementShim(tagName),
    createTextNode: (text) => new TextShim(text),
    getElementsByTagName: (tagName) =>
      tagName.toLowerCase() === 'head' ? [head] : [],
    addEventListener() {},
    removeEventListener() {},
    defaultView: globalThis,
  };
  defineTestGlobal('document', shimDocument);
  defineTestGlobal('window', globalThis);
  defineTestGlobal('navigator', { userAgent: 'Chrome' });
  defineTestGlobal('HTMLElement', ElementShim);
  defineTestGlobal('HTMLIFrameElement', class {});
  defineTestGlobal('Node', NodeShim);
  defineTestGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  defineTestGlobal('crypto', {
    randomUUID: () => `request-${++requestIdSeed}`,
  });
}

setupDom();

mock.module('@douyinfe/semi-ui', () => ({
  Badge: () => null,
  Button: (props) => {
    buttonProps.push(props);
    return <button disabled={props.disabled}>{props.children}</button>;
  },
  Card: (props) => <div>{props.children}</div>,
  Divider: () => <hr />,
  Select: () => null,
  Skeleton: {
    Button: () => null,
    Paragraph: () => null,
    Title: () => null,
  },
  Space: (props) => <div>{props.children}</div>,
  Tag: (props) => <span>{props.children}</span>,
  Tooltip: (props) => <>{props.children}</>,
  Typography: {
    Text: (props) => <span>{props.children}</span>,
    Title: (props) => <h5>{props.children}</h5>,
  },
}));

mock.module('lucide-react', () => ({
  RefreshCw: () => null,
  Sparkles: () => null,
}));

mock.module('../../helpers', () => ({
  API: {
    post: apiPost,
  },
  renderQuota: (value) => String(value),
  showError: mock(() => undefined),
  showSuccess: mock(() => undefined),
}));

mock.module('../../helpers/render', () => ({
  getCurrencyConfig: () => ({ symbol: '$', rate: 1 }),
}));

mock.module('../../helpers/subscriptionFormat', () => ({
  formatSubscriptionDuration: () => '1 month',
  formatSubscriptionResetPeriod: () => 'No Reset',
}));

mock.module('./modals/SubscriptionPurchaseModal', () => ({
  default: (props) => {
    latestModalProps = props;
    return props.visible ? <div /> : null;
  },
}));

beforeAll(async () => {
  ({ default: SubscriptionPlansCard } =
    await import('./SubscriptionPlansCard'));
});

beforeEach(() => {
  apiCalls.length = 0;
  buttonProps.length = 0;
  latestModalProps = undefined;
  requestIdSeed = 0;
  apiPost.mockClear();
});

afterAll(() => {
  restoreTestGlobals();
});

function planRecord() {
  return {
    plan: {
      id: 42,
      title: 'Pro',
      price_amount: 5,
      duration_unit: 'month',
      duration_value: 1,
      max_purchase_per_user: 0,
      total_amount: 1000000,
      stripe_price_id: 'price_123',
    },
  };
}

function renderCard(props = {}) {
  const container = document.createElement('div');
  const root = createRoot(container);

  React.act(() => {
    root.render(
      <SubscriptionPlansCard
        t={(key) => key}
        plans={[planRecord()]}
        enableStripeTopUp
        reloadSubscriptionSelf={() => undefined}
        {...props}
      />,
    );
  });

  return { root };
}

function latestPurchaseButton() {
  const button = [...buttonProps].reverse().find((props) => props.block);
  if (!button?.onClick) {
    throw new Error('Purchase button was not rendered');
  }
  return button;
}

describe('SubscriptionPlansCard', () => {
  test('passes the modal purchase request id to Stripe subscription checkout', async () => {
    const { root } = renderCard();

    React.act(() => {
      latestPurchaseButton().onClick();
    });
    await React.act(async () => {
      await latestModalProps.onPayStripe();
    });

    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0]).toEqual({
      url: '/api/subscription/stripe/pay',
      body: {
        plan_id: 42,
        request_id: 'request-1',
      },
    });

    React.act(() => {
      root.unmount();
    });
  });

  test('rotates the Stripe request id after a definitive payment failure', async () => {
    apiPost.mockImplementationOnce(async (url, body) => {
      apiCalls.push({ url, body });
      return {
        data: {
          message: 'plan unavailable',
        },
      };
    });
    const { root } = renderCard();

    React.act(() => {
      latestPurchaseButton().onClick();
    });
    await React.act(async () => {
      await latestModalProps.onPayStripe();
    });
    await React.act(async () => {
      await latestModalProps.onPayStripe();
    });

    expect(apiCalls).toHaveLength(2);
    expect(apiCalls[0].body.request_id).toBe('request-1');
    expect(apiCalls[1].body.request_id).toBe('request-2');

    React.act(() => {
      root.unmount();
    });
  });

  test('rotates the ePay request id after a definitive HTTP payment failure', async () => {
    apiPost
      .mockImplementationOnce(async (url, body) => {
        apiCalls.push({ url, body });
        throw { response: { data: { message: 'plan unavailable' } } };
      })
      .mockImplementationOnce(async (url, body) => {
        apiCalls.push({ url, body });
        return {
          data: {
            message: 'success',
            url: 'https://pay.example.test',
            data: {},
          },
        };
      });
    const { root } = renderCard({
      enableOnlineTopUp: true,
      payMethods: [{ type: 'alipay', name: 'Alipay' }],
    });

    React.act(() => {
      latestPurchaseButton().onClick();
    });
    await React.act(async () => {
      await latestModalProps.onPayEpay();
    });
    await React.act(async () => {
      await latestModalProps.onPayEpay();
    });

    expect(apiCalls).toHaveLength(2);
    expect(apiCalls[0].body.request_id).toBe('request-1');
    expect(apiCalls[1].body.request_id).toBe('request-2');

    React.act(() => {
      root.unmount();
    });
  });

  test('keeps the ePay request id after an unknown network failure', async () => {
    apiPost
      .mockImplementationOnce(async (url, body) => {
        apiCalls.push({ url, body });
        throw new Error('network timeout');
      })
      .mockImplementationOnce(async (url, body) => {
        apiCalls.push({ url, body });
        return {
          data: {
            message: 'success',
            url: 'https://pay.example.test',
            data: {},
          },
        };
      });
    const { root } = renderCard({
      enableOnlineTopUp: true,
      payMethods: [{ type: 'alipay', name: 'Alipay' }],
    });

    React.act(() => {
      latestPurchaseButton().onClick();
    });
    await React.act(async () => {
      await latestModalProps.onPayEpay();
    });
    await React.act(async () => {
      await latestModalProps.onPayEpay();
    });

    expect(apiCalls).toHaveLength(2);
    expect(apiCalls[0].body.request_id).toBe('request-1');
    expect(apiCalls[1].body.request_id).toBe(apiCalls[0].body.request_id);

    React.act(() => {
      root.unmount();
    });
  });

  test('rotates the ePay request id when the selected payment method changes', async () => {
    apiPost
      .mockImplementationOnce(async (url, body) => {
        apiCalls.push({ url, body });
        throw new Error('network timeout');
      })
      .mockImplementationOnce(async (url, body) => {
        apiCalls.push({ url, body });
        return {
          data: {
            message: 'success',
            url: 'https://pay.example.test',
            data: {},
          },
        };
      });
    const { root } = renderCard({
      enableOnlineTopUp: true,
      payMethods: [
        { type: 'alipay', name: 'Alipay' },
        { type: 'wechat', name: 'WeChat' },
      ],
    });

    React.act(() => {
      latestPurchaseButton().onClick();
    });
    await React.act(async () => {
      await latestModalProps.onPayEpay();
    });
    React.act(() => {
      latestModalProps.setSelectedEpayMethod('wechat');
    });
    await React.act(async () => {
      await latestModalProps.onPayEpay();
    });

    expect(apiCalls).toHaveLength(2);
    expect(apiCalls[0].body.payment_method).toBe('alipay');
    expect(apiCalls[0].body.request_id).toBe('request-1');
    expect(apiCalls[1].body.payment_method).toBe('wechat');
    expect(apiCalls[1].body.request_id).toBe('request-2');

    React.act(() => {
      root.unmount();
    });
  });

  test('does not share the Stripe request id with ePay in the same modal', async () => {
    apiPost
      .mockImplementationOnce(async (url, body) => {
        apiCalls.push({ url, body });
        throw new Error('network timeout');
      })
      .mockImplementationOnce(async (url, body) => {
        apiCalls.push({ url, body });
        return {
          data: {
            message: 'success',
            url: 'https://pay.example.test',
            data: {},
          },
        };
      });
    const { root } = renderCard({
      enableOnlineTopUp: true,
      payMethods: [{ type: 'alipay', name: 'Alipay' }],
    });

    React.act(() => {
      latestPurchaseButton().onClick();
    });
    await React.act(async () => {
      await latestModalProps.onPayStripe();
    });
    await React.act(async () => {
      await latestModalProps.onPayEpay();
    });

    expect(apiCalls).toHaveLength(2);
    expect(apiCalls[0].url).toBe('/api/subscription/stripe/pay');
    expect(apiCalls[0].body.request_id).toBe('request-1');
    expect(apiCalls[1].url).toBe('/api/subscription/epay/pay');
    expect(apiCalls[1].body.request_id).toBe('request-2');

    React.act(() => {
      root.unmount();
    });
  });
});
