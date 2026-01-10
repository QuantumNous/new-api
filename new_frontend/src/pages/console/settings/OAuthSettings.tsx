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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Github, MessageSquare, Key, Globe, MessageCircle, Send } from 'lucide-react';

const oauthSchema = z.object({
  // GitHub
  githubEnabled: z.boolean().default(false),
  githubClientId: z.string().optional(),
  githubClientSecret: z.string().optional(),
  
  // Discord
  discordEnabled: z.boolean().default(false),
  discordClientId: z.string().optional(),
  discordClientSecret: z.string().optional(),
  
  // OIDC
  oidcEnabled: z.boolean().default(false),
  oidcIssuer: z.string().optional(),
  oidcClientId: z.string().optional(),
  oidcClientSecret: z.string().optional(),
  
  // LinuxDo
  linuxdoEnabled: z.boolean().default(false),
  linuxdoClientId: z.string().optional(),
  linuxdoClientSecret: z.string().optional(),
  
  // WeChat
  wechatEnabled: z.boolean().default(false),
  wechatAppId: z.string().optional(),
  wechatAppSecret: z.string().optional(),
  
  // Telegram
  telegramEnabled: z.boolean().default(false),
  telegramBotToken: z.string().optional(),
});

type OAuthFormData = z.infer<typeof oauthSchema>;

export default function OAuthSettings() {
  const { toast } = useToast();

  const form = useForm<OAuthFormData>({
    resolver: zodResolver(oauthSchema),
    defaultValues: {
      githubEnabled: false,
      discordEnabled: false,
      oidcEnabled: false,
      linuxdoEnabled: false,
      wechatEnabled: false,
      telegramEnabled: false,
    },
  });

  const onSubmit = async (data: OAuthFormData) => {
    try {
      // TODO: 调用保存 OAuth 设置 API
      console.log(data);
      
      toast({
        title: '保存成功',
        description: 'OAuth 设置已更新',
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
    <div data-testid="oauth-settings-page">
      <PageHeader
        title="OAuth 设置"
        description="配置第三方登录服务"
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* GitHub OAuth */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                <CardTitle>GitHub OAuth</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="githubEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用 GitHub 登录</FormLabel>
                      <FormDescription>
                        允许用户使用 GitHub 账号登录
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="github-enabled-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('githubEnabled') && (
                <>
                  <FormField
                    control={form.control}
                    name="githubClientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="请输入 GitHub Client ID"
                            data-testid="github-client-id-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="githubClientSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Secret</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="请输入 GitHub Client Secret"
                            data-testid="github-client-secret-input"
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

          {/* Discord OAuth */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <CardTitle>Discord OAuth</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="discordEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用 Discord 登录</FormLabel>
                      <FormDescription>
                        允许用户使用 Discord 账号登录
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="discord-enabled-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('discordEnabled') && (
                <>
                  <FormField
                    control={form.control}
                    name="discordClientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="请输入 Discord Client ID"
                            data-testid="discord-client-id-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="discordClientSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Secret</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="请输入 Discord Client Secret"
                            data-testid="discord-client-secret-input"
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

          {/* OIDC OAuth */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                <CardTitle>OIDC OAuth</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="oidcEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用 OIDC 登录</FormLabel>
                      <FormDescription>
                        允许用户使用 OIDC 提供商登录
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="oidc-enabled-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('oidcEnabled') && (
                <>
                  <FormField
                    control={form.control}
                    name="oidcIssuer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issuer URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com"
                            data-testid="oidc-issuer-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="oidcClientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="请输入 OIDC Client ID"
                            data-testid="oidc-client-id-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="oidcClientSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Secret</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="请输入 OIDC Client Secret"
                            data-testid="oidc-client-secret-input"
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

          {/* LinuxDo OAuth */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                <CardTitle>LinuxDo OAuth</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="linuxdoEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用 LinuxDo 登录</FormLabel>
                      <FormDescription>
                        允许用户使用 LinuxDo 账号登录
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="linuxdo-enabled-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('linuxdoEnabled') && (
                <>
                  <FormField
                    control={form.control}
                    name="linuxdoClientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="请输入 LinuxDo Client ID"
                            data-testid="linuxdo-client-id-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="linuxdoClientSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Secret</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="请输入 LinuxDo Client Secret"
                            data-testid="linuxdo-client-secret-input"
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

          {/* WeChat OAuth */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                <CardTitle>微信登录</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="wechatEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用微信登录</FormLabel>
                      <FormDescription>
                        允许用户使用微信扫码登录
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="wechat-enabled-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('wechatEnabled') && (
                <>
                  <FormField
                    control={form.control}
                    name="wechatAppId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="请输入微信 App ID"
                            data-testid="wechat-app-id-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="wechatAppSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App Secret</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="请输入微信 App Secret"
                            data-testid="wechat-app-secret-input"
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

          {/* Telegram OAuth */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                <CardTitle>Telegram 登录</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="telegramEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用 Telegram 登录</FormLabel>
                      <FormDescription>
                        允许用户使用 Telegram 账号登录
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="telegram-enabled-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('telegramEnabled') && (
                <FormField
                  control={form.control}
                  name="telegramBotToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bot Token</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="请输入 Telegram Bot Token"
                          data-testid="telegram-bot-token-input"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* 操作按钮 */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              data-testid="save-oauth-settings-button"
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
