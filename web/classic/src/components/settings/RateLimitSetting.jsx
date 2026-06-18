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

import React, { useEffect, useState } from 'react';
import { Card, Spin } from '@douyinfe/semi-ui';

import { API, showError, toBoolean } from '../../helpers';
import { useTranslation } from 'react-i18next';
import RequestRateLimit from '../../pages/Setting/RateLimit/SettingsRequestRateLimit';

const RateLimitSetting = () => {
  const { t } = useTranslation();
  // 这里的初始 key 集合同时充当子组件 SettingsRequestRateLimit 的「白名单」：
  // 子组件用 Object.keys(props.options) 过滤可保存字段，首屏若缺少管理员档三件套，
  // 子组件首次同步会把自身 state 收缩掉这些 key，导致管理员档填写后 compareObjects
  // 永远 diff 不出、PUT 不发出（表现为「管理员速率限制填入后无法保存」）。
  // 故必须与子组件默认值保持一致，完整列出全部可保存字段。
  let [inputs, setInputs] = useState({
    ModelRequestRateLimitEnabled: false,
    ModelRequestRateLimitCount: 0,
    ModelRequestRateLimitSuccessCount: 1000,
    ModelRequestRateLimitDurationMinutes: 1,
    ModelRequestRateLimitGroup: '',
    ModelRequestRateLimitAdminFollowUser: true,
    ModelRequestRateLimitAdminCount: 0,
    ModelRequestRateLimitAdminSuccessCount: 0,
  });

  let [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (item.key === 'ModelRequestRateLimitGroup') {
          item.value = JSON.stringify(JSON.parse(item.value), null, 2);
        }

        // ModelRequestRateLimitAdminFollowUser 是 bool 开关，但 key 不以 Enabled 结尾，
        // 必须显式纳入布尔转换；否则加载回来是字符串 "false"，而 JS 中非空字符串恒为 truthy，
        // 导致 Semi Form.Switch 永远显示「开启」、且 `!inputs.X` 恒 false 使管理员档输入框消失
        //（表现为「跟随用户限速关闭保存后仍显示开启，无论任何情况」）。
        // 与后端 model/option.go 的布尔白名单（HasSuffix "Enabled" || == 该 key）保持对称。
        if (
          item.key.endsWith('Enabled') ||
          item.key === 'ModelRequestRateLimitAdminFollowUser'
        ) {
          newInputs[item.key] = toBoolean(item.value);
        } else {
          newInputs[item.key] = item.value;
        }
      });

      setInputs(newInputs);
    } else {
      showError(message);
    }
  };
  async function onRefresh() {
    try {
      setLoading(true);
      await getOptions();
      // showSuccess('刷新成功');
    } catch (error) {
      showError('刷新失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    onRefresh();
  }, []);

  return (
    <>
      <Spin spinning={loading} size='large'>
        {/* AI请求速率限制 */}
        <Card style={{ marginTop: '10px' }}>
          <RequestRateLimit options={inputs} refresh={onRefresh} />
        </Card>
      </Spin>
    </>
  );
};

export default RateLimitSetting;
