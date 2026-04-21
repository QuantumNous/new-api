export function getHeaderLogoFrameClassName({ hasLogoImage }) {
  const baseClassName =
    'relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl text-sm';

  if (hasLogoImage) {
    return baseClassName;
  }

  return `${baseClassName} bg-indigo-600 text-white shadow-sm`;
}

export function getHeaderLogoImageClassName({ isDefaultLogo }) {
  const baseClassName =
    'absolute inset-0 m-auto h-[82%] w-[82%] object-contain';

  if (isDefaultLogo) {
    return `${baseClassName} scale-[1.02]`;
  }

  return baseClassName;
}
