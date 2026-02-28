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
  /** Number of columns to span (used only in table-row mode) */
  colSpan: number;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * GroupHeader renders a collapsible header for a group.
 * Renders as a standalone div that floats above the group's table.
 */
export function GroupHeader({
  label,
  rowCount,
  isCollapsed,
  onToggleCollapse,
  className,
}: GroupHeaderProps) {
  return (
    <div
      className={`dt-group-header ${className ?? ''}`}
      onClick={onToggleCollapse}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 4px',
        cursor: 'pointer',
        userSelect: 'none',
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
        className="dt-group-label"
        style={{
          fontWeight: 600,
          color: 'var(--dt-text-primary)',
          fontSize: 'var(--dt-font-size, 13.5px)',
          letterSpacing: 'var(--dt-letter-spacing, -0.01em)',
          padding: '2px 10px',
          borderRadius: '4px',
          background: 'var(--dt-bg-tertiary)',
        }}
      >
        {label}
      </span>

      {/* Row count */}
      <span
        style={{
          fontSize: 'var(--dt-font-size-xs, 11px)',
          color: 'var(--dt-text-muted)',
          fontWeight: 500,
        }}
      >
        {rowCount}
      </span>
    </div>
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
