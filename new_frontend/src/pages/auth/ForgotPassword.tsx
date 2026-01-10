import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AuthBackground } from '@/components/organisms/AuthBackground';
import { ForgotPasswordForm } from '@/components/organisms/ForgotPasswordForm';
import { EmailSentSuccess } from '@/components/organisms/EmailSentSuccess';
import { ForgotPasswordFormData } from '@/constants/auth';
import api from '@/lib/api/client';

export default function ForgotPassword() {
  const [emailSent, setEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await api.get('/reset_password', {
        params: {
          email: data.email
        }
      });
      
      setEmailSent(true);
      toast({
        title: '邮件已发送',
        description: '请检查您的邮箱以重置密码',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '发送失败',
        description: error.response?.data?.message || '发送重置邮件失败，请稍后重试',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
        <AuthBackground />
        <EmailSentSuccess />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      <AuthBackground />
      <ForgotPasswordForm onSubmit={onSubmit} isLoading={isLoading} />
    </div>
  );
}
