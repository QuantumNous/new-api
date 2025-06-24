import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  API,
  isMobile,
  showError,
  showSuccess,
  timestamp2string,
  renderGroupOption,
  renderQuotaWithPrompt,
} from '../../helpers';
import {
  AutoComplete,
  Banner,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Select,
  SideSheet,
  Space,
  Spin,
  TextArea,
  Typography,
  Card,
  Tag,
} from '@douyinfe/semi-ui';
import {
  IconClock,
  IconCalendar,
  IconCreditCard,
  IconLink,
  IconServer,
  IconUserGroup,
  IconSave,
  IconClose,
  IconPlusCircle,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';

const { Text, Title } = Typography;

const EditToken = (props) => {
  const { t } = useTranslation();
  const [statusState, statusDispatch] = useContext(StatusContext);
  const [isEdit, setIsEdit] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const originInputs = {
    name: '',
    remain_quota: isEdit ? 0 : 500000,
    expired_time: -1,
    unlimited_quota: false,
    model_limits_enabled: false,
    model_limits: [],
    allow_ips: '',
    group: '',
  };
  const [inputs, setInputs] = useState(originInputs);
  const {
    name,
    remain_quota,
    expired_time,
    unlimited_quota,
    model_limits_enabled,
    model_limits,
    allow_ips,
    group,
  } = inputs;
  const [models, setModels] = useState([]);
  const [groups, setGroups] = useState([]);
  const navigate = useNavigate();

  const handleInputChange = (name, value) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  const handleCancel = () => {
    props.handleClose();
  };

  const setExpiredTime = (month, day, hour, minute) => {
    let now = new Date();
    let timestamp = now.getTime() / 1000;
    let seconds = month * 30 * 24 * 60 * 60;
    seconds += day * 24 * 60 * 60;
    seconds += hour * 60 * 60;
    seconds += minute * 60;
    if (seconds !== 0) {
      timestamp += seconds;
      setInputs({ ...inputs, expired_time: timestamp2string(timestamp) });
    } else {
      setInputs({ ...inputs, expired_time: -1 });
    }
  };

  const setUnlimitedQuota = () => {
    setInputs({ ...inputs, unlimited_quota: !unlimited_quota });
  };

  const loadModels = async () => {
    let res = await API.get(`/api/user/models`);
    const { success, message, data } = res.data;
    if (success) {
      let localModelOptions = data.map((model) => ({
        label: model,
        value: model,
      }));
      setModels(localModelOptions);
    } else {
      showError(t(message));
    }
  };

  const loadGroups = async () => {
    let res = await API.get(`/api/user/self/groups`);
    const { success, message, data } = res.data;
    if (success) {
      let localGroupOptions = Object.entries(data).map(([group, info]) => ({
        label: info.desc,
        value: group,
        ratio: info.ratio,
      }));
      if (statusState?.status?.default_use_auto_group) {
        // if contain auto, add it to the first position
        if (localGroupOptions.some((group) => group.value === 'auto')) {
          // 排序
          localGroupOptions.sort((a, b) => (a.value === 'auto' ? -1 : 1));
        } else {
          localGroupOptions.unshift({ label: t('自动选择'), value: 'auto' });
        }
      }
      setGroups(localGroupOptions);
      if (statusState?.status?.default_use_auto_group) {
        setInputs({ ...inputs, group: 'auto' });
      }
    } else {
      showError(t(message));
    }
  };

  const loadToken = async () => {
    setLoading(true);
    let res = await API.get(`/api/token/${props.editingToken.id}`);
    const { success, message, data } = res.data;
    if (success) {
      if (data.expired_time !== -1) {
        data.expired_time = timestamp2string(data.expired_time);
      }
      if (data.model_limits !== '') {
        data.model_limits = data.model_limits.split(',');
      } else {
        data.model_limits = [];
      }
      setInputs(data);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    setIsEdit(props.editingToken.id !== undefined);
  }, [props.editingToken.id]);

  useEffect(() => {
    if (!isEdit) {
      setInputs(originInputs);
    } else {
      loadToken().then(() => {
        // console.log(inputs);
      });
    }
    loadModels();
    loadGroups();
  }, [isEdit]);

  // 新增 state 变量 tokenCount 来记录用户想要创建的令牌数量，默认为 1
  const [tokenCount, setTokenCount] = useState(1);

  // 新增处理 tokenCount 变化的函数
  const handleTokenCountChange = (value) => {
    // 确保用户输入的是正整数
    const count = parseInt(value, 10);
    if (!isNaN(count) && count > 0) {
      setTokenCount(count);
    }
  };

  // 生成一个随机的四位字母数字字符串
  const generateRandomSuffix = () => {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    return result;
  };

  const submit = async () => {
    setLoading(true);
    if (isEdit) {
      // 编辑令牌的逻辑保持不变
      let localInputs = { ...inputs };
      localInputs.remain_quota = parseInt(localInputs.remain_quota);
      if (localInputs.expired_time !== -1) {
        let time = Date.parse(localInputs.expired_time);
        if (isNaN(time)) {
          showError(t('过期时间格式错误！'));
          setLoading(false);
          return;
        }
        localInputs.expired_time = Math.ceil(time / 1000);
      }
      localInputs.model_limits = localInputs.model_limits.join(',');
      let res = await API.put(`/api/token/`, {
        ...localInputs,
        id: parseInt(props.editingToken.id),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('令牌更新成功！'));
        props.refresh();
        props.handleClose();
      } else {
        showError(t(message));
      }
    } else {
      // 处理新增多个令牌的情况
      let successCount = 0; // 记录成功创建的令牌数量
      for (let i = 0; i < tokenCount; i++) {
        let localInputs = { ...inputs };

        // 检查用户是否填写了令牌名称
        const baseName = inputs.name.trim() === '' ? 'default' : inputs.name;

        if (i !== 0 || inputs.name.trim() === '') {
          // 如果创建多个令牌（i !== 0）或者用户没有填写名称，则添加随机后缀
          localInputs.name = `${baseName}-${generateRandomSuffix()}`;
        } else {
          localInputs.name = baseName;
        }
        localInputs.remain_quota = parseInt(localInputs.remain_quota);

        if (localInputs.expired_time !== -1) {
          let time = Date.parse(localInputs.expired_time);
          if (isNaN(time)) {
            showError(t('过期时间格式错误！'));
            setLoading(false);
            break;
          }
          localInputs.expired_time = Math.ceil(time / 1000);
        }
        localInputs.model_limits = localInputs.model_limits.join(',');
        let res = await API.post(`/api/token/`, localInputs);
        const { success, message } = res.data;

        if (success) {
          successCount++;
        } else {
          showError(t(message));
          break; // 如果创建失败，终止循环
        }
      }

      if (successCount > 0) {
        showSuccess(t('令牌创建成功，请在列表页面点击复制获取令牌！'));
        props.refresh();
        props.handleClose();
      }
    }
    setLoading(false);
    setInputs(originInputs); // 重置表单
    setTokenCount(1); // 重置数量为默认值
  };

  return (
    <SideSheet
      placement={isEdit ? 'right' : 'left'}
      title={
        <Space>
          {isEdit ? (
            <Tag color='blue' shape='circle'>
              {t('更新')}
            </Tag>
          ) : (
            <Tag color='green' shape='circle'>
              {t('新建')}
            </Tag>
          )}
          <Title heading={4} className='m-0'>
            {isEdit ? t('更新令牌信息') : t('创建新的令牌')}
          </Title>
        </Space>
      }
      headerStyle={{
        borderBottom: '1px solid var(--semi-color-border)',
        padding: '24px',
      }}
      bodyStyle={{
        backgroundColor: 'var(--semi-color-bg-0)',
        padding: '0',
      }}
      visible={props.visiable}
      width={isMobile() ? '100%' : 600}
      footer={
        <div className='flex justify-end bg-white'>
          <Space>
            <Button
              theme='solid'
              size='large'
              className='!rounded-full'
              onClick={submit}
              icon={<IconSave />}
              loading={loading}
            >
              {t('提交')}
            </Button>
            <Button
              theme='light'
              size='large'
              className='!rounded-full'
              type='primary'
              onClick={handleCancel}
              icon={<IconClose />}
            >
              {t('取消')}
            </Button>
          </Space>
        </div>
      }
      closeIcon={null}
      onCancel={() => handleCancel()}
    >
      <Spin spinning={loading}>
        <div className='p-6'>
          <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
            <div
              className='flex items-center mb-4 p-6 rounded-xl'
              style={{
                background:
                  'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
                position: 'relative',
              }}
            >
              <div className='absolute inset-0 overflow-hidden'>
                <div className='absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full'></div>
                <div className='absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full'></div>
              </div>
              <div className='w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative'>
                <IconPlusCircle size='large' style={{ color: '#ffffff' }} />
              </div>
              <div className='relative'>
                <Text
                  style={{ color: '#ffffff' }}
                  className='text-lg font-medium'
                >
                  {t('基本信息')}
                </Text>
                <div
                  style={{ color: '#ffffff' }}
                  className='text-sm opacity-80'
                >
                  {t('设置令牌的基本信息')}
                </div>
              </div>
            </div>

            <div className='space-y-4'>
              <div>
                <Text strong className='block mb-2'>
                  {t('名称')}
                </Text>
                <Input
                  placeholder={t('请输入名称')}
                  onChange={(value) => handleInputChange('name', value)}
                  value={name}
                  autoComplete='new-password'
                  size='large'
                  className='!rounded-lg'
                  showClear
                  required
                />
              </div>

              <div>
                <Text strong className='block mb-2'>
                  {t('过期时间')}
                </Text>
                <div className='mb-2'>
                  <DatePicker
                    placeholder={t('请选择过期时间')}
                    onChange={(value) =>
                      handleInputChange('expired_time', value)
                    }
                    value={expired_time}
                    autoComplete='new-password'
                    type='dateTime'
                    className='w-full !rounded-lg'
                    size='large'
                    prefix={<IconCalendar />}
                  />
                </div>

                <div className='flex flex-wrap gap-2'>
                  <Button
                    theme='light'
                    type='primary'
                    onClick={() => setExpiredTime(0, 0, 0, 0)}
                    className='!rounded-full'
                  >
                    {t('永不过期')}
                  </Button>
                  <Button
                    theme='light'
                    type='tertiary'
                    onClick={() => setExpiredTime(0, 0, 1, 0)}
                    className='!rounded-full'
                    icon={<IconClock />}
                  >
                    {t('一小时')}
                  </Button>
                  <Button
                    theme='light'
                    type='tertiary'
                    onClick={() => setExpiredTime(0, 1, 0, 0)}
                    className='!rounded-full'
                    icon={<IconCalendar />}
                  >
                    {t('一天')}
                  </Button>
                  <Button
                    theme='light'
                    type='tertiary'
                    onClick={() => setExpiredTime(1, 0, 0, 0)}
                    className='!rounded-full'
                    icon={<IconCalendar />}
                  >
                    {t('一个月')}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
            <div
              className='flex items-center mb-4 p-6 rounded-xl'
              style={{
                background:
                  'linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%)',
                position: 'relative',
              }}
            >
              <div className='absolute inset-0 overflow-hidden'>
                <div className='absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full'></div>
                <div className='absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full'></div>
              </div>
              <div className='w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative'>
                <IconCreditCard size='large' style={{ color: '#ffffff' }} />
              </div>
              <div className='relative'>
                <Text
                  style={{ color: '#ffffff' }}
                  className='text-lg font-medium'
                >
                  {t('额度设置')}
                </Text>
                <div
                  style={{ color: '#ffffff' }}
                  className='text-sm opacity-80'
                >
                  {t('设置令牌可用额度和数量')}
                </div>
              </div>
            </div>

            <Banner
              type='warning'
              description={t(
                '注意，令牌的额度仅用于限制令牌本身的最大额度使用量，实际的使用受到账户的剩余额度限制。',
              )}
              className='mb-4 !rounded-lg'
            />

            <div className='space-y-4'>
              <div>
                <div className='flex justify-between mb-2'>
                  <Text strong>{t('额度')}</Text>
                  <Text type='tertiary'>
                    {renderQuotaWithPrompt(remain_quota)}
                  </Text>
                </div>
                <AutoComplete
                  placeholder={t('请输入额度')}
                  onChange={(value) => handleInputChange('remain_quota', value)}
                  value={remain_quota}
                  autoComplete='new-password'
                  type='number'
                  size='large'
                  className='w-full !rounded-lg'
                  prefix={<IconCreditCard />}
                  data={[
                    { value: 500000, label: '1$' },
                    { value: 5000000, label: '10$' },
                    { value: 25000000, label: '50$' },
                    { value: 50000000, label: '100$' },
                    { value: 250000000, label: '500$' },
                    { value: 500000000, label: '1000$' },
                  ]}
                  disabled={unlimited_quota}
                />
              </div>

              {!isEdit && (
                <div>
                  <Text strong className='block mb-2'>
                    {t('新建数量')}
                  </Text>
                  <AutoComplete
                    placeholder={t('请选择或输入创建令牌的数量')}
                    onChange={(value) => handleTokenCountChange(value)}
                    onSelect={(value) => handleTokenCountChange(value)}
                    value={tokenCount.toString()}
                    autoComplete='off'
                    type='number'
                    className='w-full !rounded-lg'
                    size='large'
                    prefix={<IconPlusCircle />}
                    data={[
                      { value: 10, label: t('10个') },
                      { value: 20, label: t('20个') },
                      { value: 30, label: t('30个') },
                      { value: 100, label: t('100个') },
                    ]}
                    disabled={unlimited_quota}
                  />
                </div>
              )}

              <div className='flex justify-end'>
                <Button
                  theme='light'
                  type={unlimited_quota ? 'danger' : 'warning'}
                  onClick={setUnlimitedQuota}
                  className='!rounded-full'
                >
                  {unlimited_quota ? t('取消无限额度') : t('设为无限额度')}
                </Button>
              </div>
            </div>
          </Card>

          <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
            <div
              className='flex items-center mb-4 p-6 rounded-xl'
              style={{
                background:
                  'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #7c3aed 100%)',
                position: 'relative',
              }}
            >
              <div className='absolute inset-0 overflow-hidden'>
                <div className='absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full'></div>
                <div className='absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full'></div>
              </div>
              <div className='w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative'>
                <IconLink size='large' style={{ color: '#ffffff' }} />
              </div>
              <div className='relative'>
                <Text
                  style={{ color: '#ffffff' }}
                  className='text-lg font-medium'
                >
                  {t('访问限制')}
                </Text>
                <div
                  style={{ color: '#ffffff' }}
                  className='text-sm opacity-80'
                >
                  {t('设置令牌的访问限制')}
                </div>
              </div>
            </div>

            <div className='space-y-4'>
              <div>
                <Text strong className='block mb-2'>
                  {t('IP白名单')}
                </Text>
                <TextArea
                  placeholder={t('允许的IP，一行一个，不填写则不限制')}
                  onChange={(value) => handleInputChange('allow_ips', value)}
                  value={inputs.allow_ips}
                  style={{ fontFamily: 'JetBrains Mono, Consolas' }}
                  className='!rounded-lg'
                  rows={4}
                />
                <Text type='tertiary' className='mt-1 block text-xs'>
                  {t('请勿过度信任此功能，IP可能被伪造')}
                </Text>
              </div>

              <div>
                <div className='flex items-center mb-2'>
                  <Checkbox
                    checked={model_limits_enabled}
                    onChange={(e) =>
                      handleInputChange(
                        'model_limits_enabled',
                        e.target.checked,
                      )
                    }
                  >
                    <Text strong>{t('模型限制')}</Text>
                  </Checkbox>
                </div>
                <Select
                  placeholder={
                    model_limits_enabled
                      ? t('请选择该渠道所支持的模型')
                      : t('勾选启用模型限制后可选择')
                  }
                  onChange={(value) => handleInputChange('model_limits', value)}
                  value={inputs.model_limits}
                  multiple
                  size='large'
                  className='w-full !rounded-lg'
                  prefix={<IconServer />}
                  optionList={models}
                  disabled={!model_limits_enabled}
                  maxTagCount={3}
                />
                <Text type='tertiary' className='mt-1 block text-xs'>
                  {t('非必要，不建议启用模型限制')}
                </Text>
              </div>
            </div>
          </Card>

          <Card className='!rounded-2xl shadow-sm border-0'>
            <div
              className='flex items-center mb-4 p-6 rounded-xl'
              style={{
                background:
                  'linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%)',
                position: 'relative',
              }}
            >
              <div className='absolute inset-0 overflow-hidden'>
                <div className='absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full'></div>
                <div className='absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full'></div>
              </div>
              <div className='w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative'>
                <IconUserGroup size='large' style={{ color: '#ffffff' }} />
              </div>
              <div className='relative'>
                <Text
                  style={{ color: '#ffffff' }}
                  className='text-lg font-medium'
                >
                  {t('分组信息')}
                </Text>
                <div
                  style={{ color: '#ffffff' }}
                  className='text-sm opacity-80'
                >
                  {t('设置令牌的分组')}
                </div>
              </div>
            </div>

            <div>
              <Text strong className='block mb-2'>
                {t('令牌分组')}
              </Text>
              {groups.length > 0 ? (
                <Select
                  placeholder={t('令牌分组，默认为用户的分组')}
                  onChange={(value) => handleInputChange('group', value)}
                  renderOptionItem={renderGroupOption}
                  value={inputs.group}
                  size='large'
                  className='w-full !rounded-lg'
                  prefix={<IconUserGroup />}
                  optionList={groups}
                />
              ) : (
                <Select
                  placeholder={t('管理员未设置用户可选分组')}
                  disabled={true}
                  size='large'
                  className='w-full !rounded-lg'
                  prefix={<IconUserGroup />}
                />
              )}
            </div>
          </Card>
        </div>
      </Spin>
    </SideSheet>
  );
};

export default EditToken;
