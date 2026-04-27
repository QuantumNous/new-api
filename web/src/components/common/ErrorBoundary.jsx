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
import { Button } from '@heroui/react';
import { withTranslation } from 'react-i18next';
import { RefreshCcw, TriangleAlert } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const { t } = this.props;
      const shouldShowDetails = import.meta.env.DEV && this.state.error;
      return (
        <div className='flex flex-col justify-center items-center h-screen p-8'>
          <div className='glass-panel flex max-w-md flex-col items-center gap-4 rounded-[2rem] p-8 text-center'>
            <div className='flex h-24 w-24 items-center justify-center rounded-[2rem] bg-danger/10 text-danger'>
              <TriangleAlert size={44} />
            </div>
            <p className='text-base font-semibold text-slate-950 dark:text-white'>
              {t('页面渲染出错，请刷新页面重试')}
            </p>
            {shouldShowDetails ? (
              <pre className='max-h-56 w-full overflow-auto rounded-2xl bg-slate-950/90 p-4 text-left text-xs leading-5 text-rose-100'>
                {[
                  this.state.error?.message,
                  this.state.error?.stack,
                  this.state.errorInfo?.componentStack,
                ]
                  .filter(Boolean)
                  .join('\n\n')}
              </pre>
            ) : null}
          </div>
          <Button
            color='primary'
            className='mt-4 rounded-full'
            onPress={() => window.location.reload()}
          >
            <RefreshCcw size={16} />
            {t('刷新页面')}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
