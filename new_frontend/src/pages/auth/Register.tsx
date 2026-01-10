import { useRegister } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { AuthBackground } from '@/components/organisms/AuthBackground';
import { RegisterForm } from '@/components/organisms/RegisterForm';
import { RegisterFormData } from '@/constants/auth';

export default function Register() {
  const register = useRegister();
  const { toast } = useToast();

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await register.mutateAsync({
        username: data.username,
        password: data.password,
        email: data.email || undefined,
      });
      toast({
        title: '注册成功',
        description: '请登录您的账号',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '注册失败',
        description: error.response?.data?.message || '注册失败，请稍后重试',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      <AuthBackground />
      <RegisterForm onSubmit={onSubmit} isLoading={register.isPending} />
    </div>
  );
}
