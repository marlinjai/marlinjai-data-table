import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { TextAlignment } from '@marlinjai/data-table-core';

export interface ColumnHeaderMenuProps {
  columnId: string;
  currentAlignment: TextAlignment;
  position: { x: number; y: number };
  onAlignmentChange: (alignment: TextAlignment) => void;
  onClose: () => void;
}

const ALIGNMENT_OPTIONS: { value: TextAlignment; label: string; icon: string }[] = [
  { value: 'left', label: 'Align left', icon: '⫷' },
  { value: 'center', label: 'Align center', icon: '⫿' },
  { value: 'right', label: 'Align right', icon: '⫸' },
];

export function ColumnHeaderMenu({
  currentAlignment,
  position,
  onAlignmentChange,
  onClose,
}: ColumnHeaderMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 9999,
        minWidth: '160px',
        backgroundColor: 'var(--dt-bg-primary)',
        border: '1px solid var(--dt-border-color)',
        borderRadius: '6px',
        boxShadow: 'var(--dt-shadow-md)',
        padding: '4px 0',
      }}
    >
      {ALIGNMENT_OPTIONS.map((option) => {
        const isSelected = currentAlignment === option.value;
        return (
          <div
            key={option.value}
            onClick={() => onAlignmentChange(option.value)}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: 'var(--dt-text-primary)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '16px', textAlign: 'center' }}>{option.icon}</span>
              <span>{option.label}</span>
            </div>
            {isSelected && (
              <span style={{ color: 'var(--dt-accent-primary)' }}>✓</span>
            )}
          </div>
        );
      })}
    </div>,
    document.body
  );
}
