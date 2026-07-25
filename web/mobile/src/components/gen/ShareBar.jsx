import React, { useState } from 'react';
import { Button, Dialog, Toast } from 'antd-mobile';

import { isWeChatBrowser, shareMediaUrl } from '../../utils/share';

// 生成结果下方的分享/保存操作条
const ShareBar = ({ url, filename, hint }) => {
  const [busy, setBusy] = useState(false);

  const handleShare = async () => {
    if (isWeChatBrowser()) {
      Dialog.alert({
        title: '在微信中分享',
        content:
          hint ||
          '微信内置浏览器不支持直接分享文件：图片可长按转发；视频/音频请点右上角「···」选择在浏览器打开后再分享，或先保存到手机相册后发送。',
      });
      return;
    }
    setBusy(true);
    try {
      const result = await shareMediaUrl(url, filename);
      if (result === 'downloaded') {
        Toast.show({ content: '已保存，可在微信中发送' });
      }
    } catch (e) {
      Toast.show({ icon: 'fail', content: '分享失败，请重试' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <Button size='mini' fill='outline' loading={busy} onClick={handleShare}>
        分享 / 保存
      </Button>
    </div>
  );
};

export default ShareBar;
