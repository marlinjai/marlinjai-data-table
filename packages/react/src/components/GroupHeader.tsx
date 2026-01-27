import React from 'react';

export interface GroupHeaderProps {
  /** The display label for the group */
  label: string;
  /** Number of rows in this group */
  rowCount: number;
  /** Whether the group is collapsed */
  isCollapsed: boolean;
  /** Callback when collapse state is toggled */
  onToggleCollapse: () => void;
  /** Number of columns to span (including selection, delete, add property columns) */
  colSpan: number;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * GroupHeader renders a collapsible header row for grouped table data.
 * Displays group label, row count, and an expand/collapse chevron.
 */
export function GroupHeader({
  label,
  rowCount,
  isCollapsed,
  onToggleCollapse,
  colSpan,
  className,
}: GroupHeaderProps) {
  return (
    <tr
      className={`dt-group-header ${className ?? ''}`}
      style={{
        backgroundColor: 'var(--dt-bg-tertiary)',
      }}
    >
      <td
        colSpan={colSpan}
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--dt-border-color)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={onToggleCollapse}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {/* Expand/Collapse chevron */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              fontSize: '12px',
              color: 'var(--dt-text-secondary)',
              transition: 'transform 0.15s ease',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          >
            <ChevronIcon />
          </span>

          {/* Group label */}
          <span
            style={{
              fontWeight: 600,
              color: 'var(--dt-text-primary)',
              fontSize: '14px',
            }}
          >
            {label}
          </span>

          {/* Row count badge */}
          <span
            style={{
              fontSize: '12px',
              color: 'var(--dt-text-secondary)',
              backgroundColor: 'var(--dt-border-color)',
              padding: '2px 8px',
              borderRadius: '10px',
            }}
          >
            {rowCount}
          </span>
        </div>
      </td>
    </tr>
  );
}

/**
 * Simple chevron down icon component
 */
function ChevronIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
