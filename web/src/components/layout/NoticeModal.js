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

import React, { useEffect, useState, useContext, useMemo } from 'react';
import { Button, Modal, Empty, Tabs, TabPane, Timeline } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, getRelativeTime } from '../../helpers';
import { marked } from 'marked';
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations';
import { StatusContext } from '../../context/Status/index.js';
import { Bell, Megaphone } from 'lucide-react';

const NoticeModal = ({ visible, onClose, isMobile, defaultTab = 'inApp', unreadKeys = [] }) => {
  const { t } = useTranslation();
  const [noticeContent, setNoticeContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [statusState] = useContext(StatusContext);

  const announcements = statusState?.status?.announcements || [];

  const unreadSet = useMemo(() => new Set(unreadKeys), [unreadKeys]);

  const getKeyForItem = (item) => `${item?.publishDate || ''}-${(item?.content || '').slice(0, 30)}`;

  const processedAnnouncements = useMemo(() => {
    return (announcements || []).slice(0, 20).map(item => ({
      key: getKeyForItem(item),
      type: item.type || 'default',
      time: getRelativeTime(item.publishDate),
      content: item.content,
      extra: item.extra,
      isUnread: unreadSet.has(getKeyForItem(item))
    }));
  }, [announcements, unreadSet]);

  const handleCloseTodayNotice = () => {
    const today = new Date().toDateString();
    localStorage.setItem('notice_close_date', today);
    onClose();
  };

  const displayNotice = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/notice');
      const { success, message, data } = res.data;
      if (success) {
        if (data !== '') {
          const htmlNotice = marked.parse(data);
          setNoticeContent(htmlNotice);
        } else {
          setNoticeContent('');
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      displayNotice();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, visible]);

  const renderMarkdownNotice = () => {
    if (loading) {
      return <div className="py-12"><Empty description={t('加载中...')} /></div>;
    }

    if (!noticeContent) {
      return (
        <div className="py-12">
          <Empty
            image={<IllustrationNoContent style={{ width: 150, height: 150 }} />}
            darkModeImage={<IllustrationNoContentDark style={{ width: 150, height: 150 }} />}
            description={t('暂无公告')}
          />
        </div>
      );
    }

    return (
      <div
        dangerouslySetInnerHTML={{ __html: noticeContent }}
        className="notice-content-scroll max-h-[55vh] overflow-y-auto pr-2"
      />
    );
  };

  const renderAnnouncementTimeline = () => {
    if (processedAnnouncements.length === 0) {
      return (
        <div className="py-12">
          <Empty
            image={<IllustrationNoContent style={{ width: 150, height: 150 }} />}
            darkModeImage={<IllustrationNoContentDark style={{ width: 150, height: 150 }} />}
            description={t('暂无系统公告')}
          />
        </div>
      );
    }

    return (
      <div className="max-h-[55vh] overflow-y-auto pr-2 card-content-scroll">
        <Timeline mode="alternate">
          {processedAnnouncements.map((item, idx) => {
            const htmlContent = marked.parse(item.content || '');
            const htmlExtra = item.extra ? marked.parse(item.extra) : '';
            return (
              <Timeline.Item
                key={idx}
                type={item.type}
                time={item.time}
                className={item.isUnread ? '' : ''}
              >
                <div>
                  <div
                    className={item.isUnread ? 'shine-text' : ''}
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                  />
                  {item.extra && (
                    <div
                      className="text-xs text-gray-500"
                      dangerouslySetInnerHTML={{ __html: htmlExtra }}
                    />
                  )}
                </div>
              </Timeline.Item>
            );
          })}
        </Timeline>
      </div>
    );
  };

  const renderBody = () => {
    if (activeTab === 'inApp') {
      return renderMarkdownNotice();
    }
    return renderAnnouncementTimeline();
  };

  return (
    <Modal
      title={
        <div className="flex items-center justify-between w-full">
          <span>{t('系统公告')}</span>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type='card'
            size='small'
          >
            <TabPane tab={<span className="flex items-center gap-1"><Bell size={14} /> {t('通知')}</span>} itemKey='inApp' />
            <TabPane tab={<span className="flex items-center gap-1"><Megaphone size={14} /> {t('系统公告')}</span>} itemKey='system' />
          </Tabs>
        </div>
      }
      visible={visible}
      onCancel={onClose}
      footer={(
        <div className="flex justify-end">
          <Button type='secondary' onClick={handleCloseTodayNotice}>{t('今日关闭')}</Button>
          <Button type="primary" onClick={onClose}>{t('关闭公告')}</Button>
        </div>
      )}
      size={isMobile ? 'full-width' : 'large'}
    >
      {renderBody()}
    </Modal>
  );
};

export default NoticeModal; 