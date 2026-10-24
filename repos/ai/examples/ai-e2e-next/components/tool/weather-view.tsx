import type { WeatherUIToolInvocation } from '@/tool/weather-tool';

export default function WeatherView({
  invocation,
}: {
  invocation: WeatherUIToolInvocation;
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
