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
    this.state = { hasError: false, errorMessage: '', componentStack: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      errorMessage: error?.message || 'Unknown error',
      componentStack: errorInfo?.componentStack || '',
    });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { t } = this.props;
      const { errorMessage, componentStack } = this.state;
      return (
        <div className='flex flex-col justify-center items-center h-screen p-8'>
          <Empty
            image={
              <IllustrationFailure style={{ width: 250, height: 250 }} />
            }
            darkModeImage={
              <IllustrationFailureDark style={{ width: 250, height: 250 }} />
            }
            description={t('页面渲染出错，请刷新页面重试')}
          />
          <div className='mt-3 max-w-[900px] w-full rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 whitespace-pre-wrap break-all'>
            {errorMessage}
            {componentStack ? `\n${componentStack}` : ''}
          </div>
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
