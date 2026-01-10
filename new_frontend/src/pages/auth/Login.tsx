import { useLogin } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { AuthBackground } from '@/components/organisms/AuthBackground';
import { LoginForm } from '@/components/organisms/LoginForm';
import { LoginFormData } from '@/constants/auth';

export default function Login() {
  const login = useLogin();
  const { toast } = useToast();

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login.mutateAsync(data);
      toast({
        title: '登录成功',
        description: '欢迎回来！',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '登录失败',
        description: error.message || error.response?.data?.message || '用户名或密码错误',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      <AuthBackground />
      <LoginForm onSubmit={onSubmit} isLoading={login.isPending} />
    </div>
  );
}
