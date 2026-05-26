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
import { Button } from '@douyinfe/semi-ui';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Home,
  WalletCards,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

const normalizeKind = (value) =>
  value === 'subscription' || value === 'topup' ? value : 'topup';

const normalizeStatus = (value) =>
  value === 'success' || value === 'fail' || value === 'pending'
    ? value
    : 'pending';

const statusStyles = {
  success: {
    icon: CheckCircle2,
    iconClass: 'border-emerald-200 bg-emerald-50 text-emerald-600',
  },
  pending: {
    icon: Clock3,
    iconClass: 'border-amber-200 bg-amber-50 text-amber-600',
  },
  fail: {
    icon: AlertTriangle,
    iconClass: 'border-red-200 bg-red-50 text-red-600',
  },
};

const PaymentResult = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const kind = normalizeKind(searchParams.get('kind'));
  const status = normalizeStatus(searchParams.get('status'));
  const style = statusStyles[status];
  const Icon = style.icon;
  const detailHref = '/console/topup?show_history=true';
  const detailText = t('View wallet');
  const kindText =
    kind === 'subscription' ? t('Subscription payment') : t('Wallet top-up');
  const statusCopy = {
    success: {
      title: t('Payment confirmed'),
      label: t('Payment has been confirmed'),
      description: t(
        'We have received confirmation from the payment provider. Your balance or subscription may take a few seconds to sync.',
      ),
    },
    pending: {
      title: t('Payment is being confirmed'),
      label: t('Payment confirmation is in progress'),
      description: t(
        'Your payment has been submitted. We are waiting for the payment provider to finish confirmation.',
      ),
    },
    fail: {
      title: t('Payment not confirmed'),
      label: t('We could not confirm this payment'),
      description: t(
        'The payment result could not be verified. Please return to your account later to check the final status.',
      ),
    },
  }[status];

  return (
    <main className='min-h-screen bg-gray-50 text-gray-950'>
      <div className='mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8'>
        <section className='grid w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm md:grid-cols-[0.9fr_1.1fr]'>
          <div className='border-b border-gray-200 bg-gray-50 p-6 md:border-r md:border-b-0 md:p-8'>
            <div className='flex h-full flex-col justify-between gap-10'>
              <div>
                <p className='text-sm font-medium text-gray-500'>
                  {t('Payment result')}
                </p>
                <h1 className='mt-3 text-3xl font-semibold tracking-normal sm:text-4xl'>
                  {statusCopy.title}
                </h1>
              </div>
              <div className='space-y-2 text-sm text-gray-500'>
                <p>{kindText}</p>
                <p>{t('No sensitive order details are shown on this page.')}</p>
              </div>
            </div>
          </div>

          <div className='p-6 md:p-8'>
            <div className='flex flex-col gap-6'>
              <div className='flex items-start gap-4'>
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${style.iconClass}`}
                >
                  <Icon size={24} />
                </div>
                <div className='min-w-0'>
                  <p className='text-lg font-medium'>{statusCopy.label}</p>
                  <p className='mt-2 max-w-xl text-sm leading-6 text-gray-500'>
                    {statusCopy.description}
                  </p>
                </div>
              </div>

              <div className='rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-700'>
                {t(
                  'If you paid from a mobile wallet, you can return to the original browser to continue using your account.',
                )}
              </div>

              <div className='flex flex-col gap-3 sm:flex-row'>
                <Button
                  theme='solid'
                  type='primary'
                  icon={<WalletCards size={16} />}
                  onClick={() => {
                    window.location.href = detailHref;
                  }}
                >
                  {detailText}
                </Button>
                <Button
                  icon={<Home size={16} />}
                  onClick={() => {
                    window.location.href = '/';
                  }}
                >
                  {t('Back to Home')}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default PaymentResult;
