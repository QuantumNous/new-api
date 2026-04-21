export function shouldShowHeaderLogoFallback({
  hasLogoImage,
  isLoading,
}) {
  return !hasLogoImage && !isLoading;
}
