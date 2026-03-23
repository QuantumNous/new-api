import React from 'react';
import { Typography } from '@douyinfe/semi-ui';

const { Text } = Typography;

const ParamOverrideEntry = ({ count, onOpen, t }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <Text
        type='tertiary'
        size='small'
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {t('{{count}} 项操作', { count })}
      </Text>
      <Text
        link
        size='small'
        style={{ fontWeight: 600 }}
        onClick={onOpen}
      >
        {t('查看详情')}
      </Text>
    </div>
  );
};

export default React.memo(ParamOverrideEntry);
