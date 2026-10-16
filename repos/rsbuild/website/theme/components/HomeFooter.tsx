import { useI18n, useLang } from '@rspress/core/runtime';
import { Link } from '@theme';
import { memo } from 'react';
import styles from './HomeFooter.module.scss';

function useFooterData() {
  const t = useI18n<typeof import('i18n')>();
  const lang = useLang();
  const getLink = (link: string) => (lang === 'en' ? link : `/${lang}${link}`);

  return [
    {
      title: t('guide'),
      items: [
        {
          title: t('introduction'),
          link: getLink('/guide/start/index'),
        },
        {
          title: t('quickStart'),
          link: getLink('/guide/start/quick-start'),
        },
        {
          title: t('features'),
          link: getLink('/guide/start/features'),
        },
        {
          title: t('migration'),
          link: getLink('/guide/migration/webpack'),
        },
      ],
    },
    {
      title: 'API',
      items: [
        {
          title: t('cli'),
          link: getLink('/guide/basic/cli'),
        },
        {
          title: t('configuration'),
          link: getLink('/guide/configuration/rsbuild'),
        },
        {
          title: t('pluginApi'),
          link: getLink('/plugins/dev/index'),
        },
        {
          title: 'JavaScript API',
          link: getLink('/api/start/index'),
        },
      ],
    },
    {
      title: t('ecosystem'),
      items: [
        {
          title: 'Rspack',
          link: 'https://rspack.rs/',
        },
        {
          title: 'Rspress',
          link: 'https://rspress.rs/',
        },
        {
          title: 'Rsdoctor',
          link: 'https://rsdoctor.rs/',
        },
        {
          title: 'Rslib',
          link: 'https://rslib.rs/',
        },
        {
          title: 'Rstest',
          link: 'https://rstest.rs',
        },
      ],
    },
    {
      title: t('community'),
      items: [
        {
          title: 'GitHub',
          link: 'https://github.com/web-infra-dev/rsbuild',
        },
        {
          title: 'Discord',
          link: 'https://discord.gg/sYK4QjyZ4V',
        },
        {
          title: 'Twitter (X)',
          link: 'https://twitter.com/rspack_dev',
        },
        {
          title: 'Bluesky',
          link: 'https://bsky.app/profile/rspack.rs',
        },
        {
          title: 'Awesome Rstack',
          link: 'https://github.com/rstackjs/awesome-rstack',
        },
      ],
    },
  ];
}

export const HomeFooter = memo(() => {
  const footerData = useFooterData();
  return (
    <div className={styles.footer}>
      <div className={styles.container}>
        {footerData.map((item) => (
          <div key={item.title} className={styles.column}>
            <h2>{item.title}</h2>
            <ul>
              {item.items.map((subItem) => (
                <li key={subItem.title}>
                  <Link href={subItem.link}>
                    <span className={styles.text}>{subItem.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
});
