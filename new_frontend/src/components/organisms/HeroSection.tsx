import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Key, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ENDPOINTS, STATS } from '@/constants/home';

export function HeroSection() {
  const [currentEndpointIndex, setCurrentEndpointIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentEndpointIndex((prev) => (prev + 1) % ENDPOINTS.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="container py-12 md:py-16">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">The Unified Interface For AI</span>
          </motion.div>
        </motion.div>
        
        <motion.h1
          className="mb-4 text-3xl font-bold tracking-tight sm:text-5xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          现代化的 AI
          <span className="bg-gradient-to-r from-primary via-purple-500 to-blue-500 bg-clip-text text-transparent">
            {' '}统一平台
          </span>
        </motion.h1>
        
        <motion.p
          className="mb-6 text-lg text-muted-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          更优惠的价格，更好的正常运行时间，无需订阅
        </motion.p>

        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border/50">
            <span className="text-sm text-muted-foreground">支持接口：</span>
            <div className="w-48 h-6 overflow-hidden relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentEndpointIndex}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-center justify-end"
                >
                  <code className="text-sm font-mono text-primary">
                    {ENDPOINTS[currentEndpointIndex]}
                  </code>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="flex justify-center gap-4 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
        >
          <Link to="/auth/register">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" className="gap-2" data-testid="hero-get-started-button">
                获取密钥
                <Key className="h-4 w-4" />
              </Button>
            </motion.div>
          </Link>
          <Link to="/playground/chat">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" variant="outline" className="gap-2" data-testid="hero-view-docs-button">
                <MessageSquare className="h-4 w-4" />
                开始对话
              </Button>
            </motion.div>
          </Link>
        </motion.div>

        <div className="grid gap-6 grid-cols-2 md:grid-cols-4 max-w-5xl mx-auto">
          {STATS.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
                whileHover={{ y: -5, scale: 1.05 }}
                className="text-center"
              >
                <motion.div
                  className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <Icon className="h-6 w-6 text-primary" />
                </motion.div>
                <motion.div
                  className="mb-1 text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + index * 0.1 + 0.3, type: "spring", stiffness: 200 }}
                >
                  {stat.value}
                </motion.div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
