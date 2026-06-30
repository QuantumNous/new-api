import React from 'react';
import { Empty, Typography } from '@douyinfe/semi-ui';
import { Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const VideoModel = () => {
  const { t } = useTranslation();

  return (
    <div className='flex flex-col items-center justify-center h-[calc(100vh-66px)] gap-4'>
      <Video size={48} className='text-gray-400' />
      <Empty
        title={t('视频模型')}
        description={
          <Typography.Text type='tertiary'>
            {t('功能建设中，敬请期待')}
          </Typography.Text>
        }
      />
    </div>
  );
};

export default VideoModel;
