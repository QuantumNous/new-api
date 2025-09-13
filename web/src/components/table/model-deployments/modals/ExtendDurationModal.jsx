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

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Form,
  InputNumber,
  Typography,
  Card,
  Space,
  Divider,
  Button,
  Tag,
  Tooltip,
  Banner,
} from '@douyinfe/semi-ui';
import { 
  FaClock, 
  FaCalculator,
  FaInfoCircle,
  FaExclamationTriangle
} from 'react-icons/fa';
import { API, showError, showSuccess } from '../../../../helpers';

const { Text, Title } = Typography;

const ExtendDurationModal = ({ 
  visible, 
  onCancel, 
  deployment, 
  onSuccess,
  t 
}) => {
  const formRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [durationHours, setDurationHours] = useState(1);
  const [estimatedCost, setEstimatedCost] = useState(null);
  const [costLoading, setCostLoading] = useState(false);

  // Calculate estimated cost based on duration
  const calculateEstimatedCost = async (hours) => {
    if (!deployment?.id || hours <= 0) {
      setEstimatedCost(null);
      return;
    }
    
    setCostLoading(true);
    try {
      // This would call the price estimation API
      // For now, we'll calculate based on remaining time and hardware
      const hourlyRate = 0.5; // Mock hourly rate per GPU
      const gpuCount = deployment.hardware_quantity || 1;
      const cost = hours * hourlyRate * gpuCount;
      
      setEstimatedCost({
        totalCost: cost.toFixed(2),
        hourlyRate: hourlyRate.toFixed(2),
        gpuCount,
        currency: 'USDC'
      });
    } catch (error) {
      console.error('Failed to calculate cost:', error);
      setEstimatedCost(null);
    } finally {
      setCostLoading(false);
    }
  };

  useEffect(() => {
    if (visible && durationHours > 0) {
      calculateEstimatedCost(durationHours);
    }
  }, [visible, durationHours, deployment]);

  const handleExtend = async () => {
    try {
      if (formRef.current) {
        await formRef.current.validate();
      }
      setLoading(true);

      const response = await API.post(`/api/deployments/${deployment.id}/extend`, {
        duration_hours: durationHours
      });

      if (response.data.success) {
        showSuccess(t('容器时长延长成功'));
        onSuccess?.(response.data.data);
        onCancel();
      }
    } catch (error) {
      showError(t('延长时长失败') + ': ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (formRef.current) {
      formRef.current.reset();
    }
    setDurationHours(1);
    setEstimatedCost(null);
    onCancel();
  };

  const currentRemainingTime = deployment?.time_remaining || '0分钟';
  const newTotalTime = `${currentRemainingTime} + ${durationHours}小时`;

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <FaClock className="text-blue-500" />
          <span>{t('延长容器时长')}</span>
        </div>
      }
      visible={visible}
      onCancel={handleCancel}
      onOk={handleExtend}
      okText={t('确认延长')}
      cancelText={t('取消')}
      confirmLoading={loading}
      width={600}
      className="extend-duration-modal"
    >
      <div className="space-y-4">
        {/* Container Info */}
        <Card className="border-0 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <Text strong className="text-base">
                {deployment?.container_name}
              </Text>
              <div className="mt-1">
                <Text type="secondary" size="small">
                  ID: {deployment?.id}
                </Text>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <Tag color="blue" size="small">
                  {deployment?.hardware_name} x{deployment?.hardware_quantity}
                </Tag>
              </div>
              <Text size="small" type="secondary">
                {t('当前剩余')}: <Text strong>{currentRemainingTime}</Text>
              </Text>
            </div>
          </div>
        </Card>

        {/* Warning Banner */}
        <Banner
          type="warning"
          icon={<FaExclamationTriangle />}
          title={t('重要提醒')}
          description={
            <div className="space-y-2">
              <p>{t('延长容器时长将会产生额外费用，请确认您有足够的账户余额。')}</p>
              <p>{t('延长操作一旦确认无法撤销，费用将立即扣除。')}</p>
            </div>
          }
        />

        {/* Form */}
        <Form
          getFormApi={(api) => (formRef.current = api)}
          layout="vertical"
          onValueChange={(values) => {
            if (values.duration_hours !== undefined) {
              setDurationHours(values.duration_hours);
            }
          }}
        >
          <Form.InputNumber
            field="duration_hours"
            label={t('延长时长（小时）')}
            placeholder={t('请输入要延长的小时数')}
            min={1}
            max={720} // Maximum 30 days
            step={1}
            initValue={1}
            style={{ width: '100%' }}
            suffix={t('小时')}
            rules={[
              { required: true, message: t('请输入延长时长') },
              { 
                type: 'number', 
                min: 1, 
                message: t('延长时长至少为1小时') 
              },
              { 
                type: 'number', 
                max: 720, 
                message: t('延长时长不能超过720小时（30天）') 
              }
            ]}
          />
        </Form>

        {/* Quick Selection Buttons */}
        <div className="space-y-2">
          <Text size="small" type="secondary">{t('快速选择')}:</Text>
          <Space wrap>
            {[1, 2, 6, 12, 24, 48, 72, 168].map(hours => (
              <Button
                key={hours}
                size="small"
                theme={durationHours === hours ? 'solid' : 'borderless'}
                type={durationHours === hours ? 'primary' : 'secondary'}
                onClick={() => {
                  setDurationHours(hours);
                  if (formRef.current) {
                    formRef.current.setValue('duration_hours', hours);
                  }
                }}
              >
                {hours < 24 ? `${hours}${t('小时')}` : `${hours / 24}${t('天')}`}
              </Button>
            ))}
          </Space>
        </div>

        <Divider />

        {/* Cost Estimation */}
        <Card 
          title={
            <div className="flex items-center gap-2">
              <FaCalculator className="text-green-500" />
              <span>{t('费用预估')}</span>
            </div>
          }
          className="border border-green-200"
          loading={costLoading}
        >
          {estimatedCost ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Text>{t('延长时长')}:</Text>
                <Text strong>{durationHours} {t('小时')}</Text>
              </div>
              
              <div className="flex items-center justify-between">
                <Text>{t('硬件配置')}:</Text>
                <Text strong>
                  {deployment?.hardware_name} x{estimatedCost.gpuCount}
                </Text>
              </div>
              
              <div className="flex items-center justify-between">
                <Text>{t('单GPU小时费率')}:</Text>
                <Text strong>${estimatedCost.hourlyRate} {estimatedCost.currency}</Text>
              </div>
              
              <Divider margin="12px" />
              
              <div className="flex items-center justify-between">
                <Text strong className="text-lg">{t('预估总费用')}:</Text>
                <Text strong className="text-lg text-green-600">
                  ${estimatedCost.totalCost} {estimatedCost.currency}
                </Text>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <FaInfoCircle className="text-blue-500 mt-0.5" />
                  <div>
                    <Text size="small" type="secondary">
                      {t('延长后总时长')}: <Text strong>{newTotalTime}</Text>
                    </Text>
                    <br />
                    <Text size="small" type="secondary">
                      {t('预估费用仅供参考，实际费用可能略有差异')}
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              <Text type="secondary">
                {durationHours > 0 ? t('计算费用中...') : t('请输入延长时长')}
              </Text>
            </div>
          )}
        </Card>

        {/* Final Confirmation */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <FaExclamationTriangle className="text-red-500 mt-0.5" />
            <div>
              <Text strong className="text-red-700">
                {t('确认延长容器时长')}
              </Text>
              <div className="mt-1">
                <Text size="small" className="text-red-600">
                  {t('点击"确认延长"后将立即扣除费用并延长容器运行时间')}
                </Text>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ExtendDurationModal;