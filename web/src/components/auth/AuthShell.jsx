import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconArrowLeft } from '@douyinfe/semi-icons';
import { getLogo, getSystemName } from '../../helpers';
import {
  getAuthPageCopy,
  getAuthShellThemeClasses,
  getAuthStories,
  shouldKeepAuthHeadlineSecondLineSingleLine,
} from './authShellContent';

const AuthShell = ({ mode, children }) => {
  const { t, i18n } = useTranslation();
  const [storyIndex, setStoryIndex] = useState(0);
  const logo = getLogo();
  const systemName = getSystemName();
  const copy = useMemo(
    () => getAuthPageCopy(mode, t, systemName),
    [mode, systemName, t],
  );
  const themeClasses = useMemo(() => getAuthShellThemeClasses(), []);
  const stories = useMemo(() => getAuthStories(i18n.language), [i18n.language]);
  const keepSecondLineSingleLine = shouldKeepAuthHeadlineSecondLineSingleLine(
    i18n.language,
  );

  useEffect(() => {
    if (stories.length <= 1) {
      return undefined;
    }
    const timer = setInterval(() => {
      setStoryIndex((current) => (current + 1) % stories.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [stories]);

  useEffect(() => {
    if (storyIndex >= stories.length) {
      setStoryIndex(0);
    }
  }, [stories, storyIndex]);

  const activeStory = stories[storyIndex] || stories[0];

  return (
    <div className={themeClasses.root}>
      <div className={themeClasses.layout}>
        <div className={themeClasses.hero}>
          <div className='auth-shell-glow auth-shell-glow-primary' />
          <div className='auth-shell-glow auth-shell-glow-secondary' />

          <div className='relative z-10'>
            <Link to='/' className={themeClasses.backLink}>
              <IconArrowLeft size='small' />
              <span>{t('返回首页')}</span>
            </Link>

            <div className={themeClasses.eyebrow}>
              {copy.eyebrow}
            </div>
            <h2 className={themeClasses.headline}>
              {t('在这里，')}
              <br />
              <span className={keepSecondLineSingleLine ? 'whitespace-nowrap' : ''}>
                {t('让想象力成为唯一的边界。')}
              </span>
            </h2>
          </div>

          {activeStory && (
            <div className='relative z-10 max-w-lg'>
              <div className={themeClasses.storyCard}>
                <div className='mb-5 flex items-center justify-between gap-4'>
                  <span className={themeClasses.storyTag}>
                    {activeStory.tag}
                  </span>
                  <div className='flex items-center gap-2'>
                    {stories.map((story, index) => (
                      <button
                        key={`${story.tag}-${index}`}
                        type='button'
                        className={`h-2 rounded-full transition-all ${
                          index === storyIndex
                            ? themeClasses.dotActive
                            : themeClasses.dotIdle
                        }`}
                        onClick={() => setStoryIndex(index)}
                        aria-label={`${t('登录')} story ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <p className={themeClasses.storyQuote}>
                  “{activeStory.quote}”
                </p>

                <div className='mt-6 flex items-center gap-4'>
                  <div className={themeClasses.storyAvatar}>
                    {activeStory.avatar}
                  </div>
                  <div>
                    <div className={themeClasses.storyName}>
                      {activeStory.name}
                    </div>
                    <div className={themeClasses.storyRole}>{activeStory.role}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={themeClasses.surface}>
          <Link to='/' className={themeClasses.mobileBackLink}>
            <IconArrowLeft size='small' />
            <span>{t('返回首页')}</span>
          </Link>

          <div className='mx-auto w-full max-w-[440px]'>
            <div className='mb-8 flex items-center justify-start'>
              {logo ? (
                <img
                  src={logo}
                  alt={systemName}
                  className='h-12 w-12 rounded-xl object-cover'
                />
              ) : (
                <span className={themeClasses.logoFallback}>*</span>
              )}
            </div>

            <div className='mb-8'>
              <div className={themeClasses.titleEyebrow}>
                {copy.eyebrow}
              </div>
              <h1 className={themeClasses.title}>
                {copy.title}
              </h1>
              <p className={themeClasses.description}>
                {copy.description}
              </p>
            </div>

            <div className={themeClasses.formCard}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
