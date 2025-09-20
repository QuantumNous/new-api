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
import { Spin } from '@douyinfe/semi-ui';
import { API, showError } from '../../helpers';
import { useTranslation } from 'react-i18next';
import OAuth2ServerSettings from './oauth2/OAuth2ServerSettings';
import OAuth2ClientSettings from './oauth2/OAuth2ClientSettings';

const OAuth2Setting = () => {
  const { t } = useTranslation();
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState(false);

  const getOptions = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/option/');
      const { success, message, data } = res.data;
      if (success) {
        const map = {};
        for (const item of data) {
          map[item.key] = item.value;
        }
        setOptions(map);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('获取OAuth2设置失败'));
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    getOptions();
  };

  useEffect(() => {
    getOptions();
  }, []);

  return (
    <Spin spinning={loading} size='large'>
      {/* 服务器配置 */}
      <OAuth2ServerSettings 
        options={options} 
        refresh={refresh}
      />

      {/* 客户端管理 */}
      <OAuth2ClientSettings />
    </Spin>
  );
};

export default OAuth2Setting;
