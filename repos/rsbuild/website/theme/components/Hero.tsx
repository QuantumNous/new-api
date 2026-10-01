import { useI18n, useNavigate } from '@rspress/core/runtime';
import { Hero as BaseHero } from '@rstack-dev/doc-ui/hero';
import { useI18nUrl } from './utils';
import './Hero.module.scss';

export function Hero() {
  const navigate = useNavigate();
  const tUrl = useI18nUrl();
  const t = useI18n<typeof import('i18n')>();
  const onClickGetStarted = () => {
    navigate(tUrl('/guide/start/quick-start'));
  };
  return (
    <BaseHero
      showStars
      onClickGetStarted={onClickGetStarted}
      title="Rsbuild"
      subTitle={t('subtitle')}
      description={t('slogan')}
      logoUrl="https://assets.rspack.rs/rsbuild/rsbuild-logo.svg"
      getStartedButtonText={t('quickStart')}
      githubURL="https://github.com/web-infra-dev/rsbuild"
    />
  );
}
