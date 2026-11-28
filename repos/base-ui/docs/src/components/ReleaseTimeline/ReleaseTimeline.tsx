'use client';

import * as React from 'react';
import Link from 'next/link';
import { Code } from 'docs/src/components/Code';
import { releases } from 'docs/src/data/releases';
import './ReleaseTimeline.css';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function renderHighlight(text: string): React.ReactNode {
  const parts = text.split(/`([^`]+)`/);
  return parts.length === 1
    ? text
    : parts.map((part, i) => (i % 2 === 1 ? <Code key={i}>{part}</Code> : part));
}

export function ReleaseTimeline() {
  return (
    <ul className="ReleaseTimeline" aria-label="Release timeline">
      <div className="TimelineSpine" />
      {releases.map((release) => (
        <li key={release.versionSlug} className="TimelineItem">
          <article className="TimelineCard">
            <div className="TimelineCardHeader">
              <time className="TimelineDate" dateTime={release.date}>
                {dateFormatter.format(new Date(release.date))}
              </time>
              <h3 className="TimelineVersion">
                <Link
                  className="TimelineVersionLink"
                  href={`/react/overview/releases/${release.versionSlug}`}
                >
                  {release.version}
                </Link>
                {release.latest && <span className="TimelineBadge">Latest</span>}
              </h3>
            </div>
            <ul className="TimelineHighlights">
              {release.highlights.map((highlight, i) => (
                <li key={i}>{renderHighlight(highlight)}</li>
              ))}
            </ul>
          </article>
        </li>
      ))}
    </ul>
  );
}
