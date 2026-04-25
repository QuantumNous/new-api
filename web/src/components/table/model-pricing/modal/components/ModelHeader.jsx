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
import { Copy } from 'lucide-react';
import { showSuccess, getLobeHubIcon } from '../../../../../helpers';

const CARD_STYLES = {
  container:
    'w-12 h-12 rounded-2xl flex items-center justify-center relative shadow-md bg-[color:var(--app-background)] border border-[color:var(--app-border)]',
  icon: 'w-8 h-8 flex items-center justify-center',
};

const ModelHeader = ({ modelData, vendorsMap = {}, t }) => {
  const getModelIcon = () => {
    if (modelData?.icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(modelData.icon, 32)}
          </div>
        </div>
      );
    }
    if (modelData?.vendor_icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(modelData.vendor_icon, 32)}
          </div>
        </div>
      );
    }
    const avatarText = modelData?.model_name?.slice(0, 2).toUpperCase() || 'AI';
    return (
      <div className={`${CARD_STYLES.container} bg-primary/10 text-primary`}>
        <span className='text-base font-bold'>{avatarText}</span>
      </div>
    );
  };

  const handleCopy = async () => {
    const text = modelData?.model_name || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(t('已复制模型名称'));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Copy failed', err);
    }
  };

  return (
    <div className='flex items-center'>
      {getModelIcon()}
      <div className='ml-3 flex items-center gap-1.5 font-normal'>
        <span className='max-w-60 truncate text-lg font-bold text-foreground'>
          {modelData?.model_name || t('未知模型')}
        </span>
        {modelData?.model_name ? (
          <button
            type='button'
            onClick={handleCopy}
            aria-label={t('复制模型名称')}
            title={t('复制')}
            className='inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-[color:var(--app-background)] hover:text-foreground'
          >
            <Copy size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default ModelHeader;
