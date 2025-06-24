import React from 'react';
import { Button } from '@douyinfe/semi-ui';
import {
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';

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
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            background: 'linear-gradient(to right, #8b5cf6, #6366f1)',
          }}
          onClick={onToggleSettings}
          theme='solid'
          type='primary'
          className="lg:hidden"
        />
      )}

      {/* 调试按钮 */}
      {!showSettings && (
        <Button
          icon={showDebugPanel ? <EyeOff size={18} /> : <Eye size={18} />}
          onClick={onToggleDebugPanel}
          theme="solid"
          type={showDebugPanel ? "danger" : "primary"}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 140,
            zIndex: 1000,
            width: 36,
            height: 36,
            borderRadius: '50%',
            padding: 0,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            background: showDebugPanel
              ? 'linear-gradient(to right, #e11d48, #be123c)'
              : 'linear-gradient(to right, #4f46e5, #6366f1)',
          }}
          className="lg:hidden !rounded-full !p-0"
        />
      )}
    </>
  );
};

export default FloatingButtons; 