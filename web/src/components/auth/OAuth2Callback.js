import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, updateAPI, setUserData } from '../../helpers';
import { UserContext } from '../../context/User';
import Loading from '../common/Loading';

const OAuth2Callback = (props) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [userState, userDispatch] = useContext(UserContext);
  const [prompt, setPrompt] = useState(t('处理中...'));

  let navigate = useNavigate();

  const sendCode = async (code, state, count) => {
    const res = await API.get(
      `/api/oauth/${props.type}?code=${code}&state=${state}`,
    );
    const { success, message, data } = res.data;
    if (success) {
      if (message === 'bind') {
        showSuccess(t('绑定成功！'));
        navigate('/console/setting');
      } else {
        userDispatch({ type: 'login', payload: data });
        localStorage.setItem('user', JSON.stringify(data));
        setUserData(data);
        updateAPI();
        showSuccess(t('登录成功！'));
        navigate('/console/token');
      }
    } else {
      showError(message);
      if (count === 0) {
        setPrompt(t('操作失败，重定向至登录界面中...'));
        navigate('/console/setting'); // in case this is failed to bind GitHub
        return;
      }
      count++;
      setPrompt(t('出现错误，第 ${count} 次重试中...', { count }));
      await new Promise((resolve) => setTimeout(resolve, count * 2000));
      await sendCode(code, state, count);
    }
  };

  useEffect(() => {
    let code = searchParams.get('code');
    let state = searchParams.get('state');
    sendCode(code, state, 0).then();
  }, []);

  return <Loading prompt={prompt} />;
};

export default OAuth2Callback;
