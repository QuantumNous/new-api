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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';
import { useUser, useUpdateUser } from '@/hooks/queries/useUsers';

const userSchema = z.object({
  username: z.string().min(3, '用户名至少 3 个字符').max(20, '用户名最多 20 个字符'),
  displayName: z.string().optional(),
  email: z.string().email('请输入有效的邮箱地址').optional().or(z.literal('')),
  role: z.number().default(USER_ROLES.USER),
  status: z.number().default(USER_STATUS.ENABLED),
  quota: z.number().min(0).default(0),
  group: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

export default function UserEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: '',
      displayName: '',
      email: '',
      role: USER_ROLES.USER,
      status: USER_STATUS.ENABLED,
      quota: 0,
      group: 'default',
    },
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // TODO: 调用获取用户详情 API
        // const user = await userService.getUserById(id);
        
        // 模拟数据
        await new Promise(resolve => setTimeout(resolve, 500));
        const mockData = {
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com',
          role: USER_ROLES.USER,
          status: USER_STATUS.ENABLED,
          quota: 100,
          group: 'default',
        };
        
        form.reset(mockData);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: '加载失败',
          description: error.response?.data?.message || '无法加载用户信息',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchUser();
    }
  }, [id, form, toast]);

  const onSubmit = async (data: UserFormData) => {
    try {
      // TODO: 调用更新用户 API
      // await userService.updateUser({ id, ...data });
      
      console.log('更新用户:', id, data);
      
      toast({
        title: '更新成功',
        description: '用户信息已成功更新',
      });
      
      navigate('/console/users');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '更新失败',
        description: error.response?.data?.message || '更新失败，请稍后重试',
      });
    }
  };

  const handleResetPassword = async () => {
    try {
      // TODO: 调用重置密码 API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: '重置成功',
        description: '密码已重置，新密码已发送到用户邮箱',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '重置失败',
        description: error.response?.data?.message || '操作失败',
      });
    }
  };

  const handleDisable2FA = async () => {
    try {
      // TODO: 调用禁用 2FA API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: '禁用成功',
        description: '用户的两步验证已禁用',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '禁用失败',
        description: error.response?.data?.message || '操作失败',
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
    <div data-testid="user-edit-page">
      <PageHeader
        title="编辑用户"
        description="修改用户信息和权限"
        actions={
          <Button variant="outline" onClick={() => navigate('/console/users')}>
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
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户名 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入用户名"
                        data-testid="username-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      3-20 个字符
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>显示名称</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入显示名称"
                        data-testid="display-name-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱地址</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="请输入邮箱地址"
                        data-testid="email-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 权限配置 */}
          <Card>
            <CardHeader>
              <CardTitle>权限配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户角色 *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="role-select">
                          <SelectValue placeholder="请选择用户角色" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={USER_ROLES.USER.toString()}>普通用户</SelectItem>
                        <SelectItem value={USER_ROLES.ADMIN.toString()}>管理员</SelectItem>
                        <SelectItem value={USER_ROLES.ROOT.toString()}>超级管理员</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>账户状态 *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="status-select">
                          <SelectValue placeholder="请选择账户状态" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={USER_STATUS.ENABLED.toString()}>启用</SelectItem>
                        <SelectItem value={USER_STATUS.DISABLED.toString()}>禁用</SelectItem>
                        <SelectItem value={USER_STATUS.PENDING.toString()}>待审核</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="group"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户分组</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="default"
                        data-testid="group-input"
                        {...field}
                      />
                    </FormControl>
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
                    <FormLabel>当前额度</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        data-testid="quota-input"
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
            </CardContent>
          </Card>

          {/* 安全操作 */}
          <Card>
            <CardHeader>
              <CardTitle>安全操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetPassword}
                  data-testid="reset-password-button"
                >
                  重置密码
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDisable2FA}
                  data-testid="disable-2fa-button"
                >
                  禁用 2FA
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/console/users')}
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
