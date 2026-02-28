import { useState, useRef, useEffect, useCallback, createElement } from 'react';
import type { View, ViewType } from '@marlinjai/data-table-core';

export interface ViewSwitcherProps {
  views: View[];
  currentViewId: string | null;
  onViewChange: (viewId: string) => void;
  onCreateView: (type: ViewType) => void;
  onDeleteView: (viewId: string) => void;
  onRenameView: (viewId: string, name: string) => void;
}

function ViewIcon({ type, size = 14, color }: { type: ViewType; size?: number; color: string }) {
  const props = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (type) {
    case 'table':
      return createElement('svg', props,
        createElement('rect', { x: 1.5, y: 2.5, width: 13, height: 11, rx: 1.5 }),
        createElement('line', { x1: 1.5, y1: 6, x2: 14.5, y2: 6 }),
        createElement('line', { x1: 1.5, y1: 9.5, x2: 14.5, y2: 9.5 }),
        createElement('line', { x1: 5.5, y1: 6, x2: 5.5, y2: 13.5 }),
      );
    case 'board':
      return createElement('svg', props,
        createElement('rect', { x: 1.5, y: 2, width: 3.5, height: 12, rx: 1 }),
        createElement('rect', { x: 6.25, y: 2, width: 3.5, height: 8, rx: 1 }),
        createElement('rect', { x: 11, y: 2, width: 3.5, height: 10, rx: 1 }),
      );
    case 'calendar':
      return createElement('svg', props,
        createElement('rect', { x: 1.5, y: 3, width: 13, height: 11, rx: 1.5 }),
        createElement('line', { x1: 1.5, y1: 6.5, x2: 14.5, y2: 6.5 }),
        createElement('line', { x1: 4.5, y1: 1.5, x2: 4.5, y2: 4.5 }),
        createElement('line', { x1: 11.5, y1: 1.5, x2: 11.5, y2: 4.5 }),
        createElement('circle', { cx: 5, cy: 9.5, r: 0.6, fill: color, stroke: 'none' }),
        createElement('circle', { cx: 8, cy: 9.5, r: 0.6, fill: color, stroke: 'none' }),
        createElement('circle', { cx: 11, cy: 9.5, r: 0.6, fill: color, stroke: 'none' }),
        createElement('circle', { cx: 5, cy: 12, r: 0.6, fill: color, stroke: 'none' }),
        createElement('circle', { cx: 8, cy: 12, r: 0.6, fill: color, stroke: 'none' }),
      );
    case 'gallery':
      return createElement('svg', props,
        createElement('rect', { x: 1.5, y: 1.5, width: 5.5, height: 5.5, rx: 1.5 }),
        createElement('rect', { x: 9, y: 1.5, width: 5.5, height: 5.5, rx: 1.5 }),
        createElement('rect', { x: 1.5, y: 9, width: 5.5, height: 5.5, rx: 1.5 }),
        createElement('rect', { x: 9, y: 9, width: 5.5, height: 5.5, rx: 1.5 }),
      );
    case 'timeline':
      return createElement('svg', props,
        createElement('line', { x1: 1.5, y1: 4, x2: 14.5, y2: 4 }),
        createElement('line', { x1: 1.5, y1: 8, x2: 14.5, y2: 8 }),
        createElement('line', { x1: 1.5, y1: 12, x2: 14.5, y2: 12 }),
        createElement('rect', { x: 3, y: 2.5, width: 5, height: 3, rx: 1, fill: color, opacity: 0.3 }),
        createElement('rect', { x: 6, y: 6.5, width: 6, height: 3, rx: 1, fill: color, opacity: 0.3 }),
        createElement('rect', { x: 2, y: 10.5, width: 4, height: 3, rx: 1, fill: color, opacity: 0.3 }),
      );
    case 'list':
      return createElement('svg', props,
        createElement('line', { x1: 5, y1: 3.5, x2: 14, y2: 3.5 }),
        createElement('line', { x1: 5, y1: 7, x2: 14, y2: 7 }),
        createElement('line', { x1: 5, y1: 10.5, x2: 14, y2: 10.5 }),
        createElement('circle', { cx: 2.5, cy: 3.5, r: 1, fill: color, stroke: 'none' }),
        createElement('circle', { cx: 2.5, cy: 7, r: 1, fill: color, stroke: 'none' }),
        createElement('circle', { cx: 2.5, cy: 10.5, r: 1, fill: color, stroke: 'none' }),
      );
    default:
      return null;
  }
}

const VIEW_TYPE_LABELS: Record<ViewType, string> = {
  table: 'Table',
  board: 'Board',
  calendar: 'Calendar',
  gallery: 'Gallery',
  timeline: 'Timeline',
  list: 'List',
};

const VIEW_TYPES: ViewType[] = ['table', 'board', 'calendar', 'gallery', 'timeline', 'list'];

export function ViewSwitcher({
  views,
  currentViewId,
  onViewChange,
  onCreateView,
  onDeleteView,
  onRenameView,
}: ViewSwitcherProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const addMenuRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
      if (activeDropdown) {
        const dropdownEl = dropdownRefs.current.get(activeDropdown);
        if (dropdownEl && !dropdownEl.contains(event.target as Node)) {
          setActiveDropdown(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

  // Focus input when editing
  useEffect(() => {
    if (editingViewId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingViewId]);

  const handleTabClick = useCallback(
    (viewId: string) => {
      if (editingViewId !== viewId) {
        onViewChange(viewId);
      }
    },
    [editingViewId, onViewChange]
  );

  const handleDropdownToggle = useCallback(
    (e: React.MouseEvent, viewId: string) => {
      e.stopPropagation();
      setActiveDropdown(activeDropdown === viewId ? null : viewId);
    },
    [activeDropdown]
  );

  const handleRenameStart = useCallback((e: React.MouseEvent, view: View) => {
    e.stopPropagation();
    setEditingViewId(view.id);
    setEditingName(view.name);
    setActiveDropdown(null);
  }, []);

  const handleRenameSubmit = useCallback(
    (viewId: string) => {
      if (editingName.trim()) {
        onRenameView(viewId, editingName.trim());
      }
      setEditingViewId(null);
      setEditingName('');
    },
    [editingName, onRenameView]
  );

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent, viewId: string) => {
      if (e.key === 'Enter') {
        handleRenameSubmit(viewId);
      } else if (e.key === 'Escape') {
        setEditingViewId(null);
        setEditingName('');
      }
    },
    [handleRenameSubmit]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, viewId: string) => {
      e.stopPropagation();
      setActiveDropdown(null);
      onDeleteView(viewId);
    },
    [onDeleteView]
  );

  const handleAddView = useCallback(
    (type: ViewType) => {
      setShowAddMenu(false);
      onCreateView(type);
    },
    [onCreateView]
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '8px 12px',
        borderBottom: '1px solid var(--dt-border-color)',
        backgroundColor: 'var(--dt-bg-secondary)',
        position: 'relative',
        zIndex: 10,
        minHeight: '44px',
      }}
    >
      {/* View Tabs */}
      {views.map((view) => {
        const isActive = view.id === currentViewId;
        const isEditing = editingViewId === view.id;

        return (
          <div
            key={view.id}
            ref={(el) => {
              if (el) dropdownRefs.current.set(view.id, el);
            }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <button
              onClick={() => handleTabClick(view.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: isActive ? 'var(--dt-bg-primary)' : 'transparent',
                boxShadow: isActive ? 'var(--dt-shadow-sm)' : 'none',
                cursor: 'pointer',
                fontSize: '13px',
                color: isActive ? 'var(--dt-text-primary)' : 'var(--dt-text-secondary)',
                fontWeight: isActive ? 500 : 400,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <ViewIcon
                type={view.type}
                size={14}
                color={isActive ? 'var(--dt-accent-primary)' : 'var(--dt-text-muted)'}
              />
              {isEditing ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRenameSubmit(view.id)}
                  onKeyDown={(e) => handleRenameKeyDown(e, view.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '80px',
                    padding: '2px 4px',
                    border: '1px solid var(--dt-accent-primary)',
                    borderRadius: '2px',
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: 'var(--dt-bg-primary)',
                    color: 'var(--dt-text-primary)',
                  }}
                />
              ) : (
                <span>{view.name}</span>
              )}
              {/* Dropdown trigger */}
              <span
                onClick={(e) => handleDropdownToggle(e, view.id)}
                style={{
                  padding: '2px 2px',
                  cursor: 'pointer',
                  opacity: 0.4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.4';
                }}
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 6 8 10 12 6" />
                </svg>
              </span>
            </button>

            {/* Dropdown Menu */}
            {activeDropdown === view.id && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: 'var(--dt-bg-primary)',
                  border: '1px solid var(--dt-border-color)',
                  borderRadius: '6px',
                  boxShadow: 'var(--dt-shadow-md)',
                  zIndex: 100,
                  minWidth: '140px',
                  padding: '4px 0',
                }}
              >
                <button
                  onClick={(e) => handleRenameStart(e, view)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--dt-text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Rename
                </button>
                {views.length > 1 && (
                  <button
                    onClick={(e) => handleDelete(e, view.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: 'var(--dt-accent-danger)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add View Button */}
      <div ref={addMenuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontSize: '16px',
            color: 'var(--dt-text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          +
        </button>

        {/* Add View Menu */}
        {showAddMenu && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              backgroundColor: 'var(--dt-bg-primary)',
              border: '1px solid var(--dt-border-color)',
              borderRadius: '6px',
              boxShadow: 'var(--dt-shadow-md)',
              zIndex: 100,
              minWidth: '160px',
              padding: '4px 0',
            }}
          >
            {VIEW_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => handleAddView(type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--dt-text-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ViewIcon type={type} size={14} color="var(--dt-text-muted)" />
                </span>
                <span>{VIEW_TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
