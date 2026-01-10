import { useNavigate } from 'react-router-dom';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCreateToken } from '@/hooks/queries/useTokens';

const tokenSchema = z.object({
  name: z.string().min(1, '请输入令牌名称'),
  unlimitedQuota: z.boolean().default(false),
  remainQuota: z.number().min(0).default(0),
  expiredTime: z.number().optional(),
  unlimitedExpired: z.boolean().default(false),
  models: z.string().optional(),
  subnet: z.string().optional(),
  allowedIps: z.string().optional(),
});

type TokenFormData = z.infer<typeof tokenSchema>;

export default function TokenCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createToken = useCreateToken();

  const form = useForm<TokenFormData>({
    resolver: zodResolver(tokenSchema),
    defaultValues: {
      name: '',
      unlimitedQuota: false,
      remainQuota: 0,
      unlimitedExpired: false,
      models: '',
      subnet: '',
      allowedIps: '',
    },
  });

  const unlimitedQuota = form.watch('unlimitedQuota');
  const unlimitedExpired = form.watch('unlimitedExpired');

  const onSubmit = async (data: TokenFormData) => {
    try {
      await createToken.mutateAsync({
        name: data.name,
        remain_quota: data.unlimitedQuota ? undefined : data.remainQuota,
        expired_time: data.unlimitedExpired ? -1 : data.expiredTime,
        unlimited_quota: data.unlimitedQuota,
        model_limits_enabled: data.models ? true : false,
        model_limits: data.models || undefined,
        allow_ips: data.allowedIps || undefined,
      });
      
      toast({
        title: '创建成功',
        description: '令牌已成功创建',
      });
      
      navigate('/console/tokens');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '创建失败',
        description: error.response?.data?.message || '创建失败，请稍后重试',
      });
    }
  };

  return (
    <div data-testid="token-create-page">
      <PageHeader
        title="创建令牌"
        description="创建新的 API 令牌"
        actions={
          <Button variant="outline" onClick={() => navigate('/console/tokens')}>
            取消
          </Button>
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基础信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基础信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>令牌名称 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入令牌名称"
                        data-testid="token-name-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      用于识别令牌的名称
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 额度配置 */}
          <Card>
            <CardHeader>
              <CardTitle>额度配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="unlimitedQuota"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">无限额度</FormLabel>
                      <FormDescription>
                        启用后令牌将拥有无限额度
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="unlimited-quota-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!unlimitedQuota && (
                <FormField
                  control={form.control}
                  name="remainQuota"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>初始额度</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          data-testid="remain-quota-input"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        单位：美元（$）
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* 过期时间 */}
          <Card>
            <CardHeader>
              <CardTitle>过期时间</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="unlimitedExpired"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">永不过期</FormLabel>
                      <FormDescription>
                        启用后令牌将永不过期
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="unlimited-expired-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!unlimitedExpired && (
                <FormField
                  control={form.control}
                  name="expiredTime"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>过期日期</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                              data-testid="expired-time-button"
                            >
                              {field.value ? (
                                format(new Date(field.value * 1000), 'PPP')
                              ) : (
                                <span>选择过期日期</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value * 1000) : undefined}
                            onSelect={(date) => field.onChange(date ? Math.floor(date.getTime() / 1000) : undefined)}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        令牌将在此日期后失效
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* 模型限制 */}
          <Card>
            <CardHeader>
              <CardTitle>模型限制</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="models"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>允许的模型</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="留空表示允许所有模型，或输入模型列表（一行一个）"
                        rows={4}
                        data-testid="models-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      指定此令牌可以使用的模型列表
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
                name="allowedIps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>允许的 IP 地址</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="留空表示不限制，或输入 IP 列表（一行一个）&#10;支持 CIDR 格式，如：192.168.1.0/24"
                        rows={4}
                        data-testid="allowed-ips-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      只有这些 IP 地址可以使用此令牌
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/console/tokens')}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              data-testid="submit-button"
            >
              {form.formState.isSubmitting && <LoadingSpinner className="mr-2" />}
              创建令牌
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
