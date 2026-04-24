export function getHeaderLogoFrameClassName({ hasLogoSource }) {
  if (hasLogoSource) {
    return 'relative flex h-10 w-[150px] shrink-0 items-center overflow-hidden sm:w-[205px]';
  }

  return 'relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-indigo-600 text-sm text-white shadow-sm';
}

export function getHeaderLogoImageClassName() {
  return 'absolute inset-0 h-full w-full object-contain object-left';
}
