import type { GenerateImageUIToolInvocation } from '@/tool/generate-image-tool';

export default function GenerateImageView({
  invocation,
}: {
  invocation: GenerateImageUIToolInvocation;
}) {
  switch (invocation.state) {
    case 'input-available':
      return (
        <div className="mb-2 bg-gray-900 rounded-xl border border-gray-600 shadow-lg">
          Generating image...
        </div>
      );
    case 'output-available':
      return (
        <div className="mb-2 bg-gray-900 rounded-xl border border-gray-600 shadow-lg">
          <img
            src={`data:${invocation.output.mediaType};base64,${invocation.output.base64}`}
          />
        </div>
      );
  }
}
