import { useCallback } from 'react';

export interface BooleanCellProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  readOnly?: boolean;
}

export function BooleanCell({ value, onChange, readOnly }: BooleanCellProps) {
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
        justifyContent: 'center',
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
