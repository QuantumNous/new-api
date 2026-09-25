import type { openai } from '@ai-sdk/openai';
import type { UIToolInvocation } from 'ai';

export default function CodeInterpreterView({
  invocation,
}: {
  invocation: UIToolInvocation<ReturnType<typeof openai.tools.codeInterpreter>>;
}) {
  return (
    <div className="mb-2 bg-gray-900 rounded-xl border border-gray-600 shadow-lg">
      <div className="px-6 py-3 bg-gray-800 rounded-t-xl border-b border-gray-700">
        <div className="overflow-hidden tracking-wide text-gray-500 whitespace-nowrap text-xxs font-small text-ellipsis">
          {invocation.input?.containerId}
        </div>
      </div>

      <div className="p-6">
        <div className="mb-3">
          <div className="mb-2 text-sm font-medium text-blue-400">Code:</div>
          <pre className="overflow-x-auto p-4 text-sm text-gray-100 whitespace-pre-wrap bg-black rounded-lg">
            {invocation.input?.code}
          </pre>
        </div>

        {invocation.state === 'output-available' && (
          <div className="mb-3">
            <div className="mb-2 text-sm font-medium text-yellow-400">
              Output:
            </div>
            <div className="space-y-2">
              {invocation.output.outputs?.map((output, index) => (
                <div key={index} className="p-3 bg-black rounded-lg">
                  {output.type === 'logs' && (
                    <div className="font-mono text-sm text-green-300">
                      <span className="whitespace-pre-wrap">{output.logs}</span>
                    </div>
                  )}
                  {output.type === 'image' && <img src={output.url} />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
