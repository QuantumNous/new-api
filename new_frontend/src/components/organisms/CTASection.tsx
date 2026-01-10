import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function CTASection() {
  return (
    <section className="container py-16">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Card className="bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20">
            <CardHeader>
              <h2 className="text-3xl font-bold mb-4">准备好开始了吗？</h2>
              <p className="text-muted-foreground text-lg mb-6">
                立即注册，开始使用最先进的 AI 模型
              </p>
              <div className="flex justify-center gap-4">
                <Link to="/auth/register">
                  <Button size="lg" className="gap-2">
                    免费注册
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/docs">
                  <Button size="lg" variant="outline">
                    查看文档
                  </Button>
                </Link>
              </div>
            </CardHeader>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
