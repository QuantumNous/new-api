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
    root: 'auth-shell relative min-h-screen overflow-hidden bg-white dark:bg-[#0b1020]',
    layout: 'flex min-h-screen w-full overflow-hidden bg-white dark:bg-[#0f1425]',
    hero:
      'auth-shell-hero relative hidden w-[54%] overflow-hidden border-r border-gray-200/70 dark:border-white/10 lg:flex lg:flex-col lg:justify-between lg:px-10 lg:pb-12 lg:pt-28 xl:px-14 xl:pb-14 xl:pt-32',
    backLink:
      'mb-16 inline-flex w-fit items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:border-white/20 dark:hover:text-white',
    eyebrow:
      'mb-4 text-xs font-bold uppercase tracking-[0.28em] text-indigo-600 dark:text-indigo-300',
    headline:
      'max-w-xl text-[40px] font-bold leading-[1.15] text-gray-900 dark:text-white xl:text-[46px]',
    storyCard:
      'rounded-[28px] border border-white/80 bg-white/70 p-7 shadow-[0_20px_60px_rgba(99,102,241,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)]',
    storyTag:
      'inline-flex rounded-full border border-white bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-indigo-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-indigo-200',
    storyQuote:
      'min-h-[96px] text-[15px] font-medium leading-7 text-gray-800 dark:text-gray-100',
    storyAvatar:
      'flex h-11 w-11 items-center justify-center rounded-full border border-white bg-gradient-to-br from-indigo-100 to-cyan-100 text-base font-bold text-indigo-600 dark:border-white/10 dark:from-indigo-500/30 dark:to-cyan-500/30 dark:text-indigo-100',
    storyName: 'text-sm font-bold text-gray-900 dark:text-white',
    storyRole: 'text-sm text-gray-500 dark:text-gray-400',
    dotIdle: 'w-2 bg-gray-300 dark:bg-white/20',
    dotActive: 'w-6 bg-indigo-600 dark:bg-indigo-400',
    surface:
      'relative flex w-full flex-1 flex-col justify-center bg-white px-6 pb-10 pt-24 dark:bg-[#11162a] sm:px-10 lg:w-[46%] lg:px-12 lg:pb-12 lg:pt-28 xl:px-16 xl:pb-16 xl:pt-32',
    mobileBackLink:
      'mb-8 inline-flex w-fit items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white lg:hidden',
    logoFallback: 'text-2xl text-gray-900 dark:text-white',
    titleEyebrow:
      'mb-3 text-xs font-bold uppercase tracking-[0.28em] text-gray-400 dark:text-gray-500',
    title: 'text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-[34px]',
    description: 'mt-3 text-[15px] leading-7 text-gray-500 dark:text-gray-400',
    formCard:
      'rounded-[28px] border border-gray-200/80 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#161c31] dark:shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:p-8',
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
