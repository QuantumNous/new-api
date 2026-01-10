import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { OAuthCallbackCard } from '@/components/organisms/OAuthCallbackCard';
import { OAuthProvider, PROVIDER_NAMES } from '@/constants/oauth';

export default function OAuthCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { provider } = useParams<{ provider: OAuthProvider }>();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`授权失败: ${error}`);
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('缺少授权码');
          return;
        }

        // TODO: 调用 OAuth 回调 API
        // const response = await userService.oauthCallback(provider, code, state);
        
        // 模拟 API 调用
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 模拟成功
        setStatus('success');
        setMessage('登录成功，正在跳转...');

        // 跳转到控制台
        setTimeout(() => {
          navigate('/console/dashboard');
        }, 1500);
      } catch (error: any) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'OAuth 授权失败');
      }
    };

    handleOAuthCallback();
  }, [searchParams, provider, navigate]);

  const providerName = provider ? PROVIDER_NAMES[provider] : 'OAuth';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <OAuthCallbackCard
        status={status}
        providerName={providerName}
        message={message}
        onBackToLogin={() => navigate('/auth/login')}
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}
