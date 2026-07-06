import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Button,
  Avatar,
  Select,
  Toast,
  Checkbox,
  Tooltip,
} from '@douyinfe/semi-ui';
import { Image, HelpCircle } from 'lucide-react';
import { UserContext } from '../../../../context/User';
import { API } from '../../../../helpers';

const ImageStudioCard = ({ t }) => {
  const [userState] = useContext(UserContext);
  const navigate = useNavigate();
  const [tokens, setTokens] = useState([]);
  const [selectedTokenId, setSelectedTokenId] = useState(() => {
    const saved = localStorage.getItem('image_studio_token_id');
    return saved ? Number(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [saveImageToServer, setSaveImageToServer] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (userState?.user?.setting) {
      try {
        const settings = JSON.parse(userState.user.setting);
        setSaveImageToServer(settings.save_image_to_server === true);
      } catch {
        /* silent */
      }
    }
  }, [userState?.user?.setting]);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const res = await API.get('/api/token/?p=0&size=100');
        if (res.data.success) {
          const active = (res.data.data?.items || res.data.data || []).filter(
            (t) => t.status === 1,
          );
          setTokens(active);
        }
      } catch {
        /* silent */
      }
    };
    fetchTokens();
  }, []);

  const handleTokenSelect = async (tokenId) => {
    if (!tokenId) return;
    setLoading(true);
    try {
      const res = await API.post(`/api/token/${tokenId}/key`);
      if (res.data.success) {
        const fullKey = res.data.data.key;
        localStorage.setItem('api_key', `sk-${fullKey}`);
        localStorage.setItem('api_base_url', window.location.origin);
        localStorage.setItem('image_studio_token_id', String(tokenId));
        setSelectedTokenId(tokenId);
        Toast.success(t('令牌已保存'));
      }
    } catch {
      Toast.error(t('获取令牌失败'));
    } finally {
      setLoading(false);
    }
  };

  const openImageStudio = () => {
    if (!localStorage.getItem('api_key')) {
      Toast.warning(t('请先选择令牌'));
      return;
    }
    navigate('/console/image-studio');
  };

  const handleSaveImageToggle = async (checked) => {
    setSavingSettings(true);
    try {
      const res = await API.patch('/api/user/setting', {
        save_image_to_server: checked,
      });
      if (res.data.success) {
        setSaveImageToServer(checked);
        Toast.success(t('设置已保存'));
      } else {
        Toast.error(res.data.message || t('保存失败'));
      }
    } catch {
      Toast.error(t('保存失败'));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='cyan' className='mr-3 shadow-md'>
          <Image size={16} />
        </Avatar>
        <div>
          <Typography.Text className='text-lg font-medium'>
            {t('生图工具')}
          </Typography.Text>
          <div className='text-xs text-gray-600 dark:text-gray-400'>
            {t('AI 图片生成与编辑')}
          </div>
        </div>
      </div>

      <Card className='!rounded-xl border dark:border-gray-700'>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4'>
            <div className='flex items-start w-full sm:w-auto'>
              <div className='w-12 h-12 rounded-full bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center mr-4 flex-shrink-0'>
                <Image size={20} className='text-cyan-600 dark:text-cyan-400' />
              </div>
              <div>
                <Typography.Title heading={6} className='mb-1'>
                  {t('Image Studio')}
                </Typography.Title>
                <Typography.Text type='tertiary' className='text-sm'>
                  {t('支持文生图、图片编辑，基于 gpt-image-2 模型')}
                </Typography.Text>
              </div>
            </div>
            <Button
              theme='solid'
              type='primary'
              onClick={openImageStudio}
              className='console-primary-action !rounded-2xl'
            >
              {t('打开')}
            </Button>
          </div>
          <div>
            <Typography.Text size='small' strong>
              {t('选择令牌')}
            </Typography.Text>
            <Select
              className='mt-1'
              style={{ width: '100%' }}
              placeholder={t('选择一个生效的令牌用于生图')}
              value={selectedTokenId}
              onChange={handleTokenSelect}
              loading={loading}
              optionList={tokens.map((t) => ({ label: t.name, value: t.id }))}
              filter
            />
          </div>
          <div className='flex items-center gap-2'>
            <Checkbox
              checked={saveImageToServer}
              onChange={(e) => handleSaveImageToggle(e.target.checked)}
              disabled={savingSettings}
            >
              {t('服务端保存图片')}
            </Checkbox>
            <Tooltip
              content={t(
                '开启后生成的图片将保存在服务端，可跨设备查看，最多保留7天，可通过请求ID查询。费用：每次成功调用加收 0.05元/张，计入消费记录。',
              )}
            >
              <HelpCircle size={14} className='text-gray-400 cursor-help' />
            </Tooltip>
          </div>
        </div>
      </Card>
    </Card>
  );
};

export default ImageStudioCard;
