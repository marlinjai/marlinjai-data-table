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
    >
      <td
        colSpan={colSpan}
        style={{
          padding: '0',
          border: 'none',
          background: 'transparent',
        }}
      >
        <div
          className="dt-group-header-bar"
          onClick={onToggleCollapse}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            cursor: 'pointer',
            userSelect: 'none',
            marginTop: '16px',
            marginBottom: '4px',
            borderRadius: 'var(--dt-border-radius-sm, 6px)',
            background: 'var(--dt-glass-bg-subtle, rgba(255, 255, 255, 0.5))',
            border: '1px solid var(--dt-glass-border, rgba(255, 255, 255, 0.12))',
            boxShadow: 'var(--dt-glass-inner-shadow, inset 0 1px 0 0 rgba(255, 255, 255, 0.06)), 0 2px 8px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.15s ease',
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
              fontSize: 'var(--dt-font-size, 13.5px)',
              letterSpacing: 'var(--dt-letter-spacing, -0.01em)',
            }}
          >
            {label}
          </span>

          {/* Row count badge */}
          <span
            style={{
              fontSize: 'var(--dt-font-size-xs, 11px)',
              color: 'var(--dt-text-muted)',
              backgroundColor: 'var(--dt-bg-tertiary, rgba(64, 64, 64, 0.45))',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: 500,
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
