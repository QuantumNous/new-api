import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { motion } from 'framer-motion';
import { Lock, User, Sparkles, ArrowRight } from 'lucide-react';
import { loginSchema, LoginFormData } from '@/constants/auth';

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
  isLoading: boolean;
}

export function LoginForm({ onSubmit, isLoading }: LoginFormProps) {
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.6,
        ease: "easeOut"
      }}
      className="w-full max-w-md px-4"
    >
      <Card 
        data-testid="login-form"
        className="border-2 shadow-2xl overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5"
          animate={{
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        <CardHeader className="relative">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center"
          >
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4"
              whileHover={{ scale: 1.1, rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <Sparkles className="w-8 h-8 text-primary" />
            </motion.div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              欢迎回来
            </CardTitle>
            <CardDescription className="text-base mt-2">
              输入您的账号信息以登录系统
            </CardDescription>
          </motion.div>
        </CardHeader>
        
        <CardContent className="relative">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        用户名
                      </FormLabel>
                      <FormControl>
                        <motion.div
                          whileFocus={{ scale: 1.02 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Input
                            placeholder="请输入用户名"
                            data-testid="username-input"
                            className="transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                            {...field}
                          />
                        </motion.div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        密码
                      </FormLabel>
                      <FormControl>
                        <motion.div
                          whileFocus={{ scale: 1.02 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Input
                            type="password"
                            placeholder="请输入密码"
                            data-testid="password-input"
                            className="transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                            {...field}
                          />
                        </motion.div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="flex justify-end"
              >
                <Link
                  to="/auth/forgot-password"
                  className="text-sm text-primary hover:underline flex items-center gap-1 transition-all duration-300 hover:text-primary/80"
                  data-testid="forgot-password-link"
                >
                  忘记密码？
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/25"
                    disabled={isLoading}
                    data-testid="login-button"
                  >
                    <motion.span
                      className="flex items-center justify-center gap-2"
                      animate={isLoading ? { opacity: [1, 0.5, 1] } : {}}
                      transition={{ duration: 1, repeat: isLoading ? Infinity : 0 }}
                    >
                      {isLoading && <LoadingSpinner className="mr-2" />}
                      {isLoading ? '登录中...' : '登录'}
                      {!isLoading && <ArrowRight className="w-4 h-4" />}
                    </motion.span>
                  </Button>
                </motion.div>
              </motion.div>
            </form>
          </Form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-6 text-center text-sm"
          >
            还没有账号？{' '}
            <Link
              to="/auth/register"
              className="text-primary hover:underline font-medium transition-all duration-300 hover:text-primary/80 inline-flex items-center gap-1"
              data-testid="register-link"
            >
              立即注册
              <ArrowRight className="w-3 h-3" />
            </Link>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
