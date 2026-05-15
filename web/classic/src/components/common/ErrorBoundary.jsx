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
import { Empty, Button } from '@douyinfe/semi-ui';
import {
  IllustrationFailure,
  IllustrationFailureDark,
} from '@douyinfe/semi-illustrations';
import { withTranslation } from 'react-i18next';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { t } = this.props;
      return (
        <div className='flex flex-col justify-center items-center h-screen p-8'>
          <Empty
            image={<IllustrationFailure style={{ width: 250, height: 250 }} />}
            darkModeImage={
              <IllustrationFailureDark style={{ width: 250, height: 250 }} />
            }
            description={t('页面渲染出错，请刷新页面重试')}
          />
          <Button
            theme='solid'
            type='primary'
            style={{ marginTop: 16 }}
            onClick={() => window.location.reload()}
          >
            {t('刷新页面')}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
