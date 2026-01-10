import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const tokenSchema = z.object({
  name: z.string().min(1, '请输入令牌名称'),
  quota: z.number().min(-1, '额度不能小于 -1'),
  expiredTime: z.number().optional(),
  models: z.string().optional(),
  subnet: z.string().optional(),
  status: z.number().default(1),
});

type TokenFormData = z.infer<typeof tokenSchema>;

export default function TokenEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [expireDate, setExpireDate] = useState<Date>();

  const form = useForm<TokenFormData>({
    resolver: zodResolver(tokenSchema),
    defaultValues: {
      name: '',
      quota: 0,
      models: '',
      subnet: '',
      status: 1,
    },
  });

  useEffect(() => {
    const fetchToken = async () => {
      try {
        // TODO: 调用获取令牌详情 API
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const mockData = {
          name: 'Test Token',
          quota: 100,
          expiredTime: Date.now() / 1000 + 86400 * 30,
          models: 'gpt-4,gpt-3.5-turbo',
          subnet: '',
          status: 1,
        };
        
        form.reset(mockData);
        if (mockData.expiredTime) {
          setExpireDate(new Date(mockData.expiredTime * 1000));
        }
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: '加载失败',
          description: error.response?.data?.message || '无法加载令牌信息',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchToken();
    }
  }, [id, form, toast]);

  const onSubmit = async (data: TokenFormData) => {
    try {
      // TODO: 调用更新令牌 API
      console.log('更新令牌:', id, data);
      
      toast({
        title: '更新成功',
        description: '令牌已成功更新',
      });
      
      navigate('/console/tokens');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '更新失败',
        description: error.response?.data?.message || '更新失败，请稍后重试',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div data-testid="token-edit-page">
      <PageHeader
        title="编辑令牌"
        description="修改 API 令牌配置"
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>状态</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="status-select">
                          <SelectValue placeholder="请选择状态" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">启用</SelectItem>
                        <SelectItem value="2">禁用</SelectItem>
                      </SelectContent>
                    </Select>
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
                name="quota"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>额度</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="-1 表示无限额度"
                        data-testid="quota-input"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      -1 表示无限额度，0 表示已用完
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>过期时间</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !expireDate && 'text-muted-foreground'
                      )}
                      data-testid="expire-date-button"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expireDate ? format(expireDate, 'PPP') : '选择过期时间'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={expireDate}
                      onSelect={(date) => {
                        setExpireDate(date);
                        if (date) {
                          form.setValue('expiredTime', Math.floor(date.getTime() / 1000));
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  留空表示永不过期
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 限制配置 */}
          <Card>
            <CardHeader>
              <CardTitle>限制配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="models"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>模型限制</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="留空表示不限制，或输入模型列表（逗号分隔）"
                        rows={3}
                        data-testid="models-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      例如：gpt-4,gpt-3.5-turbo,claude-3
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subnet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP 白名单</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="留空表示不限制，或输入 IP 列表（一行一个）"
                        rows={3}
                        data-testid="subnet-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      支持 CIDR 格式，如：192.168.1.0/24
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
              保存修改
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
