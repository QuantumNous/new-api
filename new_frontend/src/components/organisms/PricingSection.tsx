import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { PRICING } from '@/constants/home';

type PricingPlan = {
  name: string;
  price: string;
  period?: string;
  features: readonly string[];
  popular?: boolean;
};

export function PricingSection() {
  return (
    <section className="container py-16 bg-muted/40">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">简单透明的定价</h2>
          <p className="text-muted-foreground text-lg">选择最适合您的方案</p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {PRICING.map((plan, index) => {
            const typedPlan = plan as PricingPlan;
            return (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
            >
              <Card className={`h-full transition-shadow hover:shadow-md ${typedPlan.popular ? 'border-primary' : ''}`}>
                <CardHeader>
                  <motion.div
                    className="mb-4 flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 + 0.2 }}
                  >
                    <CardTitle>{typedPlan.name}</CardTitle>
                    {typedPlan.popular && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                        推荐
                      </span>
                    )}
                  </motion.div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{typedPlan.price}</span>
                    {typedPlan.period && <span className="text-muted-foreground">{typedPlan.period}</span>}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {typedPlan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <CardDescription className="text-base">
                          {feature}
                        </CardDescription>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth/register" className="block mt-6">
                    <Button className="w-full" variant={typedPlan.popular ? 'default' : 'outline'}>
                      开始使用
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
            );
          })}
        </div>
        
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-8"
        >
          <Link to="/pricing">
            <Button variant="ghost" className="text-primary hover:text-primary/80">
              查看详细定价 →
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
