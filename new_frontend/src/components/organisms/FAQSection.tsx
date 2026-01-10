import { motion } from 'framer-motion';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';
import { FAQS } from '@/constants/home';

export function FAQSection() {
  return (
    <section className="container py-16 bg-muted/40">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">常见问题</h2>
          <p className="text-muted-foreground text-lg">快速了解我们的服务</p>
        </motion.div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ x: 4 }}
            >
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <motion.div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10"
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.6 }}
                    >
                      <HelpCircle className="h-4 w-4 text-primary" />
                    </motion.div>
                    <div>
                      <CardTitle className="text-lg mb-2">{faq.question}</CardTitle>
                      <CardDescription className="text-base">
                        {faq.answer}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
