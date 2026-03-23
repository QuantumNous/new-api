import React from 'react';
import { Button } from '@douyinfe/semi-ui';
import { Settings, Eye, EyeOff } from 'lucide-react';

const FloatingButtons = ({
  styleState,
  showSettings,
  showDebugPanel,
  onToggleSettings,
  onToggleDebugPanel,
}) => {
  if (!styleState.isMobile) return null;

  return (
    <>
      {/* 设置按钮 */}
      {!showSettings && (
        <Button
          icon={<Settings size={18} />}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 90,
            zIndex: 1000,
            width: 36,
            height: 36,
            borderRadius: '50%',
            padding: 0,
            boxShadow: 'var(--app-shadow-soft)',
          }}
          onClick={onToggleSettings}
          theme='solid'
          type='primary'
          className='playground-floating-button lg:hidden'
        />
      )}

      {/* 调试按钮 */}
      {!showSettings && (
        <Button
          icon={showDebugPanel ? <EyeOff size={18} /> : <Eye size={18} />}
          onClick={onToggleDebugPanel}
          theme='solid'
          type={showDebugPanel ? 'danger' : 'primary'}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 140,
            zIndex: 1000,
            width: 36,
            height: 36,
            borderRadius: '50%',
            padding: 0,
            boxShadow: 'var(--app-shadow-soft)',
          }}
          className='playground-floating-button lg:hidden'
        />
      )}
    </>
  );
};

export default FloatingButtons;
