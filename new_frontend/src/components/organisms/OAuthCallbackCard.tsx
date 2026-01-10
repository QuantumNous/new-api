import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { CheckCircle2, XCircle } from 'lucide-react';

type OAuthStatus = 'loading' | 'success' | 'error';

interface OAuthCallbackCardProps {
  status: OAuthStatus;
  providerName: string;
  message: string;
  onBackToLogin: () => void;
  onRetry: () => void;
}

export function OAuthCallbackCard({ 
  status, 
  providerName, 
  message, 
  onBackToLogin, 
  onRetry 
}: OAuthCallbackCardProps) {
  return (
    <Card className="w-full max-w-md" data-testid="oauth-callback-card">
      <CardHeader>
        <CardTitle className="text-center">
          {status === 'loading' && `${providerName} 授权中...`}
          {status === 'success' && '授权成功'}
          {status === 'error' && '授权失败'}
        </CardTitle>
        <CardDescription className="text-center">
          {status === 'loading' && '请稍候，正在处理您的授权请求'}
          {status === 'success' && message}
          {status === 'error' && message}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          {status === 'loading' && (
            <LoadingSpinner className="h-12 w-12" data-testid="loading-spinner" />
          )}
          {status === 'success' && (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" data-testid="success-icon" />
            </div>
          )}
          {status === 'error' && (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-8 w-8 text-red-600" data-testid="error-icon" />
            </div>
          )}
        </div>

        {status === 'error' && (
          <div className="mt-6 flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={onBackToLogin}
              data-testid="back-to-login-button"
            >
              返回登录
            </Button>
            <Button
              onClick={onRetry}
              data-testid="retry-button"
            >
              重试
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
