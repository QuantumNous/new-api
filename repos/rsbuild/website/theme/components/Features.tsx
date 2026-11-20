import { useI18n } from '@rspress/core/runtime';
import { containerStyle, innerContainerStyle } from '@rstack-dev/doc-ui/section-style';
import { HomeFeature } from '@theme';
import './Features.module.scss';

export function Features() {
  const t = useI18n<typeof import('i18n')>();
  const features = [
    {
      title: t('rspackBased'),
      details: t('rspackBasedDesc'),
      icon: '🚀',
    },
    {
      title: t('batteriesIncluded'),
      details: t('batteriesIncludedDesc'),
      icon: '🦄',
    },
    {
      title: t('frameworkAgnostic'),
      details: t('frameworkAgnosticDesc'),
      icon: '🎯',
    },
    {
      title: t('deepOptimization'),
      details: t('deepOptimizationDesc'),
      icon: '🛠️',
    },
    {
      title: t('highlyPluggable'),
      details: t('highlyPluggableDesc'),
      icon: '🎨',
    },
    {
      title: t('easyToConfigure'),
      details: t('easyToConfigureDesc'),
      icon: '🍭',
    },
  ];
  return (
    <section className={containerStyle}>
      <div className={innerContainerStyle}>
        <HomeFeature features={features} />
      </div>
    </section>
  );
}
