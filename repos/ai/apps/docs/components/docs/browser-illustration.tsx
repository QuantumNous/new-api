export const BrowserIllustration = ({
  blocking = false,
}: {
  blocking?: boolean;
  highlight?: boolean;
}) => (
  <div className="not-prose w-64 max-w-full overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100 shadow-sm">
    <div className="flex gap-1 border-gray-alpha-400 border-b bg-gray-100 p-2">
      <span className="size-2 rounded-full bg-red-700" />
      <span className="size-2 rounded-full bg-amber-700" />
      <span className="size-2 rounded-full bg-green-700" />
    </div>
    <div className="flex min-h-40 flex-col gap-3 p-5">
      {blocking ? (
        <div className="m-auto flex items-center gap-2 text-gray-800 text-sm">
          <span className="size-3 animate-spin rounded-full border border-gray-500 border-t-transparent motion-reduce:animate-none" />
          Waiting for response…
        </div>
      ) : (
        [72, 56, 84, 64, 40].map(width => (
          <span
            className="h-2 rounded-full bg-blue-500"
            key={width}
            style={{ width: `${width}%` }}
          />
        ))
      )}
    </div>
  </div>
);
