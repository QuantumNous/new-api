'use client';

import { useState } from 'react';

const Preview = ({
  type,
}: {
  type: 'weather' | 'event-planning' | 'media-search';
}) => {
  if (type === 'event-planning') {
    return (
      <div className="grid w-full gap-2 text-sm">
        {['Check calendars', 'Find a venue', 'Invite attendees'].map(item => (
          <div className="rounded-md bg-gray-100 p-3" key={item}>
            {item}
          </div>
        ))}
      </div>
    );
  }

  if (type === 'media-search') {
    return (
      <div className="grid w-full grid-cols-3 gap-2">
        {['Starry Night', 'Sunflowers', 'Olive Trees'].map((item, index) => (
          <div
            className="flex aspect-square items-end rounded-md bg-blue-200 p-2 text-blue-1000 text-xs"
            key={item}
            style={{ opacity: 1 - index * 0.15 }}
          >
            {item}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg bg-blue-700 p-4 text-white">
      <div className="text-sm opacity-80">San Francisco</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-4xl">47°</span>
        <span aria-label="Sunny" className="size-9 rounded-full bg-amber-300" />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
        {['Now', '9 AM', '10 AM', '11 AM'].map((time, index) => (
          <div key={time}>
            <div className="opacity-75">{time}</div>
            <div className="mt-1">{47 + index * 2}°</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const WeatherSearch = () => (
  <div className="not-prose my-6 mx-auto flex max-w-md flex-col gap-3 rounded-lg border border-gray-alpha-400 p-5">
    <div className="ml-auto rounded-lg bg-gray-1000 px-3 py-2 text-background-100 text-sm">
      What is the weather in San Francisco?
    </div>
    <div className="text-center font-mono text-gray-800 text-xs">
      getWeather(&quot;San Francisco&quot;)
    </div>
    <Preview type="weather" />
  </div>
);

export const CardPlayer = ({
  description,
  title,
  type,
}: {
  description: string;
  title: string;
  type: 'weather' | 'event-planning' | 'media-search';
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="not-prose mx-auto my-6 max-w-lg overflow-hidden rounded-lg border border-gray-alpha-400">
      <div
        className={`flex min-h-72 items-center justify-center p-6 transition-opacity ${
          isPlaying ? 'opacity-100' : 'opacity-75'
        }`}
      >
        <Preview type={type} />
      </div>
      <div className="border-gray-alpha-400 border-t p-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-semibold text-gray-1000 text-lg">{title}</h3>
          <button
            aria-label={`${isPlaying ? 'Pause' : 'Play'} ${title} preview`}
            className="rounded-md border border-gray-alpha-400 px-3 py-1.5 text-gray-1000 text-sm hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-700"
            onClick={() => setIsPlaying(value => !value)}
            type="button"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
        </div>
        <p className="mt-1 text-gray-900 text-sm leading-5">{description}</p>
      </div>
    </section>
  );
};
