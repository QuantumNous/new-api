const zhStories = [
  {
    tag: 'PRODUCT',
    quote: '我们把产品调研、需求梳理和竞品分析都串起来了。',
    name: 'Lynn Guo',
    role: '产品负责人 @ AsterLab',
    avatar: 'L',
  },
  {
    tag: 'ENGINEER',
    quote: '接入过程很顺，切换模型和线路也更灵活。',
    name: 'Jason Wu',
    role: '工程负责人 @ ByteFlow',
    avatar: 'J',
  },
];

const enStories = [
  {
    tag: 'PRODUCT',
    quote: 'Connected research and planning into one workflow.',
    name: 'Lynn Guo',
    role: 'Product Lead @ AsterLab',
    avatar: 'L',
  },
  {
    tag: 'ENGINEER',
    quote: 'Integration was smooth and routing is flexible.',
    name: 'Jason Wu',
    role: 'Engineering Lead @ ByteFlow',
    avatar: 'J',
  },
];

export function getAuthPageCopy(mode, t, systemName) {
  const sharedName = systemName || 'Infinite Galaxy AI';
  const translatedName = t(sharedName);
  const normalizedMode = mode === 'register' ? 'register' : 'login';

  if (normalizedMode === 'register') {
    return {
      eyebrow: translatedName,
      title: t('创建账号'),
      description: t('注册您的无限星河账号，立即开始使用。'),
      submitText: t('免费注册'),
      switchPrefix: t('已有账户？'),
      switchText: t('登录'),
      switchHref: '/login',
    };
  }

  return {
    eyebrow: translatedName,
    title: t('欢迎回来'),
    description: t('登录您的无限星河账号以继续。'),
    submitText: t('登录账号'),
    switchPrefix: t('还没有账号？'),
    switchText: t('免费注册'),
    switchHref: '/register',
  };
}

export function getAuthShellThemeClasses() {
  return {
    root: 'auth-shell auth-theme-shell-root relative min-h-screen overflow-hidden',
    layout: 'auth-theme-shell-layout flex min-h-screen w-full overflow-hidden',
    hero:
      'auth-shell-hero auth-theme-hero relative hidden w-[54%] overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-10 lg:pb-12 lg:pt-28 xl:px-14 xl:pb-14 xl:pt-32',
    backLink:
      'auth-theme-back-link mb-16 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition',
    eyebrow:
      'auth-theme-eyebrow mb-4 text-xs font-bold uppercase tracking-[0.28em]',
    headline:
      'auth-theme-headline max-w-xl text-[40px] font-bold leading-[1.15] xl:text-[46px]',
    storyCard:
      'auth-theme-story-card rounded-[28px] p-7 backdrop-blur-xl',
    storyTag:
      'auth-theme-story-tag inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em]',
    storyQuote:
      'auth-theme-story-quote min-h-[96px] text-[15px] font-medium leading-7',
    storyAvatar:
      'auth-theme-story-avatar flex h-11 w-11 items-center justify-center rounded-full text-base font-bold',
    storyName: 'auth-theme-story-name text-sm font-bold',
    storyRole: 'auth-theme-story-role text-sm',
    dotIdle: 'auth-theme-dot-idle w-2',
    dotActive: 'auth-theme-dot-active w-6',
    surface:
      'auth-theme-surface relative flex w-full flex-1 flex-col justify-center px-6 pb-10 pt-24 sm:px-10 lg:w-[46%] lg:px-12 lg:pb-12 lg:pt-28 xl:px-16 xl:pb-16 xl:pt-32',
    mobileBackLink:
      'auth-theme-mobile-back-link mb-8 inline-flex w-fit items-center gap-2 text-sm font-medium transition lg:hidden',
    logoFallback: 'auth-theme-logo-fallback text-2xl',
    titleEyebrow:
      'auth-theme-title-eyebrow mb-3 text-xs font-bold uppercase tracking-[0.28em]',
    title: 'auth-theme-title text-3xl font-bold tracking-tight sm:text-[34px]',
    description: 'auth-theme-description mt-3 text-[15px] leading-7',
    formCard:
      'auth-theme-form-card rounded-[28px] p-6 sm:p-8',
  };
}

export function getAuthStories(language) {
  if (typeof language === 'string' && language.toLowerCase().startsWith('en')) {
    return enStories;
  }
  return zhStories;
}

export function shouldKeepAuthHeadlineSecondLineSingleLine(language) {
  return (
    typeof language === 'string' && language.toLowerCase().startsWith('en')
  );
}
