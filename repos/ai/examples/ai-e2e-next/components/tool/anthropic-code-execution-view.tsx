import type { anthropic } from '@ai-sdk/anthropic';
import type { UIToolInvocation } from 'ai';
import { Download } from 'lucide-react';

export default function AnthropicCodeExecutionView({
  invocation,
  provider = 'anthropic',
}: {
  invocation: UIToolInvocation<
    ReturnType<typeof anthropic.tools.codeExecution_20250825>
  >;
  provider?: 'anthropic' | 'anthropic-microsoft';
}) {
  switch (invocation.state) {
    case 'input-streaming':
    case 'input-available': {
      return <InputView input={invocation.input} />;
    }
    case 'output-error': {
      return (
        <>
          <InputView input={invocation.input} />
          <div className="mb-2 bg-red-900 rounded-xl border border-red-700 shadow-lg">
            <pre className="overflow-x-auto p-4 text-sm text-red-100 whitespace-pre-wrap">
              <span className="font-semibold">Code Execution Error</span>
              <br />
              {invocation.errorText}
            </pre>
          </div>
        </>
      );
    }
    case 'output-available':
      return (
        <>
          <InputView input={invocation.input} />

          <div className="mb-2 bg-gray-600 rounded-xl border border-gray-900 shadow-lg">
            <pre className="overflow-x-auto p-4 text-sm text-gray-100 whitespace-pre-wrap">
              {invocation.output.type === 'code_execution_result' && (
                <>
                  <span className="font-semibold">Stdout:</span>
                  <br />
                  {invocation.output.stdout}
                  <br />
                  {invocation.output.stderr && (
                    <>
                      <span className="font-semibold">Stderr:</span>
                      <br />
                      {invocation.output.stderr}
                      <br />
                    </>
                  )}
                  {invocation.output.return_code != null && (
                    <>
                      <span className="font-semibold">Return Code:</span>
                      <br />
                      {invocation.output.return_code}
                      <br />
                    </>
                  )}
                </>
              )}
              {invocation.output.type === 'bash_code_execution_result' && (
                <>
                  <span className="font-semibold">Stdout:</span>
                  <br />
                  {invocation.output.stdout}
                  <br />
                  {invocation.output.stderr && (
                    <>
                      <span className="font-semibold">Stderr:</span>
                      <br />
                      {invocation.output.stderr}
                      <br />
                    </>
                  )}
                  <br />
                  {invocation.output.content.length > 0 && (
                    <div className="bg-gray-200 py-2 px-2 rounded-lg flex flex-col gap-1">
                      <div className="px-1">
                        {invocation.output.content.length > 1 ? (
                          <p className="text-black">downloads</p>
                        ) : (
                          <p className="text-black">download</p>
                        )}
                      </div>
                      {invocation.output.content.map(file => (
                        <button
                          className="bg-cyan-800 hover:bg-cyan-700 text-white rounded-lg py-1 px-2 border border-white cursor-pointer"
                          key={file.file_id}
                          onClick={() =>
                            window.open(
                              `/api/code-execution-files/${provider}/${file.file_id}`,
                              '_blank',
                            )
                          }
                        >
                          <div className="flex gap-1 items-center justify-center">
                            <Download />
                            <p>{file.file_id}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {invocation.output.return_code != null && (
                    <>
                      <span className="font-semibold">Return Code:</span>
                      <br />
                      {invocation.output.return_code}
                      <br />
                    </>
                  )}
                </>
              )}
              {invocation.output.type ===
                'bash_code_execution_tool_result_error' && (
                <>
                  <span className="font-semibold">Bash Tool Result Error</span>
                  <br />
                  <span className="font-semibold">Error Code:</span>{' '}
                  {invocation.output.error_code}
                  <br />
                </>
              )}
              {invocation.output.type ===
                'text_editor_code_execution_create_result' && (
                <>
                  <span className="font-semibold">File Create Result</span>
                  <br />
                  <span className="font-semibold">Is File Update:</span>{' '}
                  {invocation.output.is_file_update ? 'Yes' : 'No'}
                  <br />
                </>
              )}
              {invocation.output.type ===
                'text_editor_code_execution_view_result' && (
                <>
                  <span className="font-semibold">File View Result</span>
                  <br />
                  <span className="font-semibold">File Type:</span>{' '}
                  {invocation.output.file_type}
                  <br />
                  <span className="font-semibold">Content:</span>
                  <br />
                  {invocation.output.content}
                  <br />
                </>
              )}
              {invocation.output.type ===
                'text_editor_code_execution_str_replace_result' && (
                <>
                  <span className="font-semibold">File Str Replace Result</span>
                  <br />
                  <span className="font-semibold">New Start:</span>{' '}
                  {invocation.output.new_start}
                  <br />
                  <span className="font-semibold">New Lines:</span>{' '}
                  {invocation.output.new_lines}
                  <br />
                  <span className="font-semibold">Old Start:</span>{' '}
                  {invocation.output.old_start}
                  <br />
                  <span className="font-semibold">Old Lines:</span>{' '}
                  {invocation.output.old_lines}
                  <br />
                  <span className="font-semibold">Lines:</span>
                  <br />
                  {invocation.output.lines?.join('\n')}
                  <br />
                </>
              )}
              {invocation.output.type ===
                'text_editor_code_execution_tool_result_error' && (
                <>
                  <span className="font-semibold">
                    Text Editor Tool Result Error
                  </span>
                  <br />
                  <span className="font-semibold">Error Code:</span>{' '}
                  {invocation.output.error_code}
                  <br />
                </>
              )}
            </pre>
          </div>
        </>
      );
  }
}

function InputView({
  input,
}: {
  input: UIToolInvocation<
    ReturnType<typeof anthropic.tools.codeExecution_20250825>
  >['input'];
}) {
  if (!input) {
    return null;
  }

  switch (input.type) {
    // Handle programmatic tool calling format
    case 'programmatic-tool-call': {
      return (
        <div className="mb-2 bg-gray-600 rounded-xl border border-gray-900 shadow-lg">
          <pre className="overflow-x-auto p-4 text-sm text-gray-100 whitespace-pre-wrap">
            <span className="font-semibold">Code Execution</span>
            <br />
            <span className="font-semibold">Code:</span>
            <br />
            {input.code}
          </pre>
        </div>
      );
    }

    case 'text_editor_code_execution': {
      switch (input.command) {
        case 'view': {
          return (
            <div className="mb-2 text-gray-100 bg-gray-600 rounded-xl border border-gray-900 shadow-lg">
              <pre className="overflow-x-auto p-4 text-sm text-gray-100 whitespace-pre-wrap">
                <span className="font-semibold">Text Editor (View)</span>
                <br />
                {input.path && (
                  <>
                    <span className="font-semibold">File Path:</span>{' '}
                    {input.path}
                    <br />
                  </>
                )}
              </pre>
            </div>
          );
        }
        case 'create': {
          return (
            <div className="mb-2 text-gray-100 bg-gray-600 rounded-xl border border-gray-900 shadow-lg">
              <pre className="overflow-x-auto p-4 text-sm text-gray-100 whitespace-pre-wrap">
                <span className="font-semibold">Text Editor (Create)</span>
                <br />
                {input.path && (
                  <>
                    <span className="font-semibold">File Path:</span>{' '}
                    {input.path}
                    <br />
                  </>
                )}
                {input.file_text && (
                  <>
                    <span className="font-semibold">File Text:</span>{' '}
                    {input.file_text}
                    <br />
                  </>
                )}
              </pre>
            </div>
          );
        }
        case 'str_replace': {
          return (
            <div className="mb-2 text-gray-100 bg-gray-600 rounded-xl border border-gray-900 shadow-lg">
              <pre className="overflow-x-auto p-4 text-sm text-gray-100 whitespace-pre-wrap">
                <span className="font-semibold">Text Editor (Replace)</span>
                <br />
                {input.path && (
                  <>
                    <span className="font-semibold">File Path:</span>{' '}
                    {input.path}
                    <br />
                  </>
                )}
                {input.old_str && (
                  <>
                    <span className="font-semibold">Old String:</span>
                    <br />
                    {input.old_str}
                    <br />
                  </>
                )}
                {input.new_str && (
                  <>
                    <span className="font-semibold">New String:</span>
                    <br />
                    {input.new_str}
                    <br />
                  </>
                )}
              </pre>
            </div>
          );
        }
      }
      break;
    }

    case 'bash_code_execution': {
      const command = input.command;

      return (
        <div className="mb-2 bg-gray-600 rounded-xl border border-gray-900 shadow-lg">
          <pre className="overflow-x-auto p-4 text-sm text-gray-100 whitespace-pre-wrap">
            <span className="font-semibold">Bash</span>
            <br />
            {command && (
              <>
                <span className="font-semibold">Command:</span> {command}
                <br />
              </>
            )}
          </pre>
        </div>
      );
    }
  }

  return null;
}
