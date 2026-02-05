import { useCallback, useMemo } from 'react';
import type { Row } from '@marlinjai/data-table-core';

export interface CalendarEvent {
  row: Row;
  title: string;
  startDate: Date;
  endDate?: Date;
  isMultiDay?: boolean;
  dayIndex?: number; // Which day of a multi-day event this represents
  totalDays?: number; // Total days for multi-day events
}

export interface CalendarDayProps {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onDayClick: (date: Date) => void;
  onEventClick: (row: Row) => void;
  maxEventsToShow?: number;
}

function getEventStyle(event: CalendarEvent): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    padding: '2px 6px',
    marginBottom: '2px',
    borderRadius: '3px',
    fontSize: '11px',
    color: 'white',
    backgroundColor: 'var(--dt-accent-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  };

  // If it's a multi-day event, adjust styling based on position
  if (event.isMultiDay && event.dayIndex !== undefined && event.totalDays !== undefined) {
    if (event.dayIndex === 0) {
      // First day: rounded left, flat right
      baseStyle.borderTopRightRadius = '0';
      baseStyle.borderBottomRightRadius = '0';
      baseStyle.marginRight = '-2px';
    } else if (event.dayIndex === event.totalDays - 1) {
      // Last day: flat left, rounded right
      baseStyle.borderTopLeftRadius = '0';
      baseStyle.borderBottomLeftRadius = '0';
      baseStyle.marginLeft = '-2px';
    } else {
      // Middle days: flat both sides
      baseStyle.borderRadius = '0';
      baseStyle.marginLeft = '-2px';
      baseStyle.marginRight = '-2px';
    }
  }

  return baseStyle;
}

export function CalendarDay({
  date,
  events,
  isCurrentMonth,
  isToday,
  isSelected,
  onDayClick,
  onEventClick,
  maxEventsToShow = 3,
}: CalendarDayProps) {
  const dayNumber = date.getDate();

  const handleDayClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDayClick(date);
    },
    [date, onDayClick]
  );

  const handleEventClick = useCallback(
    (e: React.MouseEvent, row: Row) => {
      e.stopPropagation();
      onEventClick(row);
    },
    [onEventClick]
  );

  const visibleEvents = useMemo(() => {
    return events.slice(0, maxEventsToShow);
  }, [events, maxEventsToShow]);

  const hiddenCount = events.length - maxEventsToShow;

  return (
    <div
      onClick={handleDayClick}
      style={{
        minHeight: '100px',
        padding: '4px',
        borderRight: '1px solid var(--dt-border-color)',
        borderBottom: '1px solid var(--dt-border-color)',
        backgroundColor: isSelected ? 'var(--dt-bg-selected)' : isCurrentMonth ? 'var(--dt-bg-primary)' : 'var(--dt-bg-secondary)',
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = isCurrentMonth ? 'var(--dt-bg-primary)' : 'var(--dt-bg-secondary)';
        }
      }}
    >
      {/* Day number */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '4px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: isToday ? '24px' : 'auto',
            height: isToday ? '24px' : 'auto',
            borderRadius: isToday ? '50%' : '0',
            backgroundColor: isToday ? 'var(--dt-accent-primary)' : 'transparent',
            color: isToday ? 'white' : isCurrentMonth ? 'var(--dt-text-primary)' : 'var(--dt-text-muted)',
            fontSize: '12px',
            fontWeight: isToday ? 600 : 400,
          }}
        >
          {dayNumber}
        </span>
      </div>

      {/* Events */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {visibleEvents.map((event, index) => (
          <div
            key={`${event.row.id}-${index}`}
            onClick={(e) => handleEventClick(e, event.row)}
            style={getEventStyle(event)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--dt-accent-primary-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--dt-accent-primary)';
            }}
            title={event.title}
          >
            {/* Only show title on first day of multi-day event or single day events */}
            {(!event.isMultiDay || event.dayIndex === 0) && event.title}
          </div>
        ))}

        {/* More events indicator */}
        {hiddenCount > 0 && (
          <div
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              color: 'var(--dt-text-secondary)',
              fontWeight: 500,
            }}
          >
            +{hiddenCount} more
          </div>
        )}
      </div>
    </div>
  );
}
