import { useCallback } from 'react';
import type { TextAlignment } from '@marlinjai/data-table-core';

export interface BooleanCellProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  readOnly?: boolean;
  alignment?: TextAlignment;
}

// Convert text alignment to flexbox justify-content
function alignmentToJustify(alignment: TextAlignment): 'flex-start' | 'center' | 'flex-end' {
  switch (alignment) {
    case 'left': return 'flex-start';
    case 'center': return 'center';
    case 'right': return 'flex-end';
  }
}

export function BooleanCell({ value, onChange, readOnly, alignment = 'center' }: BooleanCellProps) {
  const handleChange = useCallback(() => {
    if (!readOnly) {
      onChange(!value);
    }
  }, [readOnly, value, onChange]);

  return (
    <div
      className="dt-cell-boolean"
      style={{
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: alignmentToJustify(alignment),
        minHeight: '24px',
      }}
    >
      <input
        type="checkbox"
        checked={value ?? false}
        onChange={handleChange}
        disabled={readOnly}
        style={{
          width: '16px',
          height: '16px',
          cursor: readOnly ? 'default' : 'pointer',
          accentColor: '#2563eb',
        }}
      />
    </div>
  );
}
