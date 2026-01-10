import { useState } from 'react';
import { PageHeader } from '@/components/organisms/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { Shield, ShieldCheck, Copy, AlertTriangle } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

export default function TwoFactor() {
  const { toast } = useToast();
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup2FA = async () => {
    setIsLoading(true);
    try {
      // TODO: 调用设置 2FA API
      // const response = await userService.setup2FA();
      
      // 模拟 API 响应
      await new Promise(resolve => setTimeout(resolve, 1000));
      setQrCode('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
      setSecret('JBSWY3DPEHPK3PXP');
      setShowSetup(true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '设置失败',
        description: error.response?.data?.message || '无法获取 2FA 配置',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast({
        variant: 'destructive',
        title: '验证失败',
        description: '请输入 6 位验证码',
      });
      return;
    }

    setIsLoading(true);
    try {
      // TODO: 调用启用 2FA API
      // const response = await userService.enable2FA(verifyCode);
      
      // 模拟 API 响应
      await new Promise(resolve => setTimeout(resolve, 1000));
      setBackupCodes([
        'ABCD-1234-EFGH-5678',
        'IJKL-9012-MNOP-3456',
        'QRST-7890-UVWX-1234',
        'YZAB-5678-CDEF-9012',
      ]);
      setIs2FAEnabled(true);
      setShowSetup(false);
      
      toast({
        title: '启用成功',
        description: '两步验证已启用',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '启用失败',
        description: error.response?.data?.message || '验证码错误',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    setIsLoading(true);
    try {
      // TODO: 调用禁用 2FA API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIs2FAEnabled(false);
      setBackupCodes([]);
      
      toast({
        title: '禁用成功',
        description: '两步验证已禁用',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '禁用失败',
        description: error.response?.data?.message || '操作失败',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = async () => {
    const success = await copyToClipboard(secret);
    if (success) {
      toast({
        title: '复制成功',
        description: '密钥已复制到剪贴板',
      });
    }
  };

  const handleCopyBackupCodes = async () => {
    const success = await copyToClipboard(backupCodes.join('\n'));
    if (success) {
      toast({
        title: '复制成功',
        description: '备份码已复制到剪贴板',
      });
    }
  };

  return (
    <div data-testid="two-factor-page">
      <PageHeader
        title="两步验证 (2FA)"
        description="为您的账户添加额外的安全保护"
      />

      <div className="space-y-6">
        {/* 2FA 状态 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {is2FAEnabled ? (
                  <ShieldCheck className="h-8 w-8 text-green-600" />
                ) : (
                  <Shield className="h-8 w-8 text-gray-400" />
                )}
                <div>
                  <CardTitle>两步验证状态</CardTitle>
                  <CardDescription>
                    {is2FAEnabled ? '已启用' : '未启用'}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={is2FAEnabled ? 'default' : 'secondary'}>
                {is2FAEnabled ? '已启用' : '未启用'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              两步验证为您的账户提供额外的安全保护。启用后，登录时除了密码外，还需要输入验证码。
            </p>
            {!is2FAEnabled && !showSetup && (
              <Button
                onClick={handleSetup2FA}
                disabled={isLoading}
                data-testid="setup-2fa-button"
              >
                {isLoading && <LoadingSpinner className="mr-2" />}
                启用两步验证
              </Button>
            )}
            {is2FAEnabled && (
              <Button
                variant="destructive"
                onClick={handleDisable2FA}
                disabled={isLoading}
                data-testid="disable-2fa-button"
              >
                {isLoading && <LoadingSpinner className="mr-2" />}
                禁用两步验证
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 设置 2FA */}
        {showSetup && (
          <Card>
            <CardHeader>
              <CardTitle>设置两步验证</CardTitle>
              <CardDescription>
                使用身份验证器应用扫描二维码
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>步骤 1: 扫描二维码</Label>
                <div className="flex justify-center rounded-lg border p-4">
                  {qrCode && (
                    <img src={qrCode} alt="QR Code" className="h-48 w-48" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>或手动输入密钥</Label>
                <div className="flex gap-2">
                  <Input value={secret} readOnly data-testid="secret-input" />
                  <Button
                    variant="outline"
                    onClick={handleCopySecret}
                    data-testid="copy-secret-button"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>步骤 2: 输入验证码</Label>
                <Input
                  placeholder="请输入 6 位验证码"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  maxLength={6}
                  data-testid="verify-code-input"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleEnable2FA}
                  disabled={isLoading || verifyCode.length !== 6}
                  data-testid="enable-2fa-button"
                >
                  {isLoading && <LoadingSpinner className="mr-2" />}
                  启用
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSetup(false)}
                >
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 备份码 */}
        {backupCodes.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>备份码</CardTitle>
                  <CardDescription>
                    在无法使用验证器时使用这些备份码登录
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={handleCopyBackupCodes}
                  data-testid="copy-backup-codes-button"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  复制全部
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  请妥善保存这些备份码，每个备份码只能使用一次。
                </AlertDescription>
              </Alert>
              <div className="grid gap-2 sm:grid-cols-2">
                {backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="rounded-md border bg-muted p-3 font-mono text-sm"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
