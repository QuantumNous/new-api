import { BackgroundImage } from '@rstack-dev/doc-ui/background-image';
import { Benchmark } from '../components/Benchmark';
import { CopyRight } from '../components/Copyright';
import { Features } from '../components/Features';
import { Hero } from '../components/Hero';
import { HomeFooter } from '../components/HomeFooter';
import { ToolStack } from '../components/ToolStack';

export function HomeLayout() {
  return (
    <div style={{ position: 'relative' }}>
      <BackgroundImage />
      <Hero />
      <Features />
      <Benchmark />
      <ToolStack />
      <HomeFooter />
      <CopyRight />
    </div>
  );
}
