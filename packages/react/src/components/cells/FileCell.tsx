import { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { FileColumnConfig, FileReference, TextAlignment } from '@marlinjai/data-table-core';

export interface FileCellProps {
  value: FileReference[] | null;
  onChange: (value: FileReference[]) => void;
  config?: FileColumnConfig;
  readOnly?: boolean;
  alignment?: TextAlignment;
  onUpload?: (file: File) => Promise<FileReference>;
  onDelete?: (fileId: string) => Promise<void>;
}

// Convert text alignment to flexbox justify-content
function alignmentToJustify(alignment: TextAlignment): 'flex-start' | 'center' | 'flex-end' {
  switch (alignment) {
    case 'left': return 'flex-start';
    case 'center': return 'center';
    case 'right': return 'flex-end';
  }
}

// File type icons
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
  return '📎';
}

// Format file size
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileCell({
  value,
  onChange,
  config,
  readOnly,
  alignment = 'left',
  onUpload,
  onDelete,
}: FileCellProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const files = value ?? [];
  const maxFiles = config?.maxFiles ?? 10;
  const canAddMore = files.length < maxFiles;

  const handleClick = useCallback(() => {
    if (readOnly) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 2,
        left: rect.left,
      });
    }
    setIsDropdownOpen(true);
  }, [readOnly]);

  const handleClose = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile || !onUpload) return;

      // Validate file type if config specifies allowed types
      if (config?.allowedTypes?.length) {
        if (!config.allowedTypes.includes(selectedFile.type)) {
          alert(`File type ${selectedFile.type} is not allowed.`);
          return;
        }
      }

      // Validate file size
      if (config?.maxSizeBytes && selectedFile.size > config.maxSizeBytes) {
        alert(`File is too large. Maximum size is ${formatFileSize(config.maxSizeBytes)}.`);
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      try {
        const uploadedFile = await onUpload(selectedFile);
        const newFiles = [...files, uploadedFile];
        onChange(newFiles);
      } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload file. Please try again.');
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [files, onChange, onUpload, config]
  );

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      if (!onDelete) return;

      try {
        await onDelete(fileId);
        const newFiles = files.filter((f) => f.fileId !== fileId);
        onChange(newFiles);
      } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete file. Please try again.');
      }
    },
    [files, onChange, onDelete]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (readOnly || !onUpload || !canAddMore) return;

      const droppedFile = e.dataTransfer.files[0];
      if (!droppedFile) return;

      // Trigger the same upload logic
      const fakeEvent = {
        target: { files: [droppedFile] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      await handleFileSelect(fakeEvent);
    },
    [readOnly, onUpload, canAddMore, handleFileSelect]
  );

  // Click outside to close dropdown
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    },
    [handleClose]
  );

  // Add/remove click outside listener
  useState(() => {
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  });

  return (
    <div
      ref={containerRef}
      className="dt-cell-file"
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        padding: '4px 8px',
        minHeight: '24px',
        cursor: readOnly ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: alignmentToJustify(alignment),
        gap: '4px',
        flexWrap: 'wrap',
      }}
    >
      {/* File thumbnails/icons */}
      {files.length > 0 ? (
        files.map((file) => (
          <div
            key={file.fileId}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              fontSize: '12px',
            }}
            title={file.originalName}
          >
            {file.mimeType?.startsWith('image/') ? (
              <img
                src={file.fileUrl}
                alt={file.originalName}
                style={{
                  width: '20px',
                  height: '20px',
                  objectFit: 'cover',
                  borderRadius: '2px',
                }}
              />
            ) : (
              <span>{getFileIcon(file.mimeType)}</span>
            )}
            <span
              style={{
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {file.originalName}
            </span>
          </div>
        ))
      ) : (
        <span style={{ color: '#9ca3af', fontSize: '13px' }}>
          {readOnly ? 'No files' : 'Add files...'}
        </span>
      )}

      {/* Upload progress indicator */}
      {isUploading && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            backgroundColor: '#dbeafe',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#1d4ed8',
          }}
        >
          Uploading...
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept={config?.allowedTypes?.join(',')}
        style={{ display: 'none' }}
      />

      {/* Dropdown for managing files */}
      {isDropdownOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              zIndex: 9999,
              minWidth: '280px',
              maxWidth: '400px',
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow:
                '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Upload button */}
            {canAddMore && onUpload && (
              <div
                style={{
                  padding: '12px',
                  borderBottom: files.length > 0 ? '1px solid #e5e7eb' : 'none',
                }}
              >
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px dashed #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: isUploading ? '#f9fafb' : 'white',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    color: '#6b7280',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>📤</span>
                  <span>{isUploading ? 'Uploading...' : 'Click or drag to upload'}</span>
                  {config?.maxSizeBytes && (
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                      Max size: {formatFileSize(config.maxSizeBytes)}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* File list */}
            {files.length > 0 && (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {files.map((file) => (
                  <div
                    key={file.fileId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    {/* Preview/icon */}
                    {file.mimeType?.startsWith('image/') ? (
                      <img
                        src={file.fileUrl}
                        alt={file.originalName}
                        style={{
                          width: '40px',
                          height: '40px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '4px',
                          fontSize: '20px',
                          flexShrink: 0,
                        }}
                      >
                        {getFileIcon(file.mimeType)}
                      </div>
                    )}

                    {/* File info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {file.originalName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {formatFileSize(file.sizeBytes)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      {/* Open in new tab */}
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '4px 8px',
                          color: '#6b7280',
                          textDecoration: 'none',
                          fontSize: '12px',
                          borderRadius: '4px',
                        }}
                        title="Open"
                        onClick={(e) => e.stopPropagation()}
                      >
                        🔗
                      </a>

                      {/* Delete */}
                      {onDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file.fileId);
                          }}
                          style={{
                            padding: '4px 8px',
                            border: 'none',
                            background: 'none',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            fontSize: '12px',
                            borderRadius: '4px',
                          }}
                          title="Delete"
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color = '#ef4444')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = '#9ca3af')
                          }
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {files.length === 0 && !onUpload && (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: '13px',
                }}
              >
                No files attached
              </div>
            )}

            {/* Close button */}
            <div
              style={{
                padding: '8px 12px',
                borderTop: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
                textAlign: 'right',
              }}
            >
              <button
                onClick={handleClose}
                style={{
                  padding: '4px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
