import { useState, useRef, useEffect, useCallback } from 'react';
import type { View, ViewType } from '@marlinjai/data-table-core';

export interface ViewSwitcherProps {
  views: View[];
  currentViewId: string | null;
  onViewChange: (viewId: string) => void;
  onCreateView: (type: ViewType) => void;
  onDeleteView: (viewId: string) => void;
  onRenameView: (viewId: string, name: string) => void;
}

const VIEW_TYPE_ICONS: Record<ViewType, string> = {
  table: '=',
  board: '|||',
  calendar: 'Cal',
  gallery: '::',
  timeline: '--',
  list: '-',
};

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
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: isActive ? 'var(--dt-accent-primary)' : 'var(--dt-text-muted)',
                }}
              >
                {VIEW_TYPE_ICONS[view.type]}
              </span>
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
                  padding: '2px 4px',
                  cursor: 'pointer',
                  opacity: 0.5,
                  fontSize: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.5';
                }}
              >
                v
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
                <span
                  style={{
                    width: '20px',
                    textAlign: 'center',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--dt-text-muted)',
                  }}
                >
                  {VIEW_TYPE_ICONS[type]}
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
