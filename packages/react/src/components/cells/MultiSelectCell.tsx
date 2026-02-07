import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SelectOption, MultiSelectColumnConfig, TextAlignment } from '@marlinjai/data-table-core';

export interface MultiSelectCellProps {
  value: string[] | null;
  onChange: (value: string[]) => void;
  options: SelectOption[];
  config?: MultiSelectColumnConfig;
  readOnly?: boolean;
  alignment?: TextAlignment;
  onCreateOption?: (name: string, color?: string) => Promise<SelectOption>;
  onUpdateOption?: (optionId: string, updates: { name?: string; color?: string }) => Promise<SelectOption>;
  onDeleteOption?: (optionId: string) => Promise<void>;
}

// Convert text alignment to flexbox justify-content
function alignmentToJustify(alignment: TextAlignment): 'flex-start' | 'center' | 'flex-end' {
  switch (alignment) {
    case 'left': return 'flex-start';
    case 'center': return 'center';
    case 'right': return 'flex-end';
  }
}

const COLOR_OPTIONS = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown'];

function getColorStyles(color?: string): { bg: string; text: string } {
  const colorMap: Record<string, { bg: string; text: string }> = {
    gray: { bg: 'var(--dt-tag-gray-bg)', text: 'var(--dt-tag-gray-text)' },
    red: { bg: 'var(--dt-tag-red-bg)', text: 'var(--dt-tag-red-text)' },
    orange: { bg: 'var(--dt-tag-orange-bg)', text: 'var(--dt-tag-orange-text)' },
    yellow: { bg: 'var(--dt-tag-yellow-bg)', text: 'var(--dt-tag-yellow-text)' },
    green: { bg: 'var(--dt-tag-green-bg)', text: 'var(--dt-tag-green-text)' },
    blue: { bg: 'var(--dt-tag-blue-bg)', text: 'var(--dt-tag-blue-text)' },
    purple: { bg: 'var(--dt-tag-purple-bg)', text: 'var(--dt-tag-purple-text)' },
    pink: { bg: 'var(--dt-tag-pink-bg)', text: 'var(--dt-tag-pink-text)' },
    brown: { bg: 'var(--dt-tag-brown-bg)', text: 'var(--dt-tag-brown-text)' },
  };
  return colorMap[color ?? 'gray'] ?? colorMap.gray;
}

export function MultiSelectCell({
  value,
  onChange,
  options,
  config,
  readOnly,
  alignment = 'left',
  onCreateOption,
  onUpdateOption,
  onDeleteOption,
}: MultiSelectCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newOptionName, setNewOptionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingOption, setEditingOption] = useState<SelectOption | null>(null);
  const [editName, setEditName] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editPopoverRef = useRef<HTMLDivElement>(null);
  const selectedIds = value ?? [];
  const selectedOptions = options.filter((opt) => selectedIds.includes(opt.id));

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 2,
        left: rect.left,
      });
    }
  }, [isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target);
      const isOutsideDropdown = !dropdownRef.current || !dropdownRef.current.contains(target);
      const isOutsideEditPopover = !editPopoverRef.current || !editPopoverRef.current.contains(target);

      if (isOutsideContainer && isOutsideDropdown && isOutsideEditPopover) {
        setIsOpen(false);
        setEditingOption(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleClick = useCallback(() => {
    if (!readOnly) {
      setIsOpen((prev) => !prev);
      if (isOpen) {
        setEditingOption(null);
      }
    }
  }, [readOnly, isOpen]);

  const toggleOption = useCallback(
    (optionId: string) => {
      const newValue = selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId];

      // Check max selections
      if (
        config?.maxSelections &&
        newValue.length > config.maxSelections &&
        !selectedIds.includes(optionId)
      ) {
        return;
      }

      onChange(newValue);
    },
    [selectedIds, onChange, config]
  );

  const handleCreateOption = useCallback(async () => {
    if (!newOptionName.trim() || !onCreateOption || isCreating) return;

    // Check max selections before creating
    if (config?.maxSelections && selectedIds.length >= config.maxSelections) {
      return;
    }

    setIsCreating(true);
    try {
      const randomColor = COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)];
      const newOption = await onCreateOption(newOptionName.trim(), randomColor);
      onChange([...selectedIds, newOption.id]);
      setNewOptionName('');
    } finally {
      setIsCreating(false);
    }
  }, [newOptionName, onCreateOption, isCreating, selectedIds, onChange, config]);

  const handleEditClick = useCallback((e: React.MouseEvent, option: SelectOption) => {
    e.stopPropagation();
    setEditingOption(option);
    setEditName(option.name);
  }, []);

  const handleColorChange = useCallback(async (color: string) => {
    if (!editingOption || !onUpdateOption) return;
    await onUpdateOption(editingOption.id, { color });
    setEditingOption({ ...editingOption, color });
  }, [editingOption, onUpdateOption]);

  const handleNameSave = useCallback(async () => {
    if (!editingOption || !onUpdateOption || !editName.trim()) return;
    if (editName.trim() !== editingOption.name) {
      await onUpdateOption(editingOption.id, { name: editName.trim() });
    }
  }, [editingOption, onUpdateOption, editName]);

  const handleDeleteOption = useCallback(async () => {
    if (!editingOption || !onDeleteOption) return;
    await onDeleteOption(editingOption.id);
    // Remove from selection if selected
    if (selectedIds.includes(editingOption.id)) {
      onChange(selectedIds.filter((id) => id !== editingOption.id));
    }
    setEditingOption(null);
  }, [editingOption, onDeleteOption, selectedIds, onChange]);

  const removeTag = useCallback((e: React.MouseEvent, optionId: string) => {
    e.stopPropagation();
    onChange(selectedIds.filter((id) => id !== optionId));
  }, [selectedIds, onChange]);

  return (
    <div
      ref={containerRef}
      className="dt-cell-multi-select"
      style={{
        position: 'relative',
        padding: '4px 8px',
        minHeight: '24px',
      }}
    >
      <div
        onClick={handleClick}
        style={{
          cursor: readOnly ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: alignmentToJustify(alignment),
          flexWrap: 'wrap',
          gap: '4px',
        }}
      >
        {selectedOptions.length > 0 ? (
          selectedOptions.map((option) => {
            const colors = getColorStyles(option.color);
            return (
              <span
                key={option.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  backgroundColor: colors.bg,
                  color: colors.text,
                }}
              >
                {option.name}
                {!readOnly && (
                  <button
                    onClick={(e) => removeTag(e, option.id)}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: '0 2px',
                      cursor: 'pointer',
                      color: colors.text,
                      opacity: 0.7,
                      fontSize: '12px',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })
        ) : (
          <span style={{ color: 'var(--dt-text-muted)' }}>Select...</span>
        )}
      </div>

      {/* Main dropdown - rendered via portal */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 9999,
            minWidth: '220px',
            maxHeight: '300px',
            overflowY: 'auto',
            backgroundColor: 'var(--dt-bg-primary)',
            border: '1px solid var(--dt-border-color)',
            borderRadius: '6px',
            boxShadow: 'var(--dt-shadow-md)',
          }}
        >
          {/* Search/Create input */}
          {onCreateOption && (
            <div style={{ padding: '8px', borderBottom: '1px solid var(--dt-border-color)' }}>
              <input
                type="text"
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateOption();
                  }
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="Search or create option..."
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid var(--dt-border-color-strong)',
                  borderRadius: '4px',
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: 'var(--dt-bg-primary)',
                  color: 'var(--dt-text-primary)',
                }}
              />
            </div>
          )}

          {/* Options list */}
          {options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            const colors = getColorStyles(option.color);
            const isEditing = editingOption?.id === option.id;
            return (
              <div
                key={option.id}
                onClick={() => toggleOption(option.id)}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: isEditing ? 'var(--dt-bg-hover)' : isSelected ? 'var(--dt-bg-secondary)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)';
                  const btn = e.currentTarget.querySelector('.edit-btn') as HTMLElement;
                  if (btn) btn.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  if (!isEditing) {
                    e.currentTarget.style.backgroundColor = isSelected ? 'var(--dt-bg-secondary)' : 'transparent';
                  }
                  const btn = e.currentTarget.querySelector('.edit-btn') as HTMLElement;
                  if (btn && !isEditing) btn.style.opacity = '0';
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  style={{ pointerEvents: 'none' }}
                />
                <span
                  style={{
                    flex: 1,
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    backgroundColor: colors.bg,
                    color: colors.text,
                  }}
                >
                  {option.name}
                </span>
                {(onUpdateOption || onDeleteOption) && (
                  <button
                    className="edit-btn"
                    onClick={(e) => handleEditClick(e, option)}
                    style={{
                      padding: '2px 6px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      opacity: isEditing ? '1' : '0',
                      color: 'var(--dt-text-secondary)',
                      fontSize: '14px',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    •••
                  </button>
                )}
              </div>
            );
          })}

          {/* Create new option hint */}
          {newOptionName.trim() && onCreateOption && !options.some(o => o.name.toLowerCase() === newOptionName.toLowerCase()) && (
            <div
              onClick={handleCreateOption}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderTop: '1px solid var(--dt-border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--dt-accent-primary)',
                fontSize: '13px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span>+</span>
              <span>Create "{newOptionName}"</span>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Edit popover (second layer) - also via portal */}
      {editingOption && createPortal(
        <div
          ref={editPopoverRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left + 230,
            zIndex: 10000,
            width: '200px',
            backgroundColor: 'var(--dt-bg-primary)',
            border: '1px solid var(--dt-border-color)',
            borderRadius: '6px',
            boxShadow: 'var(--dt-shadow-md)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Option name input */}
          <div style={{ padding: '8px', borderBottom: '1px solid var(--dt-border-color)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 8px',
                backgroundColor: getColorStyles(editingOption.color).bg,
                borderRadius: '4px',
              }}
            >
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleNameSave();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  color: getColorStyles(editingOption.color).text,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Delete button */}
          {onDeleteOption && (
            <div
              onClick={handleDeleteOption}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--dt-accent-danger)',
                fontSize: '13px',
                borderBottom: '1px solid var(--dt-border-color)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--dt-tag-red-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span>🗑</span>
              <span>Delete</span>
            </div>
          )}

          {/* Color picker */}
          {onUpdateOption && (
            <div style={{ padding: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--dt-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
                Colors
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {COLOR_OPTIONS.map((color) => {
                  const colorStyles = getColorStyles(color);
                  const isSelected = editingOption.color === color;
                  return (
                    <div
                      key={color}
                      onClick={() => handleColorChange(color)}
                      style={{
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        borderRadius: '4px',
                        backgroundColor: isSelected ? 'var(--dt-bg-hover)' : 'transparent',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--dt-bg-hover)')}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <span
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '3px',
                          backgroundColor: colorStyles.bg,
                        }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--dt-text-primary)', textTransform: 'capitalize' }}>
                        {color}
                      </span>
                      {isSelected && (
                        <span style={{ marginLeft: 'auto', color: 'var(--dt-accent-primary)' }}>✓</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
