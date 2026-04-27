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
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Spinner,
  Tab,
  Tabs,
  useOverlayState,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { API, showError, getRelativeTime } from '../../helpers';
import { marked } from 'marked';
import { StatusContext } from '../../context/Status';
import { Bell, Megaphone, Inbox } from 'lucide-react';

const NoticeModal = ({
  visible,
  onClose,
  isMobile,
  defaultTab = 'inApp',
  unreadKeys = [],
}) => {
  const { t } = useTranslation();
  const [noticeContent, setNoticeContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [statusState] = useContext(StatusContext);
  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose();
    },
  });

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
      return (
        <div className='flex flex-col items-center justify-center gap-3 py-12 text-muted'>
          <Spinner color='primary' />
          <span className='text-sm'>{t('加载中...')}</span>
        </div>
      );
    }

    if (!noticeContent) {
      return (
        <EmptyState description={t('暂无公告')} />
      );
    }

    return (
      <div
        dangerouslySetInnerHTML={{ __html: noticeContent }}
        className='notice-content-scroll max-h-[55vh] overflow-y-auto pr-2'
      />
    );
  };

  const renderAnnouncementTimeline = () => {
    if (processedAnnouncements.length === 0) {
      return (
        <EmptyState description={t('暂无系统公告')} />
      );
    }

    return (
      <div className='card-content-scroll max-h-[55vh] overflow-y-auto pr-2'>
        <div className='space-y-5 border-l border-border pl-5'>
          {processedAnnouncements.map((item, idx) => (
            <AnnouncementItem key={idx} item={item} />
          ))}
        </div>
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
    <Modal state={modalState}>
      <ModalBackdrop variant='blur' isDismissable>
        <ModalContainer
          size={isMobile ? 'full' : 'lg'}
          scroll='inside'
          placement='center'
        >
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
          <div className='flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between'>
            <span>{t('系统公告')}</span>
            <Tabs
              size='sm'
              variant='secondary'
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(String(key))}
            >
              <Tab
                key='inApp'
                title={
                  <span className='flex items-center gap-1'>
                    <Bell size={14} /> {t('通知')}
                  </span>
                }
              />
              <Tab
                key='system'
                title={
                  <span className='flex items-center gap-1'>
                    <Megaphone size={14} /> {t('系统公告')}
                  </span>
                }
              />
            </Tabs>
          </div>
            </ModalHeader>
            <ModalBody>{renderBody()}</ModalBody>
            <ModalFooter className='border-t border-border'>
          <Button variant='tertiary' onPress={handleCloseTodayNotice}>
            {t('今日关闭')}
          </Button>
          <Button color='primary' onPress={onClose}>
            {t('关闭公告')}
          </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

const EmptyState = ({ description }) => (
  <div className='flex flex-col items-center justify-center gap-3 py-12 text-muted'>
    <div className='flex h-16 w-16 items-center justify-center rounded-3xl bg-surface-secondary text-muted'>
      <Inbox size={30} />
    </div>
    <span className='text-sm'>{description}</span>
  </div>
);

const typeColorClass = {
  warning: 'bg-warning',
  danger: 'bg-danger',
  success: 'bg-success',
  primary: 'bg-primary',
  default: 'bg-muted',
};

const AnnouncementItem = ({ item }) => {
  const htmlContent = marked.parse(item.content || '');
  const htmlExtra = item.extra ? marked.parse(item.extra) : '';

  return (
    <article className='relative'>
      <span
        className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background ${
          typeColorClass[item.type] || typeColorClass.default
        }`}
      />
      <div className='space-y-2 rounded-2xl border border-border bg-background/70 p-4 shadow-sm'>
        <div className='text-xs font-medium text-muted'>
          {`${item.relative ? item.relative + ' ' : ''}${item.time}`}
        </div>
        <div
          className={item.isUnread ? 'shine-text' : ''}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
        {item.extra && (
          <div
            className='text-xs text-muted'
            dangerouslySetInnerHTML={{ __html: htmlExtra }}
          />
        )}
      </div>
    </article>
  );
};

export default NoticeModal;
