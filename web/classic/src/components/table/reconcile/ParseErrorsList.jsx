import React from 'react';
import { Banner, List, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function ParseErrorsList({ errors }) {
  const { t } = useTranslation();
  if (!errors || errors.length === 0) return null;

  return (
    <Banner
      type='warning'
      title={t('账单解析发现错误')}
      description={
        <List
          dataSource={errors}
          size='small'
          renderItem={(e) => (
            <List.Item>
              <Text size='small'>
                {e.row > 0 ? `${t('第')} ${e.row} ${t('行')}: ` : ''}
                {e.reason}
              </Text>
            </List.Item>
          )}
        />
      }
      closeIcon={null}
    />
  );
}
