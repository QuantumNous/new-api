import React from 'react';
import { RadioGroup, Radio } from '@douyinfe/semi-ui';

/**
 * 使用模式选择步骤组件
 * 提供系统使用模式的选择界面
 */
const UsageModeStep = ({
  formData,
  handleUsageModeChange,
  renderNavigationButtons,
  t,
}) => {
  return (
    <>
      <RadioGroup
        value={formData.usageMode}
        onChange={handleUsageModeChange}
        type='card'
        direction='horizontal'
        className='mt-4'
        aria-label='使用模式选择'
        name='usage-mode-selection'
      >
        <Radio
          value='external'
          extra={t('适用于为多个用户提供服务的场景')}
          style={{ width: '30%', minWidth: 200 }}
        >
          {t('对外运营模式')}
        </Radio>
        <Radio
          value='self'
          extra={t('适用于个人使用的场景，不需要设置模型价格')}
          style={{ width: '30%', minWidth: 200 }}
        >
          {t('自用模式')}
        </Radio>
        <Radio
          value='demo'
          extra={t('适用于展示系统功能的场景，提供基础功能演示')}
          style={{ width: '30%', minWidth: 200 }}
        >
          {t('演示站点模式')}
        </Radio>
      </RadioGroup>
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

export default UsageModeStep;
