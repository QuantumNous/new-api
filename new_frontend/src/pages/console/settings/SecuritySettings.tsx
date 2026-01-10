import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageHeader } from '@/components/organisms/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Shield, Mail, Lock, Globe } from 'lucide-react';

const securitySchema = z.object({
  // Turnstile
  turnstileEnabled: z.boolean().default(false),
  turnstileSiteKey: z.string().optional(),
  turnstileSecretKey: z.string().optional(),
  
  // 邮箱验证
  emailVerificationEnabled: z.boolean().default(false),
  smtpHost: z.string().optional(),
  smtpPort: z.number().min(1).max(65535).optional(),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpFrom: z.string().email().optional().or(z.literal('')),
  
  // 密码策略
  minPasswordLength: z.number().min(6).max(32).default(6),
  requireUppercase: z.boolean().default(false),
  requireLowercase: z.boolean().default(false),
  requireNumbers: z.boolean().default(false),
  requireSpecialChars: z.boolean().default(false),
  
  // 限流设置
  globalRateLimit: z.number().min(0).default(0),
  loginRateLimit: z.number().min(0).default(0),
  emailVerificationRateLimit: z.number().min(0).default(0),
  
  // IP 白名单
  ipWhitelist: z.string().optional(),
});

type SecurityFormData = z.infer<typeof securitySchema>;

export default function SecuritySettings() {
  const { toast } = useToast();

  const form = useForm<SecurityFormData>({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      turnstileEnabled: false,
      emailVerificationEnabled: false,
      minPasswordLength: 6,
      requireUppercase: false,
      requireLowercase: false,
      requireNumbers: false,
      requireSpecialChars: false,
      globalRateLimit: 0,
      loginRateLimit: 0,
      emailVerificationRateLimit: 0,
      ipWhitelist: '',
    },
  });

  const onSubmit = async (data: SecurityFormData) => {
    try {
      // TODO: 调用保存安全设置 API
      console.log(data);
      
      toast({
        title: '保存成功',
        description: '安全设置已更新',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: error.response?.data?.message || '保存失败，请稍后重试',
      });
    }
  };

  return (
    <div data-testid="security-settings-page">
      <PageHeader
        title="安全设置"
        description="配置系统安全策略"
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Turnstile 验证 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Turnstile 验证</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="turnstileEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用 Turnstile</FormLabel>
                      <FormDescription>
                        使用 Cloudflare Turnstile 防止机器人攻击
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="turnstile-enabled-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('turnstileEnabled') && (
                <>
                  <FormField
                    control={form.control}
                    name="turnstileSiteKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site Key</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="请输入 Turnstile Site Key"
                            data-testid="turnstile-site-key-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="turnstileSecretKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secret Key</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="请输入 Turnstile Secret Key"
                            data-testid="turnstile-secret-key-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* 邮箱验证 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <CardTitle>邮箱验证</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="emailVerificationEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用邮箱验证</FormLabel>
                      <FormDescription>
                        要求用户注册时验证邮箱
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="email-verification-enabled-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('emailVerificationEnabled') && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="smtpHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP 主机</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="smtp.example.com"
                              data-testid="smtp-host-input"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="smtpPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP 端口</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="587"
                              data-testid="smtp-port-input"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="smtpUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP 用户名</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="请输入 SMTP 用户名"
                            data-testid="smtp-username-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="smtpPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP 密码</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="请输入 SMTP 密码"
                            data-testid="smtp-password-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="smtpFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>发件人邮箱</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="noreply@example.com"
                            data-testid="smtp-from-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* 密码策略 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                <CardTitle>密码策略</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="minPasswordLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>最小密码长度</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="6"
                        max="32"
                        data-testid="min-password-length-input"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 6)}
                      />
                    </FormControl>
                    <FormDescription>
                      6-32 个字符
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="requireUppercase"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm font-normal">要求大写字母</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="require-uppercase-switch"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requireLowercase"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm font-normal">要求小写字母</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="require-lowercase-switch"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requireNumbers"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm font-normal">要求数字</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="require-numbers-switch"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requireSpecialChars"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm font-normal">要求特殊字符</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="require-special-chars-switch"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* 限流设置 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                <CardTitle>限流设置</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="globalRateLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>全局限流（请求/分钟）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0 表示不限制"
                        data-testid="global-rate-limit-input"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      每个 IP 每分钟最多请求次数
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="loginRateLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>登录限流（次数/小时）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0 表示不限制"
                        data-testid="login-rate-limit-input"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      每个 IP 每小时最多登录尝试次数
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailVerificationRateLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱验证限流（次数/小时）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0 表示不限制"
                        data-testid="email-verification-rate-limit-input"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      每个邮箱每小时最多发送验证邮件次数
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* IP 白名单 */}
          <Card>
            <CardHeader>
              <CardTitle>IP 白名单</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="ipWhitelist"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>允许的 IP 地址</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="留空表示不限制，或输入 IP 列表（一行一个）&#10;支持 CIDR 格式，如：192.168.1.0/24"
                        rows={6}
                        data-testid="ip-whitelist-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      只有这些 IP 地址可以访问系统
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Separator />

          {/* 操作按钮 */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              data-testid="save-security-settings-button"
            >
              {form.formState.isSubmitting && <LoadingSpinner className="mr-2" />}
              保存设置
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
