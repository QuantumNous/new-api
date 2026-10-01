/**
 * Terminal command snippet (legacy @vercel/geist `<Snippet>` equivalent).
 * Renders one `$`-prefixed line per command.
 */
export const Snippet = ({
  text,
  prompt = true,
}: {
  text: string;
  width?: number | string;
  prompt?: boolean;
}) => (
  <pre className="not-prose my-4 overflow-x-auto rounded-md border border-gray-alpha-400 bg-background-100 p-4 font-mono text-[13px] leading-6 text-gray-1000">
    {text.split('\n').map((line, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: static content
      <div key={index}>
        {prompt ? <span className="select-none text-gray-700">$ </span> : null}
        {line}
      </div>
    ))}
  </pre>
);
