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
import {
  Button,
  Modal,
  Empty,
  Tabs,
  TabPane,
  Timeline,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { getRelativeTime } from '../../helpers';
import { marked } from 'marked';
import {
  IllustrationNoContent,
  IllustrationNoContentDark,
} from '@douyinfe/semi-illustrations';
import { StatusContext } from '../../context/Status';
import { ArrowRight, Bell, BookOpen, Megaphone, MessageCircle } from 'lucide-react';

const NoticeModal = ({
  visible,
  onClose,
  isMobile,
  defaultTab = 'inApp',
  unreadKeys = [],
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [statusState] = useContext(StatusContext);

  const announcements = statusState?.status?.announcements || [];

  const unreadSet = useMemo(() => new Set(unreadKeys), [unreadKeys]);

  const getKeyForItem = (item) =>
    `${item?.publishDate || ''}-${(item?.content || '').slice(0, 30)}`;

  const processedAnnouncements = useMemo(() => {
    return (announcements || []).slice(0, 20).map((item) => {
      const pubDate = item?.publishDate ? new Date(item.publishDate) : null;
      const absoluteTime =
        pubDate && !isNaN(pubDate.getTime())
          ? `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')} ${String(pubDate.getHours()).padStart(2, '0')}:${String(pubDate.getMinutes()).padStart(2, '0')}`
          : item?.publishDate || '';
      return {
        key: getKeyForItem(item),
        type: item.type || 'default',
        time: absoluteTime,
        content: item.content,
        extra: item.extra,
        relative: getRelativeTime(item.publishDate),
        isUnread: unreadSet.has(getKeyForItem(item)),
      };
    });
  }, [announcements, unreadSet]);

  const handleCloseTodayNotice = () => {
    const today = new Date().toDateString();
    localStorage.setItem('notice_close_date', today);
    onClose();
  };

  useEffect(() => {
    if (visible) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, visible]);

  const renderWelcomeNotice = () => {
    const quickLinks = [
      {
        key: 'docs',
        title: '教程说明',
        description: '前往文档查看完整使用指南',
        hint: '快速上手 · 常见问题',
        href: '/docs',
        icon: <BookOpen size={18} />,
      },
      {
        key: 'qq',
        title: 'QQ群',
        description: '打开群二维码图片，加入交流群',
        hint: '群号749308101.来找悠米玩~',
        href: '/qq-group.jpg',
        icon: <MessageCircle size={18} />,
      },
    ];

    return (
      <div className='youmi-notice-shell'>
        <div className='youmi-notice-head'>
          <div className='youmi-notice-emoji'>✨</div>
          <h3 className='youmi-notice-title'>欢迎来到悠米の小窝！</h3>
          <p className='youmi-notice-subtitle'>
            吃尽兴后可以来小窝找悠米和小伙伴们聊天喔~
          </p>
        </div>

        <div className='youmi-notice-divider' />

        <div className='youmi-notice-badge'>功能入口</div>

        <div className='youmi-notice-grid'>
          {quickLinks.map((item) => (
            <a
              key={item.key}
              href={item.href}
              target='_blank'
              rel='noreferrer'
              className='youmi-notice-card'
            >
              <div className='youmi-notice-card-icon'>{item.icon}</div>
              <div className='youmi-notice-card-main'>
                <div className='youmi-notice-card-title'>
                  {item.title}
                  <ArrowRight size={14} className='youmi-notice-card-arrow' />
                </div>
                <div className='youmi-notice-card-desc'>{item.description}</div>
                <div className='youmi-notice-card-hint'>{item.hint}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  };

  const renderAnnouncementTimeline = () => {
    if (processedAnnouncements.length === 0) {
      return (
        <div className='py-12'>
          <Empty
            image={
              <IllustrationNoContent style={{ width: 150, height: 150 }} />
            }
            darkModeImage={
              <IllustrationNoContentDark style={{ width: 150, height: 150 }} />
            }
            description={t('暂无系统公告')}
          />
        </div>
      );
    }

    return (
      <div className='max-h-[55vh] overflow-y-auto pr-2 card-content-scroll'>
        <Timeline mode='left'>
          {processedAnnouncements.map((item, idx) => {
            const htmlContent = marked.parse(item.content || '');
            const htmlExtra = item.extra ? marked.parse(item.extra) : '';
            return (
              <Timeline.Item
                key={idx}
                type={item.type}
                time={`${item.relative ? item.relative + ' ' : ''}${item.time}`}
                extra={
                  item.extra ? (
                    <div
                      className='text-xs text-gray-500'
                      dangerouslySetInnerHTML={{ __html: htmlExtra }}
                    />
                  ) : null
                }
                className={item.isUnread ? '' : ''}
              >
                <div>
                  <div
                    className={item.isUnread ? 'shine-text' : ''}
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                  />
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
      return renderWelcomeNotice();
    }
    return renderAnnouncementTimeline();
  };

  return (
    <Modal
      className='youmi-notice-modal'
      title={
        <div className='flex items-center justify-between w-full gap-3'>
          <span className='youmi-notice-header-title'>{t('系统公告')}</span>
          <Tabs
            className='youmi-notice-tabs'
            activeKey={activeTab}
            onChange={setActiveTab}
            type='button'
          >
            <TabPane
              tab={
                <span className='flex items-center gap-1'>
                  <Bell size={14} /> {t('通知')}
                </span>
              }
              itemKey='inApp'
            />
            <TabPane
              tab={
                <span className='flex items-center gap-1'>
                  <Megaphone size={14} /> {t('系统公告')}
                </span>
              }
              itemKey='system'
            />
          </Tabs>
        </div>
      }
      visible={visible}
      onCancel={onClose}
      footer={
        <div className='youmi-notice-footer-actions'>
          <Button
            className='youmi-notice-btn youmi-notice-btn-secondary'
            type='secondary'
            onClick={handleCloseTodayNotice}
          >
            {t('今日关闭')}
          </Button>
          <Button
            className='youmi-notice-btn youmi-notice-btn-primary'
            type='primary'
            onClick={onClose}
          >
            {t('关闭公告')}
          </Button>
        </div>
      }
      size={isMobile ? 'full-width' : 'large'}
    >
      {renderBody()}
    </Modal>
  );
};

export default NoticeModal;
