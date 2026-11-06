import type { WeatherUIToolValibotInvocation } from '@/tool/weather-tool-valibot';

export default function WeatherValibotView({
  invocation,
}: {
  invocation: WeatherUIToolValibotInvocation;
}) {
  switch (invocation.state) {
    case 'output-available':
      return (
        <div className="text-gray-500">
          {invocation.output.state === 'loading'
            ? 'Fetching weather information...'
            : `Weather in ${invocation.input.city}: ${invocation.output.weather}`}
        </div>
      );

    case 'output-error':
      return <div className="text-red-500">Error: {invocation.errorText}</div>;
  }
}
