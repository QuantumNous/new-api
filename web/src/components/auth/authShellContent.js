const zhStories = [
  {
    tag: 'PRODUCT',
    quote:
      '我们把产品调研、需求梳理和竞品分析都串起来了，同一套模型工作流就能覆盖从灵感到落地的全过程。',
    name: 'Lynn Guo',
    role: '产品负责人 @ AsterLab',
    avatar: 'L',
  },
  {
    tag: 'DESIGN',
    quote:
      '设计师现在可以直接拿它做文案草稿、视觉探索和提示词迭代，沟通效率明显更高。',
    name: 'Sarah Chen',
    role: '创意总监 @ DesignStudio',
    avatar: 'S',
  },
  {
    tag: 'OPS',
    quote:
      '活动页、投放文案、客服话术都能快速生成和改写，运营侧不再需要反复等支持。',
    name: 'Mia Lin',
    role: '运营经理 @ SparkGrowth',
    avatar: 'M',
  },
  {
    tag: 'ENGINEER',
    quote:
      '接入过程很顺，开发同学替换掉 base_url 就能继续跑，切换模型和线路也更灵活。',
    name: 'Jason Wu',
    role: '工程负责人 @ ByteFlow',
    avatar: 'J',
  },
  {
    tag: 'FOUNDER',
    quote:
      '对我们这种小企业来说，最重要的是稳定和省心。模型覆盖够全，成员谁都能马上上手。',
    name: 'Annie Zhao',
    role: '联合创始人 @ NorthStar',
    avatar: 'A',
  },
];

const enStories = [
  {
    tag: 'PRODUCT',
    quote:
      'We connected product research, requirement planning, and competitive analysis into one workflow, so the same model setup now supports everything from ideas to delivery.',
    name: 'Lynn Guo',
    role: 'Product Lead @ AsterLab',
    avatar: 'L',
  },
  {
    tag: 'DESIGN',
    quote:
      'Designers can now use it directly for copy drafts, visual exploration, and prompt iteration, which makes collaboration much faster.',
    name: 'Sarah Chen',
    role: 'Creative Director @ DesignStudio',
    avatar: 'S',
  },
  {
    tag: 'OPS',
    quote:
      'Campaign pages, ad copy, and support scripts can all be generated and rewritten quickly, so the operations team no longer waits around for help.',
    name: 'Mia Lin',
    role: 'Operations Manager @ SparkGrowth',
    avatar: 'M',
  },
  {
    tag: 'ENGINEER',
    quote:
      'Integration was smooth. Our developers just swapped the base_url and kept going, while model and route switching became much more flexible.',
    name: 'Jason Wu',
    role: 'Engineering Lead @ ByteFlow',
    avatar: 'J',
  },
  {
    tag: 'FOUNDER',
    quote:
      'For a small team like ours, stability and simplicity matter most. Model coverage is broad enough that anyone on the team can start using it right away.',
    name: 'Annie Zhao',
    role: 'Co-founder @ NorthStar',
    avatar: 'A',
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
    hero: 'auth-shell-hero auth-theme-hero relative hidden w-[54%] overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-10 lg:pb-12 lg:pt-28 xl:px-14 xl:pb-14 xl:pt-32',
    backLink:
      'auth-theme-back-link mb-16 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition',
    eyebrow:
      'auth-theme-eyebrow mb-4 text-xs font-bold uppercase tracking-[0.28em]',
    headline:
      'auth-theme-headline max-w-xl text-[40px] font-bold leading-[1.15] xl:text-[46px]',
    storyCard: 'auth-theme-story-card rounded-[28px] p-7 backdrop-blur-xl',
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
    formCard: 'auth-theme-form-card rounded-[28px] p-6 sm:p-8',
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
