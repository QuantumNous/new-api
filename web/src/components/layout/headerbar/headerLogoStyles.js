export function getHeaderLogoFrameClassName({ hasLogoImage }) {
  const baseClassName =
    'relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl text-sm shadow-sm';

  if (hasLogoImage) {
    return `${baseClassName} bg-white ring-1 ring-black/5 dark:bg-white dark:ring-white/10`;
  }

  return `${baseClassName} bg-indigo-600 text-white`;
}

export function getHeaderLogoImageClassName({ isDefaultLogo }) {
  const baseClassName = 'absolute inset-0 h-full w-full object-cover';

  if (isDefaultLogo) {
    return `${baseClassName} scale-[1.08]`;
  }

  return baseClassName;
}
