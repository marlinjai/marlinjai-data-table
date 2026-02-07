import { useEffect, useRef, useCallback } from 'react';

export type BoardColumnSortOrder = 'manual' | 'alphabetical' | 'date';

export interface BoardColumnMenuProps {
  groupValue: string | null;
  cardCount: number;
  isCollapsed: boolean;
  sortOrder: BoardColumnSortOrder;
  position: { x: number; y: number };
  onSort: (order: BoardColumnSortOrder) => void;
  onCollapse: () => void;
  onHide: () => void;
  onClose: () => void;
}

export function BoardColumnMenu({
  groupValue,
  cardCount,
  isCollapsed,
  sortOrder,
  position,
  onSort,
  onCollapse,
  onHide,
  onClose,
}: BoardColumnMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const sortSubmenuRef = useRef<HTMLDivElement>(null);

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

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSort = useCallback(
    (order: BoardColumnSortOrder) => {
      onSort(order);
      onClose();
    },
    [onSort, onClose]
  );

  const handleCollapse = useCallback(() => {
    onCollapse();
    onClose();
  }, [onCollapse, onClose]);

  const handleHide = useCallback(() => {
    onHide();
    onClose();
  }, [onHide, onClose]);

  // Calculate menu position to stay within viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: position.y,
    left: position.x,
    zIndex: 1001,
    minWidth: '180px',
    backgroundColor: 'var(--dt-bg-primary)',
    border: '1px solid var(--dt-border-color)',
    borderRadius: '8px',
    boxShadow: 'var(--dt-shadow-lg)',
    padding: '4px 0',
  };

  const menuItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    fontSize: '13px',
    color: 'var(--dt-text-primary)',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    width: '100%',
    textAlign: 'left',
  };

  const separatorStyle: React.CSSProperties = {
    height: '1px',
    backgroundColor: 'var(--dt-border-color)',
    margin: '4px 0',
  };

  const sortSubmenuStyle: React.CSSProperties = {
    position: 'absolute',
    left: '100%',
    top: 0,
    marginLeft: '4px',
    minWidth: '140px',
    backgroundColor: 'var(--dt-bg-primary)',
    border: '1px solid var(--dt-border-color)',
    borderRadius: '8px',
    boxShadow: 'var(--dt-shadow-lg)',
    padding: '4px 0',
  };

  return (
    <div ref={menuRef} style={menuStyle}>
      {/* Sort option with submenu */}
      <div style={{ position: 'relative' }}>
        <button
          style={menuItemStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
            if (sortSubmenuRef.current) {
              sortSubmenuRef.current.style.display = 'block';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            // Delay hiding to allow mouse to move to submenu
            setTimeout(() => {
              if (sortSubmenuRef.current && !sortSubmenuRef.current.matches(':hover')) {
                sortSubmenuRef.current.style.display = 'none';
              }
            }, 100);
          }}
        >
          <span>Sort</span>
          <span style={{ fontSize: '10px', color: 'var(--dt-text-muted)' }}>&#9656;</span>
        </button>

        {/* Sort submenu */}
        <div
          ref={sortSubmenuRef}
          style={{ ...sortSubmenuStyle, display: 'none' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.display = 'block';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        >
          <button
            style={menuItemStyle}
            onClick={() => handleSort('manual')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>Manual</span>
            {sortOrder === 'manual' && (
              <span style={{ color: 'var(--dt-accent-primary)' }}>&#10003;</span>
            )}
          </button>
          <button
            style={menuItemStyle}
            onClick={() => handleSort('alphabetical')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>Alphabetical</span>
            {sortOrder === 'alphabetical' && (
              <span style={{ color: 'var(--dt-accent-primary)' }}>&#10003;</span>
            )}
          </button>
          <button
            style={menuItemStyle}
            onClick={() => handleSort('date')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>By date</span>
            {sortOrder === 'date' && (
              <span style={{ color: 'var(--dt-accent-primary)' }}>&#10003;</span>
            )}
          </button>
        </div>
      </div>

      <div style={separatorStyle} />

      {/* Collapse column */}
      <button
        style={menuItemStyle}
        onClick={handleCollapse}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span>{isCollapsed ? 'Expand column' : 'Collapse column'}</span>
      </button>

      {/* Hide column */}
      <button
        style={menuItemStyle}
        onClick={handleHide}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span>Hide column</span>
      </button>

      {/* Column info footer */}
      <div style={separatorStyle} />
      <div
        style={{
          padding: '8px 12px',
          fontSize: '11px',
          color: 'var(--dt-text-muted)',
        }}
      >
        {cardCount} {cardCount === 1 ? 'card' : 'cards'}
      </div>
    </div>
  );
}
