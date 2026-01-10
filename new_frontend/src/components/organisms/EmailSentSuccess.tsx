import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowLeft } from 'lucide-react';

export function EmailSentSuccess() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md px-4"
    >
      <Card 
        data-testid="email-sent-card"
        className="border-2 shadow-2xl overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-primary/5"
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
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </motion.div>
            </motion.div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-500 to-primary bg-clip-text text-transparent">
              邮件已发送
            </CardTitle>
            <CardDescription className="text-base mt-2">
              我们已向您的邮箱发送了密码重置链接
            </CardDescription>
          </motion.div>
        </CardHeader>
        <CardContent className="relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="space-y-4 text-center text-sm text-muted-foreground"
          >
            <p>请检查您的邮箱并点击重置链接以设置新密码。</p>
            <p>如果您没有收到邮件，请检查垃圾邮件文件夹。</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-6 text-center"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium transition-all duration-300 hover:text-primary/80"
                data-testid="back-to-login-link"
              >
                <ArrowLeft className="w-4 h-4" />
                返回登录
              </Link>
            </motion.div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
