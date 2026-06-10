import React, { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Button,
  Image,
  Spin,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconImage, IconClose, IconSend } from '@douyinfe/semi-icons';
import { API, showError } from '../../helpers';
import { useTranslation } from 'react-i18next';
import {
  compressImageToBase64,
  FEEDBACK_MAX_IMAGES,
  FEEDBACK_ROLE_ADMIN,
} from './feedbackHelpers';

const { Text } = Typography;

// 单张图片缩略图：按 id 懒加载 base64（用户/管理员走不同基址）。
function FeedbackImageThumb({ imageBase, id }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    API.get(`${imageBase}/images/${id}`)
      .then((res) => {
        if (alive && res.data.success) setSrc(res.data.data.image);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [imageBase, id]);

  if (!src) {
    return (
      <div className='flex items-center justify-center w-20 h-20 rounded-lg bg-gray-100'>
        <Spin size='small' />
      </div>
    );
  }
  return (
    <Image
      src={src}
      width={80}
      height={80}
      style={{ objectFit: 'cover', borderRadius: 8 }}
    />
  );
}

// 一条消息气泡。视角相对：author_role === viewerRole 时靠右（自己），否则靠左。
function MessageBubble({ msg, viewerRole, imageBase }) {
  const { t } = useTranslation();
  const isSelf = msg.author_role === viewerRole;
  const isAdmin = msg.author_role === FEEDBACK_ROLE_ADMIN;

  const name = isAdmin
    ? `${t('客服')}${msg.author_name ? ' · ' + msg.author_name : ''}`
    : msg.author_name || t('用户');

  return (
    <div
      className={`flex gap-2 mb-4 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <Avatar size='small' color={isAdmin ? 'blue' : 'green'}>
        {name.slice(0, 1)}
      </Avatar>
      <div
        className={`flex flex-col max-w-[75%] ${isSelf ? 'items-end' : 'items-start'}`}
      >
        <div className='flex items-center gap-2 mb-1'>
          {isAdmin && (
            <Text
              size='small'
              type='tertiary'
              className='px-1 rounded bg-blue-50'
            >
              {t('官方')}
            </Text>
          )}
          <Text size='small' type='tertiary'>
            {name}
          </Text>
          <Text size='small' type='quaternary'>
            {new Date(msg.created_at).toLocaleString()}
          </Text>
        </div>
        {msg.content && (
          <div
            className={`px-3 py-2 rounded-lg whitespace-pre-wrap break-words ${
              isSelf ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {msg.content}
          </div>
        )}
        {msg.image_ids && msg.image_ids.length > 0 && (
          <div className='flex flex-wrap gap-2 mt-2'>
            {msg.image_ids.map((id) => (
              <FeedbackImageThumb key={id} imageBase={imageBase} id={id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 对话线程 + 回复框（图片上传）。用户卡片与管理员后台共用。
export default function FeedbackThread({
  messages,
  viewerRole,
  imageBase,
  onSend,
  sending,
  disabled,
  placeholder,
}) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]); // base64[]
  const fileRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    const room = FEEDBACK_MAX_IMAGES - images.length;
    if (room <= 0) {
      showError(t('最多上传 3 张图片'));
      return;
    }
    try {
      const picked = files.slice(0, room);
      const encoded = await Promise.all(
        picked.map((f) => compressImageToBase64(f)),
      );
      setImages((prev) => [...prev, ...encoded]);
    } catch {
      showError(t('图片处理失败'));
    }
  };

  const submit = async () => {
    if (!content.trim() && images.length === 0) {
      showError(t('请输入内容或上传图片'));
      return;
    }
    const ok = await onSend(content.trim(), images);
    if (ok) {
      setContent('');
      setImages([]);
    }
  };

  return (
    <div className='flex flex-col h-full'>
      <div
        className='flex-1 overflow-y-auto px-1 py-2'
        style={{ minHeight: 200, maxHeight: 420 }}
      >
        {messages.length === 0 ? (
          <div className='flex items-center justify-center h-full'>
            <Text type='tertiary'>{t('暂无消息')}</Text>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              viewerRole={viewerRole}
              imageBase={imageBase}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      {!disabled && (
        <div className='border-t pt-2'>
          {images.length > 0 && (
            <div className='flex flex-wrap gap-2 mb-2'>
              {images.map((b64, idx) => (
                <div key={idx} className='relative'>
                  <Image
                    src={`data:image/jpeg;base64,${b64}`}
                    width={64}
                    height={64}
                    preview={false}
                    style={{ objectFit: 'cover', borderRadius: 6 }}
                  />
                  <IconClose
                    className='absolute -top-1 -right-1 bg-gray-700 text-white rounded-full cursor-pointer'
                    size='small'
                    onClick={() =>
                      setImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                  />
                </div>
              ))}
            </div>
          )}
          <div className='flex items-end gap-2'>
            <input
              ref={fileRef}
              type='file'
              accept='image/*'
              multiple
              className='hidden'
              onChange={handleFiles}
            />
            <Button
              icon={<IconImage />}
              theme='borderless'
              onClick={() => fileRef.current?.click()}
              disabled={images.length >= FEEDBACK_MAX_IMAGES}
            />
            <TextArea
              value={content}
              onChange={setContent}
              placeholder={placeholder || t('输入回复内容…')}
              autosize={{ minRows: 1, maxRows: 4 }}
              className='flex-1'
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
              }}
            />
            <Button
              icon={<IconSend />}
              theme='solid'
              type='primary'
              loading={sending}
              onClick={submit}
            >
              {t('发送')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
