/**
 * Light/dark aware image (legacy `<MDXImage>` / `<Image>`).
 *
 * Uses separate assets and intrinsic dimensions for light and dark themes.
 */
export const MDXImage = ({
  caption,
  alt,
  src,
  srcLight = src,
  srcDark = srcLight,
  width,
  height,
  widthDark = width,
  heightDark = height,
}: {
  alt?: string;
  caption?: string;
  src?: string;
  srcLight?: string;
  srcDark?: string;
  width?: number | string;
  height?: number | string;
  widthDark?: number | string;
  heightDark?: number | string;
}) => {
  const isProviderDiagram = srcLight === '/images/ai-sdk-diagram.png';
  const altText =
    alt ??
    caption ??
    (isProviderDiagram
      ? 'Diagram showing the AI SDK Core API, provider specifications, and provider implementations'
      : '');
  const lightWidth = isProviderDiagram ? 1694 : width;
  const lightHeight = isProviderDiagram ? 1206 : height;
  const darkWidth = isProviderDiagram ? 2541 : widthDark;
  const darkHeight = isProviderDiagram ? 1884 : heightDark;

  return (
    <figure>
      {/* biome-ignore lint/performance/noImgElement: theme-specific public asset */}
      <img
        alt={altText}
        className="block rounded-lg border border-gray-alpha-400 bg-gray-100 dark:hidden"
        height={lightHeight}
        loading="lazy"
        src={srcLight}
        width={lightWidth}
      />
      {/* biome-ignore lint/performance/noImgElement: theme-specific public asset */}
      <img
        alt={altText}
        className="hidden rounded-lg border border-gray-alpha-400 bg-gray-100 dark:block"
        height={darkHeight}
        loading="lazy"
        src={srcDark}
        width={darkWidth}
      />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
};
