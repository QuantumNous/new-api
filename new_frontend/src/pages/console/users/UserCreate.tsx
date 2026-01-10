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
import { useCreateUser } from '@/hooks/queries/useUsers';

const userSchema = z.object({
  username: z.string().min(3, '用户名至少 3 个字符').max(20, '用户名最多 20 个字符'),
  password: z.string().min(6, '密码至少 6 个字符'),
  displayName: z.string().optional(),
  email: z.string().email('请输入有效的邮箱地址').optional().or(z.literal('')),
  role: z.number().default(USER_ROLES.USER),
  status: z.number().default(USER_STATUS.ENABLED),
  quota: z.number().min(0).default(0),
  group: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

export default function UserCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: '',
      password: '',
      displayName: '',
      email: '',
      role: USER_ROLES.USER,
      status: USER_STATUS.ENABLED,
      quota: 0,
      group: 'default',
    },
  });

  const onSubmit = async (data: UserFormData) => {
    try {
      // TODO: 调用创建用户 API
      // await userService.createUser(data);
      
      console.log('创建用户:', data);
      
      toast({
        title: '创建成功',
        description: '用户已成功创建',
      });
      
      navigate('/console/users');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '创建失败',
        description: error.response?.data?.message || '创建失败，请稍后重试',
      });
    }
  };

  return (
    <div data-testid="user-create-page">
      <PageHeader
        title="创建用户"
        description="添加新的系统用户"
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
                      3-20 个字符，用于登录
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密码 *</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="请输入密码"
                        data-testid="password-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      至少 6 个字符
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
                    <FormDescription>
                      在界面中显示的名称
                    </FormDescription>
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
                    <FormDescription>
                      用于接收通知和重置密码
                    </FormDescription>
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
                    <FormDescription>
                      不同角色拥有不同的系统权限
                    </FormDescription>
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
                    <FormDescription>
                      禁用的用户无法登录系统
                    </FormDescription>
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
                    <FormDescription>
                      用于权限控制和资源分配
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
                name="quota"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>初始额度</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        data-testid="quota-input"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      单位：美元（$），用户创建后的初始额度
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
              创建用户
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
