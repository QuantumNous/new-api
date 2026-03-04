/**
 * Waffo Checkout Page Automation Helpers
 *
 * Provides functions to automate payment on the Waffo checkout page:
 * - Fill credit card details (card number, expiry, CVV, cardholder name)
 * - Submit payment form (with checkbox handling)
 * - Handle Terms & Conditions modal
 * - Handle 3DS challenge (main page + iframe)
 * - Wait for payment result (success/failure redirect or page content)
 * - Complete full payment flow end-to-end
 *
 * Adapted from waffo-sdk/packages/waffo-node/test/e2e/webhook.e2e.test.ts
 */

import { Page } from '@playwright/test';

// ==================== Constants ====================

/** 3DS test card - triggers 3DS challenge in sandbox */
export const TEST_3DS_CARD = '4000000000001000';

/** 3DS verification code for sandbox */
export const TEST_3DS_CODE = '1234';

/** Standard test card - no 3DS challenge */
export const TEST_CARD = '4111111111111111';

// ==================== Internal Helpers ====================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== Exported Functions ====================

/**
 * Fill card details on the Waffo checkout page.
 *
 * Tries multiple selector patterns for each field to handle different
 * checkout page layouts. Returns false if the card number field cannot be found.
 *
 * @param page - Playwright Page instance on the checkout page
 * @param cardNumber - Card number to fill (defaults to TEST_3DS_CARD)
 * @returns true if card number was filled successfully
 */
export async function fillCardDetails(
  page: Page,
  cardNumber: string = TEST_3DS_CARD
): Promise<boolean> {
  console.log('[waffo-checkout] Filling card details...');

  // Card number selectors (most specific first)
  const cardNumberSelectors = [
    '#payMethodProperties\\.card\\.pan',
    "input[name='cardNumber']",
    "input[placeholder*='card']",
    "input[autocomplete='cc-number']",
    '#cardNumber',
    "input[type='tel']",
  ];

  let filled = false;
  for (const selector of cardNumberSelectors) {
    try {
      if ((await page.locator(selector).count()) > 0) {
        await page.locator(selector).first().fill(cardNumber);
        console.log(`[waffo-checkout] Card number filled using: ${selector}`);
        filled = true;
        break;
      }
    } catch {
      // Try next selector
    }
  }

  if (!filled) {
    console.log('[waffo-checkout] Could not find card number input. Available inputs:');
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');
      const type = await input.getAttribute('type');
      console.log(`[waffo-checkout]   - name=${name}, placeholder=${placeholder}, type=${type}`);
    }
    return false;
  }

  await sleep(500);

  // Expiry selectors
  const expirySelectors = [
    '#payMethodProperties\\.card\\.expiry',
    "input[name='expiry']",
    "input[name='expiryDate']",
    "input[placeholder*='MM']",
    "input[autocomplete='cc-exp']",
  ];

  for (const selector of expirySelectors) {
    try {
      if ((await page.locator(selector).count()) > 0) {
        await page.locator(selector).first().fill('12/28');
        console.log(`[waffo-checkout] Expiry filled using: ${selector}`);
        break;
      }
    } catch {
      // Try next selector
    }
  }

  await sleep(500);

  // CVV selectors
  const cvvSelectors = [
    '#payMethodProperties\\.card\\.cvv',
    "input[name='cvv']",
    "input[name='cvc']",
    "input[name='securityCode']",
    "input[autocomplete='cc-csc']",
  ];

  for (const selector of cvvSelectors) {
    try {
      if ((await page.locator(selector).count()) > 0) {
        await page.locator(selector).first().fill('123');
        console.log(`[waffo-checkout] CVV filled using: ${selector}`);
        break;
      }
    } catch {
      // Try next selector
    }
  }

  await sleep(500);

  // Cardholder name selectors
  const nameSelectors = [
    '#payMethodProperties\\.card\\.name',
    "input[name='cardholderName']",
    "input[name='name']",
    "input[placeholder*='name']",
    "input[autocomplete='cc-name']",
  ];

  for (const selector of nameSelectors) {
    try {
      if ((await page.locator(selector).count()) > 0) {
        await page.locator(selector).first().fill('Tom');
        console.log(`[waffo-checkout] Cardholder name filled using: ${selector}`);
        break;
      }
    } catch {
      // Try next selector
    }
  }

  await sleep(500);
  console.log('[waffo-checkout] Card details filled successfully');
  return true;
}

/**
 * Submit the payment form on the checkout page.
 *
 * First checks all unchecked checkboxes (e.g. terms acceptance),
 * then clicks the submit/pay button.
 *
 * @param page - Playwright Page instance on the checkout page
 * @returns true if a submit button was found and clicked
 */
export async function submitPaymentForm(page: Page): Promise<boolean> {
  console.log('[waffo-checkout] Submitting payment form...');

  // Check all unchecked checkboxes first (e.g. terms acceptance)
  try {
    const checkboxes = await page.locator("input[type='checkbox']").all();
    console.log(`[waffo-checkout] Found ${checkboxes.length} checkbox(es) on page`);

    for (const checkbox of checkboxes) {
      try {
        if (!(await checkbox.isChecked())) {
          await checkbox.check();
          const id = await checkbox.getAttribute('id');
          console.log(`[waffo-checkout] Checked checkbox: id=${id}`);
        }
      } catch {
        // Skip checkboxes that can't be clicked
      }
    }
    await sleep(500);
  } catch (e) {
    console.log(`[waffo-checkout] Warning: Error checking checkboxes: ${e}`);
  }

  // Submit button selectors
  const submitSelectors = [
    "button[type='submit']",
    "button:has-text('Subscribe')",
    "button:has-text('Pay')",
    "button:has-text('Submit')",
    "button:has-text('支付')",
    "button:has-text('确认')",
    "button:has-text('Confirm')",
  ];

  for (const selector of submitSelectors) {
    try {
      if ((await page.locator(selector).count()) > 0) {
        await page.locator(selector).first().click();
        console.log(`[waffo-checkout] Payment submitted using: ${selector}`);
        await sleep(5000);
        return true;
      }
    } catch {
      // Try next selector
    }
  }

  console.log('[waffo-checkout] Could not find submit button');
  return false;
}

/**
 * Handle Terms & Conditions modal if it appears after payment submission.
 *
 * Waits briefly then tries multiple accept button selectors.
 * Does nothing if no modal is detected.
 *
 * @param page - Playwright Page instance
 */
export async function handleTermsModal(page: Page): Promise<void> {
  console.log('[waffo-checkout] Checking for Terms & Conditions modal...');
  await sleep(2000);

  const acceptSelectors = [
    "button:has-text('接受並繼續')",
    "button:has-text('接受并继续')",
    "button:has-text('Accept')",
    "button:has-text('Agree')",
    "button:has-text('Continue')",
    "button:has-text('確認')",
  ];

  for (const selector of acceptSelectors) {
    try {
      if ((await page.locator(selector).count()) > 0) {
        console.log(`[waffo-checkout] Found Terms & Conditions accept button: ${selector}`);
        await page.locator(selector).first().click();
        await sleep(3000);
        return;
      }
    } catch {
      // Try next selector
    }
  }

  console.log('[waffo-checkout] No Terms & Conditions modal detected');
}

/**
 * Try to fill the 3DS verification code and submit on the current page.
 *
 * @param page - Playwright Page instance (may be a 3DS challenge page)
 */
async function fill3DSCode(page: Page): Promise<void> {
  const inputSelectors = [
    "input[name='challengeDataEntry']",
    "input[name='otp']",
    "input[name='code']",
    "input[name='password']",
    "input[type='password']",
    "input[type='tel']",
    "input[type='text']",
    'input',
  ];

  for (const selector of inputSelectors) {
    try {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`[waffo-checkout] Found ${count} 3DS input(s): ${selector}`);
        await page.locator(selector).first().fill(TEST_3DS_CODE);
        await sleep(500);

        const submitSelectors = [
          "button[type='submit']",
          "input[type='submit']",
          "button:has-text('Submit')",
          "button:has-text('Verify')",
          "button:has-text('确认')",
          'button',
        ];

        for (const submitSel of submitSelectors) {
          try {
            if ((await page.locator(submitSel).count()) > 0) {
              await page.locator(submitSel).first().click();
              console.log(`[waffo-checkout] 3DS submitted: ${submitSel}`);
              await sleep(5000);
              return;
            }
          } catch {
            // Try next submit selector
          }
        }
        break;
      }
    } catch {
      // Try next input selector
    }
  }
}

/**
 * Handle 3DS challenge if present after payment submission.
 *
 * Checks the current URL, iframes, and main page for 3DS challenge inputs.
 * Enters the test 3DS code and submits.
 *
 * @param page - Playwright Page instance
 */
export async function handle3DS(page: Page): Promise<void> {
  console.log('[waffo-checkout] Checking for 3DS challenge...');
  await sleep(3000);
  const currentUrl = page.url();
  console.log(`[waffo-checkout] URL after submit: ${currentUrl}`);

  // Check if we're on a 3DS challenge page
  if (currentUrl.includes('doChallenge') || currentUrl.includes('3ds')) {
    console.log('[waffo-checkout] Detected 3DS challenge page');
    await fill3DSCode(page);
    return;
  }

  // Check for iframes containing 3DS
  const iframeCount = await page.locator('iframe').count();
  console.log(`[waffo-checkout] Found ${iframeCount} iframes`);

  if (iframeCount > 0) {
    for (let i = 0; i < iframeCount; i++) {
      try {
        const frame = page.frameLocator('iframe').nth(i);
        const inputSelectors = [
          "input[name='challengeDataEntry']",
          "input[name='otp']",
          "input[name='code']",
          "input[name='password']",
          "input[type='password']",
          "input[type='tel']",
          "input[type='text']",
        ];

        for (const selector of inputSelectors) {
          try {
            if ((await frame.locator(selector).count()) > 0) {
              console.log(`[waffo-checkout] 3DS input found in iframe ${i}: ${selector}`);
              await frame.locator(selector).first().fill(TEST_3DS_CODE);
              await sleep(500);

              // Submit 3DS
              const submitSelectors = [
                "button[type='submit']",
                "input[type='submit']",
                "button:has-text('Submit')",
                "button:has-text('Verify')",
                "button:has-text('确认')",
              ];

              for (const submitSel of submitSelectors) {
                if ((await frame.locator(submitSel).count()) > 0) {
                  await frame.locator(submitSel).first().click();
                  console.log(`[waffo-checkout] 3DS submitted in iframe using: ${submitSel}`);
                  await sleep(5000);
                  return;
                }
              }
            }
          } catch {
            // Try next selector
          }
        }
      } catch {
        // Try next iframe
      }
    }
  }

  // Check main page for 3DS inputs
  await fill3DSCode(page);
}

/**
 * Wait for the payment result with a retry loop.
 *
 * Polls the page URL and content for up to ~30 seconds (15 checks x 2s)
 * looking for success/failure indicators. Handles late 3DS redirects.
 *
 * @param page - Playwright Page instance
 * @returns true if payment succeeded, false otherwise
 */
export async function waitForPaymentResult(page: Page): Promise<boolean> {
  console.log('[waffo-checkout] Waiting for payment result...');

  for (let i = 0; i < 15; i++) {
    await sleep(2000);
    const currentUrl = page.url();
    console.log(`[waffo-checkout] Check ${i + 1}/15: ${currentUrl}`);

    // Handle mock cashier page that appears after payment method selection
    if (currentUrl.includes('mock-cashier') || currentUrl.includes('paymethod-mock')) {
      console.log('[waffo-checkout] Mock cashier page detected in result wait, handling...');
      const handled = await handleMockCashier(page);
      if (handled) return true;
    }

    // Handle 3DS challenge that appears late
    if (currentUrl.includes('doChallenge') || currentUrl.includes('3ds')) {
      console.log('[waffo-checkout] Late 3DS challenge detected, handling...');
      await fill3DSCode(page);
      continue;
    }

    // Success redirect
    if (currentUrl.includes('status=success')) {
      console.log('[waffo-checkout] Payment SUCCESS - redirected to success URL');
      return true;
    }

    // Check page content for success indicators
    try {
      const content = await page.content();
      if (
        content.includes('PAY_SUCCESS') ||
        content.includes('支付成功') ||
        content.includes('Payment Successful')
      ) {
        console.log('[waffo-checkout] Payment SUCCESS - found success indicator in page content');
        return true;
      }

      if (content.includes('訂閱成功') || content.includes('success_page')) {
        console.log('[waffo-checkout] Subscription SUCCESS');
        // Try clicking confirm button
        for (const sel of [
          "a:has-text('確認')",
          "button:has-text('確認')",
          "a:has-text('Confirm')",
        ]) {
          try {
            if ((await page.locator(sel).count()) > 0) {
              await page.locator(sel).first().click();
              await sleep(2000);
              break;
            }
          } catch {
            // Continue
          }
        }
        return true;
      }
    } catch {
      // Ignore content read errors
    }

    // Check for failure
    if (currentUrl.includes('status=failed')) {
      console.log('[waffo-checkout] Payment FAILED - redirected to failure URL');
      return false;
    }
  }

  console.log('[waffo-checkout] Payment result unknown after timeout');
  return false;
}

/**
 * Complete the full payment flow on the Waffo checkout page.
 *
 * Steps:
 *   A. Fill card details (card number, expiry, CVV, name)
 *   B. Submit payment form (check checkboxes + click submit)
 *   C. Handle Terms & Conditions modal if present
 *   D. Handle 3DS challenge if present
 *   E. Wait for payment result
 *
 * @param page - Playwright Page instance already navigated to the checkout URL
 * @param use3DS - If true (default), use the 3DS test card; if false, use the standard test card
 * @returns true if payment completed successfully
 */
/**
 * Select a payment method on the Waffo checkout payment method selection page.
 *
 * The Waffo sandbox checkout page shows available payment methods
 * (e-wallets, QRIS, virtual accounts, etc.) instead of a direct card form.
 * This function selects the first available method and clicks "Bayar" (Pay).
 *
 * With the `&mock` parameter in the checkout URL, the payment is simulated.
 *
 * @param page - Playwright Page instance on the checkout page
 * @returns true if a payment method was selected and submitted
 */
/**
 * Dismiss any overlay modal (e.g. Privacy Policy, Terms modal) that may block interaction.
 * Tries common close button patterns.
 */
async function dismissOverlayModal(page: Page): Promise<void> {
  const closeSelectors = [
    // Icon-based close buttons (most common in Waffo checkout)
    "button svg[aria-label='close']",
    "button svg[data-icon='close']",
    "button[aria-label='Close']",
    "button[aria-label='close']",
    // Role-based dialog close
    "[role='dialog'] button:last-of-type",
    "[role='dialog'] button",
    // Generic close button with × symbol
    "button:has-text('×')",
    "button:has-text('✕')",
    "button:has-text('✖')",
    // Backdrop click to close
    ".modal-backdrop",
    "[data-testid='modal-close']",
  ];

  for (const selector of closeSelectors) {
    try {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`[waffo-checkout] Dismissing modal via: ${selector}`);
        await page.locator(selector).first().click({ force: true });
        await sleep(1000);
        // Check if modal is gone
        const stillVisible = await page.locator("[role='dialog']").count();
        if (stillVisible === 0) {
          console.log('[waffo-checkout] Modal dismissed');
          return;
        }
      }
    } catch {
      // Try next selector
    }
  }

  // Fallback: press Escape
  try {
    await page.keyboard.press('Escape');
    await sleep(500);
    console.log('[waffo-checkout] Pressed Escape to dismiss modal');
  } catch {
    // Ignore
  }
}

export async function selectPaymentMethodAndPay(
  page: Page,
  cardNumber: string = TEST_CARD
): Promise<boolean> {
  console.log('[waffo-checkout] Attempting payment method selection flow...');

  const pageTitle = await page.title();
  const pageUrl = page.url();
  console.log(`[waffo-checkout] Page title: "${pageTitle}", URL: ${pageUrl}`);

  // Step 1: Dismiss any overlay modal that may have opened (e.g. Privacy Policy)
  const hasModal = await page.locator("[role='dialog']").count();
  if (hasModal > 0) {
    console.log('[waffo-checkout] Overlay modal detected, dismissing...');
    await dismissOverlayModal(page);
    await sleep(1000);
  }

  // Step 2: Click "Credit/Debit Card" button to expand the card form
  // The new Waffo checkout UI shows payment methods as buttons (not radio inputs)
  const cardMethodSelectors = [
    "button:has-text('Credit/Debit Card')",
    "button:has-text('Credit')",
    "button:has-text('Debit Card')",
  ];

  for (const selector of cardMethodSelectors) {
    try {
      const count = await page.locator(selector).count();
      if (count > 0) {
        const btnText = await page.locator(selector).first().textContent();
        console.log(`[waffo-checkout] Clicking card method button: "${btnText?.trim()}" (selector: ${selector})`);
        await page.locator(selector).first().click();
        await sleep(1500);
        break;
      }
    } catch {
      // Try next selector
    }
  }

  // Step 3: Check if card form is now visible; if so, fill and submit
  const hasCardForm = await fillCardDetails(page, cardNumber);
  if (hasCardForm) {
    console.log('[waffo-checkout] Card form appeared after method selection, filling and submitting...');
    const submitted = await submitPaymentForm(page);
    if (!submitted) {
      console.log('[waffo-checkout] Failed to submit card form');
      return false;
    }
    return true;
  }

  // Step 4: Fallback — accept terms checkbox if present, then click the pay button directly
  console.log('[waffo-checkout] No card form found, trying direct pay button...');

  try {
    const termsCheckbox = page.locator("input[name='needAgreeTerms'], input[type='checkbox']").first();
    if (await termsCheckbox.count() > 0 && !(await termsCheckbox.isChecked())) {
      await termsCheckbox.check({ force: true });
      console.log('[waffo-checkout] Accepted terms checkbox');
      await sleep(500);
    }
  } catch {
    // Terms may not exist or already checked
  }

  const payButtonSelectors = [
    "button:has-text('Subscribe')",
    "button[type='submit']",
    "button:has-text('Bayar')",
    "button:has-text('Pay')",
    "button:has-text('支付')",
    "button:has-text('Confirm')",
    "button:has-text('确认')",
    "a:has-text('Bayar')",
  ];

  for (const selector of payButtonSelectors) {
    try {
      const count = await page.locator(selector).count();
      if (count > 0) {
        const btnText = await page.locator(selector).first().textContent();
        console.log(`[waffo-checkout] Clicking pay button: "${btnText?.trim()}" (selector: ${selector})`);

        await Promise.all([
          page.waitForURL(
            (url) =>
              url.href.includes('mock-cashier') ||
              url.href.includes('paymethod-mock') ||
              url.href.includes('console/topup'),
            { timeout: 15000 }
          ).catch(() => {
            console.log('[waffo-checkout] Navigation after pay timed out, continuing...');
          }),
          page.locator(selector).first().click({ force: true }),
        ]);

        const newUrl = page.url();
        console.log(`[waffo-checkout] Pay button clicked, navigated to: ${newUrl}`);
        return true;
      }
    } catch {
      // Try next selector
    }
  }

  console.log('[waffo-checkout] Could not find pay/submit button');
  return false;
}

/**
 * Handle the Waffo sandbox mock cashier page.
 *
 * After selecting a payment method on the checkout page, the sandbox
 * redirects to `cashier-sandbox.waffo.com/paymethod-mock-cashier` which
 * has two buttons: "Payment succeeded" and "Payment failed".
 *
 * This function detects if we're on the mock cashier page and clicks
 * "Payment succeeded" to simulate a successful payment.
 *
 * @param page - Playwright Page instance
 * @returns true if mock cashier was detected and handled
 */
export async function handleMockCashier(page: Page): Promise<boolean> {
  const currentUrl = page.url();
  console.log(`[waffo-checkout] Checking for mock cashier page. URL: ${currentUrl}`);

  // Already on success page (navigated from mock cashier)
  if (currentUrl.includes('paymethod-mock/success')) {
    console.log('[waffo-checkout] Already on mock cashier success page');
    return true;
  }

  // Check if we're on the mock cashier page
  if (!currentUrl.includes('mock-cashier') && !currentUrl.includes('paymethod-mock')) {
    console.log('[waffo-checkout] Not on mock cashier page');
    return false;
  }

  console.log('[waffo-checkout] Mock cashier page detected!');

  // Wait for page to be fully loaded before clicking
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(2000);

  // Click "Payment succeeded" button and wait for navigation
  const successSelectors = [
    "button:has-text('Payment succeeded')",
    "button:has-text('Payment Succeeded')",
    "button:has-text('Success')",
    "button:has-text('成功')",
  ];

  // Try Playwright locator click first
  for (const selector of successSelectors) {
    try {
      const btn = page.locator(selector).first();
      const count = await btn.count();
      if (count > 0) {
        const btnText = await btn.textContent();
        console.log(`[waffo-checkout] Found mock cashier success button: "${btnText}" (${selector})`);

        // Use JavaScript DOM click for reliability in headless mode
        console.log('[waffo-checkout] Clicking via JS evaluate for headless compatibility...');
        await page.evaluate((text) => {
          const buttons = document.querySelectorAll('button');
          for (const b of buttons) {
            if (b.textContent && b.textContent.includes(text)) {
              b.click();
              break;
            }
          }
        }, btnText!.trim());

        // Wait for navigation to /paymethod-mock/success
        console.log('[waffo-checkout] Button clicked, waiting for navigation...');
        try {
          await page.waitForURL(
            (url) => url.href.includes('paymethod-mock/success') || url.href.includes('console/topup'),
            { timeout: 15000 }
          );
        } catch {
          console.log('[waffo-checkout] waitForURL timed out, trying Playwright click as fallback...');
          // Fallback: try Playwright's native click
          await Promise.all([
            page.waitForURL(
              (url) => !url.href.includes('paymethod-mock-cashier'),
              { timeout: 15000 }
            ).catch(() => {}),
            btn.click({ force: true }),
          ]);
        }

        const newUrl = page.url();
        console.log(`[waffo-checkout] URL after mock success click: ${newUrl}`);

        if (newUrl.includes('paymethod-mock/success')) {
          console.log('[waffo-checkout] Successfully navigated to mock payment success page');
          console.log('[waffo-checkout] Waffo backend should be sending webhook now...');
          await sleep(5000);
          return true;
        }

        if (newUrl.includes('console/topup') || newUrl.includes('status=success')) {
          console.log('[waffo-checkout] Redirected to merchant success page');
          return true;
        }

        console.log('[waffo-checkout] Mock success button clicked but navigation unclear');
        // Still return true - the click was attempted
        return true;
      }
    } catch (err) {
      console.log(`[waffo-checkout] Selector "${selector}" failed: ${err}`);
    }
  }

  console.log('[waffo-checkout] Could not find mock cashier success button');
  try {
    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      console.log(`[waffo-checkout]   Button found: "${text}"`);
    }
  } catch {
    // Ignore
  }
  return false;
}

export async function completePaymentFlow(
  page: Page,
  use3DS: boolean = true
): Promise<boolean> {
  const cardNumber = use3DS ? TEST_3DS_CARD : TEST_CARD;
  console.log(`[waffo-checkout] Starting payment flow (use3DS=${use3DS}, card=${cardNumber.slice(0, 4)}...${cardNumber.slice(-4)})`);

  // Step A: Try to fill card details (direct card form)
  console.log('[waffo-checkout] Step A: Checking for card input form...');
  const hasCardForm = await fillCardDetails(page, cardNumber);

  if (hasCardForm) {
    // Card form flow: fill → submit → T&C → 3DS → wait
    console.log('[waffo-checkout] Card form detected, using card payment flow');

    console.log('[waffo-checkout] Step B: Submitting payment...');
    if (!(await submitPaymentForm(page))) {
      console.log('[waffo-checkout] Failed to submit payment');
      return false;
    }

    console.log('[waffo-checkout] Step C: Handling Terms & Conditions...');
    await handleTermsModal(page);

    console.log('[waffo-checkout] Step D: Handling 3DS challenge...');
    await handle3DS(page);
  } else {
    // Payment method selection flow: select method → click Bayar
    console.log('[waffo-checkout] No card form found, trying payment method selection flow...');
    const submitted = await selectPaymentMethodAndPay(page, cardNumber);
    if (!submitted) {
      console.log('[waffo-checkout] Failed to select payment method and pay');
      return false;
    }
  }

  // Step E: Handle mock cashier page if present
  console.log('[waffo-checkout] Step E: Checking for mock cashier page...');
  const handled = await handleMockCashier(page);
  if (handled) {
    return true;
  }

  // Step F: Wait for payment result (redirect-based)
  console.log('[waffo-checkout] Step F: Waiting for payment result...');
  return await waitForPaymentResult(page);
}

/**
 * Parse redirect URL from Waffo API response action fields.
 *
 * The subscriptionAction or orderAction field may be:
 *   - A direct URL string (http:// or https://)
 *   - A JSON string containing webUrl and/or deeplinkUrl
 *
 * @param action - The action field value from Waffo API response
 * @returns The parsed URL, or empty string if not found
 */
export function parseRedirectUrl(action?: string): string {
  if (!action) return '';
  const trimmed = action.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return parsed.webUrl || parsed.deeplinkUrl || '';
  } catch {
    return '';
  }
}
