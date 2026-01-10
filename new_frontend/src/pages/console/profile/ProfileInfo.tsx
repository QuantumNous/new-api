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
import { useCurrentUser } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { Separator } from '@/components/ui/separator';

const profileSchema = z.object({
  username: z.string().min(3, '用户名至少 3 个字符'),
  displayName: z.string().optional(),
  email: z.string().email('请输入有效的邮箱地址').optional().or(z.literal('')),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(6, '新密码至少 6 个字符'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '两次密码输入不一致',
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfileInfo() {
  const user = useCurrentUser();
  const { toast } = useToast();

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || '',
      displayName: user?.displayName || '',
      email: user?.email || '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onProfileSubmit = async (data: ProfileFormData) => {
    try {
      // TODO: 调用更新用户信息 API
      toast({
        title: '保存成功',
        description: '个人信息已更新',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: error.response?.data?.message || '更新失败，请稍后重试',
      });
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    try {
      // TODO: 调用修改密码 API
      toast({
        title: '密码已更新',
        description: '您的密码已成功修改',
      });
      passwordForm.reset();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '修改失败',
        description: error.response?.data?.message || '密码修改失败，请稍后重试',
      });
    }
  };

  return (
    <div data-testid="profile-info-page">
      <PageHeader
        title="基本信息"
        description="管理您的个人信息和账户设置"
      />

      <div className="space-y-6">
        {/* 个人信息 */}
        <Card>
          <CardHeader>
            <CardTitle>个人信息</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>用户名</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入用户名"
                          data-testid="username-input"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        用户名用于登录系统
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
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
                        显示名称将在界面中显示
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
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

                <Button
                  type="submit"
                  disabled={profileForm.formState.isSubmitting}
                  data-testid="save-profile-button"
                >
                  {profileForm.formState.isSubmitting && <LoadingSpinner className="mr-2" />}
                  保存修改
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* 修改密码 */}
        <Card>
          <CardHeader>
            <CardTitle>修改密码</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>当前密码</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="请输入当前密码"
                          data-testid="current-password-input"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>新密码</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="请输入新密码"
                          data-testid="new-password-input"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        密码至少 6 个字符
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>确认新密码</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="请再次输入新密码"
                          data-testid="confirm-password-input"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={passwordForm.formState.isSubmitting}
                  data-testid="change-password-button"
                >
                  {passwordForm.formState.isSubmitting && <LoadingSpinner className="mr-2" />}
                  修改密码
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
