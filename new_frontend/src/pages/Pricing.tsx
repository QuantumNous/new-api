import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/organisms/Header';
import { PageFooter } from '@/components/organisms/PageFooter';
import { PricingPlans } from '@/components/organisms/PricingPlans';
import { PricingFAQ } from '@/components/organisms/PricingFAQ';
import { Button } from '@/components/ui/button';

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main>
        {/* Hero Section */}
        <section className="py-20 bg-gradient-to-br from-primary/10 via-background to-purple-500/10 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <motion.div
              className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 dark:bg-indigo-600/30 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/20 dark:bg-purple-600/30 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </div>
          
          <div className="container mx-auto px-4 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-purple-500 to-blue-500 bg-clip-text text-transparent"
            >
              一个 API，所有大模型，所有提供商
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-muted-foreground mb-8"
            >
              为 AI 原生初创公司、独立开发者和企业提供方案
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex justify-center gap-4"
            >
              <Link to="/auth/register">
                <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow">
                  开始使用
                </Button>
              </Link>
              <Link to="/enterprise">
                <Button size="lg" variant="outline">
                  联系销售
                </Button>
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex justify-center gap-6 mt-8 text-sm text-muted-foreground"
            >
              <Link to="/models" className="hover:text-primary transition-colors">
                模型价格 →
              </Link>
              <Link to="/api-docs" className="hover:text-primary transition-colors">
                API 文档 →
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Pricing Plans Table */}
        <section className="py-8">
          <div className="container mx-auto px-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-3xl font-bold text-center mb-8"
            >
              定价方案
            </motion.h2>
            <PricingPlans />
          </div>
        </section>

        {/* FAQ Section */}
        <PricingFAQ />

        {/* CTA Section */}
        <section className="py-20 bg-muted/40">
          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-2xl mx-auto"
            >
              <h2 className="text-3xl font-bold mb-4">准备开始了吗？</h2>
              <p className="text-muted-foreground mb-8">
                加入数千名使用 OpenRouter 的开发者
              </p>
              <div className="flex justify-center gap-4">
                <Link to="/auth/register">
                  <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow">
                    免费开始
                  </Button>
                </Link>
                <Link to="/enterprise">
                  <Button size="lg" variant="outline">
                    联系销售
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <PageFooter />
    </div>
  );
}
