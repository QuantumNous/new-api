import ToolSpinner from './tool-spinner';

type FileToolPart = {
  type: 'tool-read' | 'tool-write' | 'tool-edit';
  state: string;
  input?: {
    file_path?: string;
    path?: string;
  };
};

const LABELS = {
  'tool-read': 'Read',
  'tool-write': 'Write',
  'tool-edit': 'Edit',
} as const;

export default function HarnessFileToolView({
  invocation,
}: {
  invocation: FileToolPart;
}) {
  const filePath = invocation.input?.file_path ?? invocation.input?.path;
  if (!filePath) {
    return null;
  }

  const label = LABELS[invocation.type];
  const running = invocation.state !== 'output-available';

  return (
    <div className="relative mb-2 text-sm text-gray-500">
      {running && <ToolSpinner />}
      <strong>{label}</strong>(<code>{filePath}</code>)
    </div>
  );
}
