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

import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@douyinfe/semi-ui';
import { getFooterHTML } from '../../helpers';

const FooterBar = () => {
  const { t } = useTranslation();
  const [footer, setFooter] = useState(getFooterHTML());
  const loadFooter = () => {
    let footer_html = localStorage.getItem('footer_html');
    if (footer_html) {
      setFooter(footer_html);
    }
  };

  const currentYear = new Date().getFullYear();

  const customFooter = useMemo(
    () => (
      <footer className='relative h-auto py-16 px-6 md:px-24 w-full flex flex-col items-center justify-between overflow-hidden'>
        <div className='absolute hidden md:block top-[204px] left-[-100px] w-[151px] h-[151px] rounded-full bg-[#FFD166]'></div>
        <div className='absolute md:hidden bottom-[20px] left-[-50px] w-[80px] h-[80px] rounded-full bg-[#FFD166] opacity-60'></div>

        <div className='flex flex-col md:flex-row items-center justify-between w-full max-w-[1110px] gap-6'>
          <div className='flex flex-wrap items-center gap-2'>
            <Typography.Text className='text-sm !text-semi-color-text-1'>
              © {currentYear} Agentrix API. {t('版权所有')}
            </Typography.Text>
          </div>
          <div className='text-sm !text-semi-color-text-2'>
            <a
              href='https://api.xmz.ai'
              target='_blank'
              rel='noopener noreferrer'
              className='!text-semi-color-text-2 hover:!text-semi-color-primary transition-colors'
            >
              api.xmz.ai
            </a>
          </div>
        </div>
      </footer>
    ),
    [t, currentYear],
  );

  useEffect(() => {
    loadFooter();
  }, []);

  return (
    <div className='w-full'>
      {footer ? (
        <div className='relative'>
          <div
            className='custom-footer'
            dangerouslySetInnerHTML={{ __html: footer }}
          ></div>
          <div className='absolute bottom-2 right-4 text-xs !text-semi-color-text-2 opacity-70'>
            <a
              href='https://api.xmz.ai'
              target='_blank'
              rel='noopener noreferrer'
              className='!text-semi-color-text-2'
            >
              Agentrix API
            </a>
          </div>
        </div>
      ) : (
        customFooter
      )}
    </div>
  );
};

export default FooterBar;
