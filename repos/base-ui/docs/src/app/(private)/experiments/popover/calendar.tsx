'use client';
import * as React from 'react';
import { Popover } from '@base-ui/react';
import { Ellipsis, X } from 'lucide-react';
import { eventPopover, type EventData } from './calendar-shared';
import styles from './calendar.module.css';

const EVENTS: EventData[] = [
  {
    title: 'React Conf 2025 talk',
    dayOfWeek: 2,
    startTime: 15.4167,
    endTime: 15.5833,
    dateString: 'October 7, 2025',
    location: 'The Westin Lake Las Vegas Resort & Spa, Main Stage',
    imageUrl:
      'https://images.unsplash.com/photo-1626125345510-4603468eedfb?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&w=1000',
    id: 1,
  },
  {
    title: 'Booth time',
    dayOfWeek: 3,
    startTime: 9.5,
    endTime: 17,
    dateString: 'October 8, 2025',
    location: 'The Westin Lake Las Vegas Resort & Spa, MUI booth',
    imageUrl:
      'https://images.unsplash.com/photo-1560439514-4e9645039924?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&w=1000',
    id: 2,
  },
  {
    title: 'Chilling out',
    dayOfWeek: 4,
    startTime: 9,
    endTime: 12,
    id: 3,
    dateString: 'October 9, 2025',
    description: 'Pool, spa, and more',
  },
];

export default function CalendarDemo() {
  return (
    <div className={styles.Page}>
      <Calendar startHour={6} endHour={22} events={EVENTS} />
    </div>
  );
}

interface CalendarProps {
  startHour?: number;
  endHour?: number;
  events: EventData[];
}

function Calendar(props: CalendarProps) {
  const { startHour = 0, endHour = 24, events } = props;
  const hoursShown = endHour - startHour;

  return (
    <React.Fragment>
      <div
        className={styles.Calendar}
        style={{ '--hours-shown': hoursShown } as React.CSSProperties}
      >
        <div className={styles.HourLabels}>
          {[...Array(hoursShown)].map((_, i) => (
            <div key={i} style={{ '--hour': i } as React.CSSProperties}>
              {startHour + i}:00
            </div>
          ))}
        </div>
        {events.map((event) => (
          <Event
            key={event.id}
            event={event}
            calendarStartHour={startHour}
            calendarEndHour={endHour}
          />
        ))}
      </div>
      <EventDetails />
    </React.Fragment>
  );
}

interface EventProps {
  event: EventData;
  calendarStartHour: number;
  calendarEndHour: number;
}

function Event(props: EventProps) {
  const { event, calendarStartHour, calendarEndHour } = props;
  const hoursShown = calendarEndHour - calendarStartHour;

  return (
    <Popover.Trigger
      handle={eventPopover}
      className={styles.Event}
      payload={event}
      style={{
        top: `${(event.startTime - calendarStartHour) * (100 / hoursShown)}%`,
        height: `${(event.endTime - event.startTime) * (100 / hoursShown)}%`,
        gridColumn: event.dayOfWeek,
      }}
      render={<div />}
      nativeButton={false}
    >
      <span className={styles.Title}>{event.title}</span>
      <span className={styles.Time}>
        {formatTime(event.startTime)} - {formatTime(event.endTime)}
      </span>
    </Popover.Trigger>
  );
}

function EventDetails() {
  return (
    <Popover.Root handle={eventPopover}>
      {({ payload }) => {
        if (!payload) {
          return null;
        }

        return (
          <Popover.Portal>
            <Popover.Positioner side="right" sideOffset={8} className={styles.Positioner}>
              <Popover.Popup className={styles.EventDetails}>
                <div className={styles.Header}>
                  <Popover.Title className={styles.EventTitle}>{payload.title}</Popover.Title>
                  <div className={styles.EventActions}>
                    <button type="button">
                      <Ellipsis />
                    </button>
                    <Popover.Close>
                      <X />
                    </Popover.Close>
                  </div>
                </div>
                <p className={styles.EventTime}>
                  {payload.dateString} &middot; {formatTime(payload.startTime)} -{' '}
                  {formatTime(payload.endTime)}
                </p>

                {payload.description && (
                  <p className={styles.EventDescription}>{payload.description}</p>
                )}
                {payload.location && (
                  <p className={styles.EventLocation}>Location: {payload.location}</p>
                )}
                {payload.imageUrl && (
                  <div className={styles.EventImageWrapper}>
                    <img
                      src={payload.imageUrl}
                      alt={payload.location}
                      className={styles.EventImage}
                    />
                  </div>
                )}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        );
      }}
    </Popover.Root>
  );
}

// Convert time as number (e.g. 13.5) to string (e.g. "13:30")
function formatTime(hour: number) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}
