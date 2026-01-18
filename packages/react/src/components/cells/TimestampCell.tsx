import React from 'react';
import type { Column, CreatedTimeColumnConfig, LastEditedTimeColumnConfig } from '@marlinjai/data-table-core';

export interface TimestampCellProps {
  column: Column;
  value: Date | string | null | undefined;
}

function formatTimestamp(
  value: Date | string | null | undefined,
  config?: CreatedTimeColumnConfig | LastEditedTimeColumnConfig
): string {
  if (value === null || value === undefined) {
    return '-';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (isNaN(date.getTime())) {
    return '-';
  }

  const includeTime = config?.includeTime ?? true;

  // Simple date formatting
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (!includeTime) {
    return `${year}-${month}-${day}`;
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function TimestampCell({ column, value }: TimestampCellProps) {
  const config = column.config as CreatedTimeColumnConfig | LastEditedTimeColumnConfig | undefined;
  const formattedValue = formatTimestamp(value, config);
  const isCreatedTime = column.type === 'created_time';

  return (
    <div
      style={{
        padding: '6px 8px',
        color: '#6b7280',
        fontSize: '13px',
        fontFamily: 'monospace',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
      title={`${isCreatedTime ? 'Created' : 'Last edited'}: ${formattedValue}`}
    >
      <span
        style={{
          fontSize: '12px',
          opacity: 0.7,
        }}
      >
        {isCreatedTime ? '📅' : '✏️'}
      </span>
      <span>{formattedValue}</span>
    </div>
  );
}
