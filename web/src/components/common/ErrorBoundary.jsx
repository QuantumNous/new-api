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
    return {
      hasError: true,
      errorMessage: error?.message || String(error || ''),
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({
      errorMessage: error?.message || String(error || ''),
      componentStack: errorInfo?.componentStack || '',
    });
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
          <Button
            theme='solid'
            type='primary'
            style={{ marginTop: 16 }}
            onClick={() => window.location.reload()}
          >
            {t('刷新页面')}
          </Button>
          {errorMessage && (
            <div
              className='mt-6 w-full max-w-3xl rounded border border-semi-color-border bg-semi-color-bg-1 p-4 text-left'
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              <div className='text-sm font-semibold mb-2'>Error</div>
              <div className='text-xs text-semi-color-text-1'>{errorMessage}</div>
              {componentStack && (
                <>
                  <div className='text-sm font-semibold mt-4 mb-2'>
                    Component Stack
                  </div>
                  <div className='text-xs text-semi-color-text-1'>
                    {componentStack}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
