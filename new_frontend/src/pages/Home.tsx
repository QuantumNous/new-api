import { motion } from 'framer-motion';
import { Header } from '@/components/organisms/Header';
import { HeroSection } from '@/components/organisms/HeroSection';
import { StepsSection } from '@/components/organisms/StepsSection';
import { FeaturesSection } from '@/components/organisms/FeaturesSection';
import { PricingSection } from '@/components/organisms/PricingSection';
import { TestimonialsSection } from '@/components/organisms/TestimonialsSection';
import { FAQSection } from '@/components/organisms/FAQSection';
import { CTASection } from '@/components/organisms/CTASection';
import { PageFooter } from '@/components/organisms/PageFooter';
import { ScrollToTop } from '@/components/organisms/ScrollToTop';

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden" data-testid="home-page">
      <Header />

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

      <HeroSection />
      <StepsSection />
      <FeaturesSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
      <PageFooter />
      <ScrollToTop />
    </div>
  );
}