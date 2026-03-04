import { Page } from '@playwright/test';

/**
 * 通用元素定位辅助函数
 * 支持中英文界面切换
 */

export class PageLocators {
  constructor(private page: Page) {}

  // 充值页面元素
  getTopupAmountInput() {
    // Try multiple strategies to find the amount input
    // 1. By role and name (中英文)
    const byRole = this.page.getByRole('spinbutton', {
      name: /Top.?[Uu]p.*quantity|充值数量/i,
    });

    // 2. By placeholder (fallback)
    const byPlaceholder = this.page.locator('input[type="number"]').first();

    // Return the first one that works
    return byRole.or(byPlaceholder);
  }

  getWaffoButton() {
    return this.page.getByRole('button', { name: 'Waffo' });
  }

  // 设置页面元素
  getPaymentGatewayTab() {
    // Try to find "支付网关" or "Payment Gateway" tab
    return this.page.locator('text=/Payment.*Gateway|支付网关/i').first();
  }

  getSettingsTab(tabName: string) {
    // Generic tab finder
    return this.page.getByText(tabName).first();
  }

  // 订阅页面元素
  getSubscriptionArea() {
    return this.page.locator('text=/Subscription.*Plan|订阅套餐/i').first();
  }

  getPurchaseButton() {
    return this.page.getByRole('button', { name: /Purchase|购买/i }).first();
  }
}
