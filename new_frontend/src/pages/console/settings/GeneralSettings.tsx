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
import { Separator } from '@/components/ui/separator';

const settingsSchema = z.object({
  systemName: z.string().min(1, '请输入系统名称'),
  logo: z.string().optional(),
  footer: z.string().optional(),
  announcement: z.string().optional(),
  apiInfo: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function GeneralSettings() {
  const { toast } = useToast();

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      systemName: 'New API',
      logo: '',
      footer: '',
      announcement: '',
      apiInfo: '',
    },
  });

  const onSubmit = async (data: SettingsFormData) => {
    try {
      // TODO: 调用保存设置 API
      console.log(data);
      toast({
        title: '保存成功',
        description: '系统设置已更新',
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
    <div data-testid="general-settings-page">
      <PageHeader
        title="通用设置"
        description="配置系统基本信息"
      />

      <Card>
        <CardHeader>
          <CardTitle>系统配置</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="systemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>系统名称</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入系统名称"
                        data-testid="system-name-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      显示在页面标题和导航栏的系统名称
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="logo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入 Logo 图片 URL"
                        data-testid="logo-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      系统 Logo 图片的 URL 地址
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="footer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>页脚信息</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入页脚信息"
                        rows={3}
                        data-testid="footer-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      显示在页面底部的版权信息等
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="announcement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>系统公告</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入系统公告"
                        rows={4}
                        data-testid="announcement-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      显示在首页的系统公告信息
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API 信息</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入 API 相关信息"
                        rows={3}
                        data-testid="api-info-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      API 文档中显示的额外信息
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                data-testid="save-settings-button"
              >
                {form.formState.isSubmitting && <LoadingSpinner className="mr-2" />}
                保存设置
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
