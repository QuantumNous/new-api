import React from 'react';
import { useTokenKeys } from '../../hooks/useTokenKeys';
import { Spin } from '@douyinfe/semi-ui';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const ChatPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { keys, serverAddress, isLoading } = useTokenKeys(id);

  const comLink = (key) => {
    // console.log('chatLink:', chatLink);
    if (!serverAddress || !key) return '';
    let link = '';
    if (id) {
      let chats = localStorage.getItem('chats');
      if (chats) {
        chats = JSON.parse(chats);
        if (Array.isArray(chats) && chats.length > 0) {
          for (let k in chats[id]) {
            link = chats[id][k];
            link = link.replaceAll(
              '{address}',
              encodeURIComponent(serverAddress),
            );
            link = link.replaceAll('{key}', 'sk-' + key);
          }
        }
      }
    }
    return link;
  };

  const iframeSrc = keys.length > 0 ? comLink(keys[0]) : '';

  return !isLoading && iframeSrc ? (
    <iframe
      src={iframeSrc}
      style={{ width: '100%', height: '100%', border: 'none' }}
      title='Token Frame'
      allow='camera;microphone'
    />
  ) : (
    <div className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-white/80 z-[1000]">
      <div className="flex flex-col items-center">
        <Spin
          size="large"
          spinning={true}
          tip={null}
        />
        <span className="whitespace-nowrap mt-2 text-center" style={{ color: 'var(--semi-color-primary)' }}>
          {t('正在跳转...')}
        </span>
      </div>
    </div>
  );
};

export default ChatPage;
