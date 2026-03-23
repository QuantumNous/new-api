import React from 'react';
import { Tabs, TabPane, Tag } from '@douyinfe/semi-ui';
import { CHANNEL_OPTIONS } from '../../../constants';
import { getChannelIcon } from '../../../helpers';

const ChannelsTabs = ({
  enableTagMode,
  activeTypeKey,
  setActiveTypeKey,
  channelTypeCounts,
  availableTypeKeys,
  loadChannels,
  activePage,
  pageSize,
  idSort,
  setActivePage,
  t,
}) => {
  if (enableTagMode) return null;

  const handleTabChange = (key) => {
    setActiveTypeKey(key);
    setActivePage(1);
    loadChannels(1, pageSize, idSort, enableTagMode, key);
  };

  return (
    <Tabs
      activeKey={activeTypeKey}
      type='card'
      collapsible
      onChange={handleTabChange}
      className='mb-2'
    >
      <TabPane
        itemKey='all'
        tab={
          <span className='flex items-center gap-2'>
            {t('全部')}
            <Tag
              color={activeTypeKey === 'all' ? 'red' : 'grey'}
              shape='circle'
            >
              {channelTypeCounts['all'] || 0}
            </Tag>
          </span>
        }
      />

      {CHANNEL_OPTIONS.filter((opt) =>
        availableTypeKeys.includes(String(opt.value)),
      ).map((option) => {
        const key = String(option.value);
        const count = channelTypeCounts[option.value] || 0;
        return (
          <TabPane
            key={key}
            itemKey={key}
            tab={
              <span className='flex items-center gap-2'>
                {getChannelIcon(option.value)}
                {option.label}
                <Tag
                  color={activeTypeKey === key ? 'red' : 'grey'}
                  shape='circle'
                >
                  {count}
                </Tag>
              </span>
            }
          />
        );
      })}
    </Tabs>
  );
};

export default ChannelsTabs;
