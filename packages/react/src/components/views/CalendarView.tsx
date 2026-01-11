import { useState, useCallback, useMemo } from 'react';
import type { Row, Column, CalendarViewConfig } from '@marlinjai/data-table-core';
import { CalendarDay, type CalendarEvent } from './CalendarDay';

export interface CalendarViewProps {
  rows: Row[];
  columns: Column[];
  config: CalendarViewConfig;

  // Callbacks
  onRowClick?: (row: Row) => void;
  onDayClick?: (date: Date, events: CalendarEvent[]) => void;
  onDateChange?: (date: Date) => void;

  // Loading state
  isLoading?: boolean;

  // Styling
  className?: string;
  style?: React.CSSProperties;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Utility functions for date manipulation
function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getStartOfWeek(date: Date): Date {
  const day = date.getDay();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
}

function getEndOfWeek(date: Date): Date {
  const day = date.getDay();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + (6 - day));
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function getDaysDifference(start: Date, end: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function getPrimaryColumnValue(row: Row, columns: Column[]): string {
  const primaryColumn = columns.find((col) => col.isPrimary);
  if (primaryColumn) {
    const value = row.cells[primaryColumn.id];
    if (value !== null && value !== undefined) {
      return String(value);
    }
  }
  // Fallback: use the first column or row id
  const firstColumn = columns[0];
  if (firstColumn) {
    const value = row.cells[firstColumn.id];
    if (value !== null && value !== undefined) {
      return String(value);
    }
  }
  return `Row ${row.id}`;
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function CalendarView({
  rows,
  columns,
  config,
  onRowClick,
  onDayClick,
  onDateChange,
  isLoading,
  className,
  style,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const today = useMemo(() => new Date(), []);

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const startOfMonth = getStartOfMonth(currentDate);
    const endOfMonth = getEndOfMonth(currentDate);
    const startOfCalendar = getStartOfWeek(startOfMonth);
    const endOfCalendar = getEndOfWeek(endOfMonth);

    const days: Date[] = [];
    let current = new Date(startOfCalendar);

    while (current <= endOfCalendar) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }

    return days;
  }, [currentDate]);

  // Build events map from rows
  const eventsMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    if (!config.dateColumnId) return map;

    rows.forEach((row) => {
      const startDateValue = parseDateValue(row.cells[config.dateColumnId]);
      if (!startDateValue) return;

      const endDateValue = config.endDateColumnId
        ? parseDateValue(row.cells[config.endDateColumnId])
        : null;

      const title = getPrimaryColumnValue(row, columns);

      if (endDateValue && endDateValue > startDateValue) {
        // Multi-day event
        const totalDays = getDaysDifference(startDateValue, endDateValue) + 1;

        for (let i = 0; i < totalDays; i++) {
          const eventDate = addDays(startDateValue, i);
          const dateKey = `${eventDate.getFullYear()}-${eventDate.getMonth()}-${eventDate.getDate()}`;

          const event: CalendarEvent = {
            row,
            title,
            startDate: startDateValue,
            endDate: endDateValue,
            isMultiDay: true,
            dayIndex: i,
            totalDays,
          };

          if (!map.has(dateKey)) {
            map.set(dateKey, []);
          }
          map.get(dateKey)!.push(event);
        }
      } else {
        // Single day event
        const dateKey = `${startDateValue.getFullYear()}-${startDateValue.getMonth()}-${startDateValue.getDate()}`;

        const event: CalendarEvent = {
          row,
          title,
          startDate: startDateValue,
          endDate: endDateValue ?? undefined,
          isMultiDay: false,
        };

        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(event);
      }
    });

    return map;
  }, [rows, columns, config.dateColumnId, config.endDateColumnId]);

  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return eventsMap.get(dateKey) ?? [];
  }, [eventsMap]);

  const handlePrevMonth = useCallback(() => {
    const newDate = addMonths(currentDate, -1);
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  }, [currentDate, onDateChange]);

  const handleNextMonth = useCallback(() => {
    const newDate = addMonths(currentDate, 1);
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  }, [currentDate, onDateChange]);

  const handleToday = useCallback(() => {
    const newDate = new Date();
    setCurrentDate(newDate);
    setSelectedDate(newDate);
    onDateChange?.(newDate);
  }, [onDateChange]);

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
    const events = getEventsForDate(date);
    onDayClick?.(date, events);
  }, [getEventsForDate, onDayClick]);

  const handleEventClick = useCallback((row: Row) => {
    onRowClick?.(row);
  }, [onRowClick]);

  // Check if date column is configured
  if (!config.dateColumnId) {
    return (
      <div
        className={`dt-calendar-view ${className ?? ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
          color: '#6b7280',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          ...style,
        }}
      >
        <div style={{ fontSize: '16px', marginBottom: '8px' }}>No date column configured</div>
        <div style={{ fontSize: '14px' }}>
          Please configure a date column in the calendar view settings.
        </div>
      </div>
    );
  }

  return (
    <div
      className={`dt-calendar-view ${className ?? ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Header with navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {/* Navigation buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handlePrevMonth}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#374151',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            &lt;
          </button>
          <button
            onClick={handleNextMonth}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#374151',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            &gt;
          </button>
          <button
            onClick={handleToday}
            style={{
              padding: '6px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#374151',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            Today
          </button>
        </div>

        {/* Current month/year */}
        <div
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#111827',
          }}
        >
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </div>

        {/* Placeholder for potential future controls (view switcher, etc.) */}
        <div style={{ width: '120px' }} />
      </div>

      {/* Days of week header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            style={{
              padding: '8px',
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px',
            color: '#9ca3af',
          }}
        >
          Loading...
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            backgroundColor: 'white',
          }}
        >
          {calendarDays.map((date, index) => {
            const events = getEventsForDate(date);
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const isToday = isSameDay(date, today);
            const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;

            return (
              <CalendarDay
                key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                date={date}
                events={events}
                isCurrentMonth={isCurrentMonth}
                isToday={isToday}
                isSelected={isSelected}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
                maxEventsToShow={3}
              />
            );
          })}
        </div>
      )}

      {/* Footer with event count */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          backgroundColor: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          fontSize: '13px',
          color: '#6b7280',
        }}
      >
        <span>
          {rows.length} {rows.length === 1 ? 'event' : 'events'} total
        </span>
        {selectedDate && (
          <span>
            Selected: {MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
          </span>
        )}
      </div>
    </div>
  );
}
