import React, { useState, useMemo, useCallback, useContext } from 'react';
import { Card, Chat, Button, Typography, TextArea } from '@douyinfe/semi-ui';
import { Copy, Download, RefreshCw, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  API,
  showSuccess,
  showError,
  getLogo,
  stringToColor,
} from '../../helpers';
import {
  IMAGE_GEN_STATUS,
  IMAGE_API_ENDPOINTS,
  IMAGE_PROMPT_PRESETS,
} from '../../constants/imagePlayground.constants';
import { UserContext } from '../../context/User';
import ImagePreviewModal from './ImagePreviewModal';

// 预设按钮上显示的短标签:截断长提示词,避免撑爆按钮。
const presetLabel = (s) => {
  const v = (s || '').trim();
  return v.length > 22 ? `${v.slice(0, 22)}…` : v;
};

const WELCOME_ID = '__welcome__';
const MAX_PROMPT_LEN = 2000;

const genUserAvatar = (username) => {
  if (!username) return getLogo();
  const firstLetter = username[0].toUpperCase();
  const bgColor = stringToColor(username);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${bgColor}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="16" fill="#ffffff" font-family="sans-serif">${firstLetter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const parseTs = (id, fallback) => {
  const n = Number(String(id).split('-')[1]);
  return Number.isFinite(n) ? n : fallback;
};

// 取图片字节：base64 直接取；远程 url 经后端代理取，绕开 CDN 的 CORS 限制
const fetchImageBlob = async (src) => {
  if (src.startsWith('data:')) {
    const resp = await fetch(src);
    return resp.blob();
  }
  const res = await API.get(
    `${IMAGE_API_ENDPOINTS.IMAGE_PROXY}?url=${encodeURIComponent(src)}`,
    { responseType: 'blob', skipErrorHandler: true },
  );
  return res.data;
};

const copyImage = async (src, t) => {
  try {
    if (!navigator.clipboard || !window.ClipboardItem) {
      throw new Error('clipboard unsupported');
    }
    const blob = await fetchImageBlob(src);
    await navigator.clipboard.write([
      new window.ClipboardItem({ [blob.type || 'image/png']: blob }),
    ]);
    showSuccess(t('图片已复制'));
  } catch (e) {
    showError(t('复制失败'));
  }
};

const downloadImage = async (src, t) => {
  try {
    const blob = await fetchImageBlob(src);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (e) {
    showError(t('下载失败'));
  }
};

const ImageChatArea = ({
  messages,
  generating,
  turnLimitReached = false,
  missingRequiredImage = false,
  onSend,
  onRegenerate,
  onClear,
}) => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const [preview, setPreview] = useState({ visible: false, src: '' });
  // 受控输入框:预设按钮直接 setInputValue,发送后清空(缺图/上限时不清空,提示词不丢)。
  const [inputValue, setInputValue] = useState('');

  const roleConfig = useMemo(
    () => ({
      user: {
        name: userState?.user?.username || 'User',
        avatar: genUserAvatar(userState?.user?.username),
      },
      assistant: { name: t('图片模型'), avatar: getLogo() },
      system: { name: 'System', avatar: getLogo() },
    }),
    [userState, t],
  );

  // 内部消息 -> Semi Chat 所需结构
  const chats = useMemo(() => {
    if (!messages.length) {
      return [
        {
          role: 'assistant',
          id: WELCOME_ID,
          createAt: 1,
          content: t('欢迎使用 AI 图像生成，请在下方输入您的提示词'),
        },
      ];
    }
    return messages.map((m, i) => {
      if (m.role === 'user') {
        return {
          role: 'user',
          id: m.id,
          createAt: parseTs(m.id, i + 1),
          content: m.content,
        };
      }
      const status =
        m.status === IMAGE_GEN_STATUS.PENDING
          ? 'loading'
          : m.status === IMAGE_GEN_STATUS.FAILED
            ? 'error'
            : 'complete';
      return {
        role: 'assistant',
        id: m.id,
        createAt: parseTs(m.id, i + 1),
        status,
        content:
          m.status === IMAGE_GEN_STATUS.FAILED
            ? m.error || t('图片生成失败')
            : '',
      };
    });
  }, [messages, t]);

  const byId = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages],
  );

  // 自定义消息内容：成功的助手消息渲染图片 + 操作按钮
  const renderChatBoxContent = useCallback(
    ({ message, defaultContent }) => {
      const m = byId.get(message.id);
      if (!m || m.role === 'user' || m.status !== IMAGE_GEN_STATUS.SUCCESS) {
        return defaultContent;
      }
      // base64 图片不落盘，刷新后历史里这类图已不在
      if ((!m.images || m.images.length === 0) && m.imagesNotPersisted) {
        return (
          <Typography.Text type='tertiary' className='text-sm'>
            {t('图片仅本次会话可见，刷新后不再保留，请重新生成')}
          </Typography.Text>
        );
      }
      return (
        <div className='inline-block'>
          <Typography.Text className='text-sm text-gray-600 block mb-2'>
            {t('图像已生成')}
          </Typography.Text>
          <div className='flex flex-wrap gap-3'>
            {(m.images || []).map((src, idx) => (
              <img
                key={idx}
                src={src}
                alt='generated'
                onClick={() => setPreview({ visible: true, src })}
                className='rounded-lg cursor-zoom-in object-cover'
                style={{ maxWidth: 360, maxHeight: 360 }}
              />
            ))}
          </div>
          <div className='flex items-center gap-1 mt-2'>
            <Button
              theme='borderless'
              type='tertiary'
              size='small'
              icon={<Copy size={14} />}
              onClick={() => copyImage(m.images[0], t)}
              className='!text-gray-500'
            />
            <Button
              theme='borderless'
              type='tertiary'
              size='small'
              icon={<Download size={14} />}
              onClick={() => downloadImage(m.images[0], t)}
              className='!text-gray-500'
            />
            <Button
              theme='borderless'
              type='tertiary'
              size='small'
              icon={<RefreshCw size={14} />}
              onClick={() => onRegenerate(m.prompt)}
              disabled={generating}
              className='!text-gray-500'
            />
          </div>
        </div>
      );
    },
    [byId, generating, onRegenerate, t],
  );

  // 自定义输入区:预设提示词按钮 + 受控 TextArea + 右下角圆形发送按钮。
  const renderInputArea = useCallback(() => {
    // 缺必填底图/生成中/达上限时置灰,回车与点击均不发送,提示词不丢。
    const blockSend = generating || turnLimitReached || missingRequiredImage;
    const canSend = !blockSend && inputValue.trim().length > 0;
    const doSend = () => {
      if (!canSend) return;
      onSend(inputValue.trim());
      setInputValue('');
    };
    return (
      <div className='p-2 sm:p-4'>
        {turnLimitReached && (
          <Typography.Text
            type='warning'
            className='text-xs block mb-2 text-center'
          >
            {t('本轮对话已达生成上限，请点击右侧「新对话」继续')}
          </Typography.Text>
        )}
        {/* 预设提示词:扁长按钮,防误触;点击清空当前输入并填入该提示词 */}
        <div className='flex flex-wrap gap-2 mb-2'>
          {IMAGE_PROMPT_PRESETS.map((p, i) => (
            <button
              key={i}
              type='button'
              title={p}
              onClick={() => setInputValue(p)}
              className='text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 truncate max-w-[220px] transition-colors'
            >
              {presetLabel(p)}
            </button>
          ))}
        </div>
        <div className='relative'>
          <TextArea
            value={inputValue}
            onChange={setInputValue}
            placeholder={t('请输入图片生成提示词')}
            maxLength={MAX_PROMPT_LEN}
            autosize={{ minRows: 2, maxRows: 6 }}
            className='!rounded-xl'
            style={{ paddingRight: 46 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                doSend();
              }
            }}
          />
          <Button
            theme='solid'
            onClick={doSend}
            disabled={!canSend}
            icon={<Send size={16} className='text-white' />}
            className='!rounded-full !bg-purple-500 hover:!bg-purple-600'
            style={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              width: 32,
              height: 32,
              minWidth: 32,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </div>
      </div>
    );
  }, [
    generating,
    turnLimitReached,
    missingRequiredImage,
    inputValue,
    onSend,
    t,
  ]);

  return (
    <Card
      className='h-full pg-chat-scroll'
      bordered={false}
      bodyStyle={{
        padding: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Chat
        chats={chats}
        roleConfig={roleConfig}
        onMessageSend={(content) => onSend(content)}
        onClear={onClear}
        renderInputArea={renderInputArea}
        chatBoxRenderConfig={{
          renderChatBoxContent,
          renderChatBoxTitle: () => null,
          renderChatBoxAction: () => null,
        }}
        showClearContext
        placeholder={t('请输入图片生成提示词')}
        style={{ height: '100%' }}
      />
      <ImagePreviewModal
        visible={preview.visible}
        src={preview.src}
        onClose={() => setPreview({ visible: false, src: '' })}
      />
    </Card>
  );
};

export default ImageChatArea;
