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
import { Card, Spin, Space, Button } from '@douyinfe/semi-ui';
import { API, showError } from '../../helpers';
import OAuth2ServerSettings from '../../pages/Setting/OAuth2/OAuth2ServerSettings';
import OAuth2ClientSettings from '../../pages/Setting/OAuth2/OAuth2ClientSettings';
// import OAuth2Tools from '../../pages/Setting/OAuth2/OAuth2Tools';
import OAuth2ToolsModal from '../../components/modals/oauth2/OAuth2ToolsModal';
import OAuth2QuickStartModal from '../../components/modals/oauth2/OAuth2QuickStartModal';
import JWKSManagerModal from '../../components/modals/oauth2/JWKSManagerModal';

const OAuth2Setting = () => {
  // 原样保存后端 Option 键值（字符串），避免类型转换造成子组件解析错误
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
      showError('获取OAuth2设置失败');
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

  const [qsVisible, setQsVisible] = useState(false);
  const [jwksVisible, setJwksVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginTop: '10px',
      }}
    >
      <Card>
        <Space>
          <Button type='primary' onClick={()=>setQsVisible(true)}>一键初始化向导</Button>
          <Button onClick={()=>setJwksVisible(true)}>JWKS 管理</Button>
          <Button onClick={()=>setToolsVisible(true)}>调试助手</Button>
          <Button onClick={()=>window.open('/oauth-demo.html','_blank')}>前端 Demo</Button>
        </Space>
      </Card>
      <OAuth2QuickStartModal visible={qsVisible} onClose={()=>setQsVisible(false)} onDone={refresh} />
      <JWKSManagerModal visible={jwksVisible} onClose={()=>setJwksVisible(false)} />
      <OAuth2ToolsModal visible={toolsVisible} onClose={()=>setToolsVisible(false)} />
      <OAuth2ServerSettings options={options} refresh={refresh} onOpenJWKS={()=>setJwksVisible(true)} />
      <OAuth2ClientSettings />
    </div>
  );
};

export default OAuth2Setting;
