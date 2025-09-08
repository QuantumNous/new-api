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
import OAuth2ServerSettings from '../../pages/Setting/OAuth2/OAuth2ServerSettings';
import OAuth2ClientSettings from '../../pages/Setting/OAuth2/OAuth2ClientSettings';

const OAuth2Setting = () => {
  const [inputs, setInputs] = useState({
    'oauth2.enabled': false,
    'oauth2.issuer': '',
    'oauth2.access_token_ttl': 10,
    'oauth2.refresh_token_ttl': 720,
    'oauth2.jwt_signing_algorithm': 'RS256',
    'oauth2.jwt_key_id': 'oauth2-key-1',
    'oauth2.jwt_private_key_file': '',
    'oauth2.allowed_grant_types': ['client_credentials', 'authorization_code'],
    'oauth2.require_pkce': true,
    'oauth2.auto_create_user': false,
    'oauth2.default_user_role': 1,
    'oauth2.default_user_group': 'default',
  });
  const [loading, setLoading] = useState(false);

  const getOptions = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/option/');
      const { success, message, data } = res.data;
      if (success) {
        let newInputs = {};
        data.forEach((item) => {
          if (Object.keys(inputs).includes(item.key)) {
            if (item.key === 'oauth2.allowed_grant_types') {
              try {
                newInputs[item.key] = JSON.parse(item.value || '["client_credentials","authorization_code"]');
              } catch {
                newInputs[item.key] = ['client_credentials', 'authorization_code'];
              }
            } else if (typeof inputs[item.key] === 'boolean') {
              newInputs[item.key] = toBoolean(item.value);
            } else if (typeof inputs[item.key] === 'number') {
              newInputs[item.key] = parseInt(item.value) || inputs[item.key];
            } else {
              newInputs[item.key] = item.value;
            }
          }
        });
        setInputs({...inputs, ...newInputs});
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginTop: '10px',
      }}
    >
      <OAuth2ServerSettings options={inputs} refresh={refresh} />
      <OAuth2ClientSettings />
    </div>
  );
};

export default OAuth2Setting;