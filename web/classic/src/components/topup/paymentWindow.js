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

export const openPaymentWindow = (title = 'Payment') => {
  if (typeof window === 'undefined') {
    return null;
  }

  const paymentWindow = window.open('', '_blank');
  if (!paymentWindow) {
    return null;
  }

  paymentWindow.document.title = title;
  paymentWindow.document.body.style.margin = '0';
  paymentWindow.document.body.style.fontFamily =
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  paymentWindow.document.body.innerHTML = `
    <main style="min-height: 100vh; display: grid; place-items: center; color: #0f172a; background: #f8fafc;">
      <section style="text-align: center; padding: 24px;">
        <div style="font-size: 16px; font-weight: 600;">Redirecting to payment...</div>
        <div style="margin-top: 8px; font-size: 13px; color: #64748b;">Please keep this window open.</div>
      </section>
    </main>
  `;
  paymentWindow.document.close();

  return paymentWindow;
};

export const redirectPaymentWindow = (paymentWindow, url) => {
  if (!url || typeof window === 'undefined') {
    return false;
  }

  if (paymentWindow && !paymentWindow.closed) {
    paymentWindow.location.href = url;
    return true;
  }

  window.location.href = url;
  return true;
};

export const closePaymentWindow = (paymentWindow) => {
  if (paymentWindow && !paymentWindow.closed) {
    paymentWindow.close();
  }
};
