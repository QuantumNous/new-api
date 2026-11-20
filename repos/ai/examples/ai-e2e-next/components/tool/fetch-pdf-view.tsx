import type { FetchPDFUIToolInvocation } from '@/tool/fetch-pdf-tool';

export default function FetchPDFView({
  invocation,
}: {
  invocation: FetchPDFUIToolInvocation;
}) {
  switch (invocation.state) {
    case 'input-available':
      return (
        <div className="mb-2 bg-gray-900 rounded-xl border border-gray-600 shadow-lg">
          Fetching PDF...
        </div>
      );
    case 'output-available':
      return (
        <div className="p-4 mb-2 bg-gray-900 rounded-xl border border-gray-600 shadow-lg">
          <div className="mb-2 font-semibold text-gray-300">PDF Result</div>
          <a
            className="text-blue-400 underline"
            href={`data:application/pdf;base64,${invocation.output.base64}`}
            download="test.pdf"
            target="_blank"
          >
            Download PDF
          </a>
        </div>
      );
  }
}
