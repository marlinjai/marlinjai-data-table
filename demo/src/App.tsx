import { useEffect, useState } from 'react';
import { MemoryAdapter } from '@marlinjai/data-table-adapter-memory';
import type { FileStorageAdapter, UploadedFile, FileUploadOptions, Row, GroupConfig, SubItemsConfig, FooterConfig, TextAlignment, Column } from '@marlinjai/data-table-core';
import {
  DataTableProvider,
  TableView,
  FilterBar,
  SearchBar,
  useTable,
  useViews,
  ViewSwitcher,
  BoardView,
  CalendarView,
  type ColumnType,
} from '@marlinjai/data-table-react';

// Create a single adapter instance
const dbAdapter = new MemoryAdapter();

// Mock file adapter for demo purposes (stores files in memory using blob URLs)
class MockFileAdapter implements FileStorageAdapter {
  private files = new Map<string, { blob: Blob; url: string; name: string; type: string }>();

  async upload(file: File | Blob, options?: FileUploadOptions): Promise<UploadedFile> {
    const id = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const url = URL.createObjectURL(file);
    const name = options?.fileName ?? (file instanceof File ? file.name : 'file');
    const type = file.type || 'application/octet-stream';

    this.files.set(id, { blob: file, url, name, type });

    // Simulate upload progress
    if (options?.onProgress) {
      options.onProgress(50);
      await new Promise((r) => setTimeout(r, 100));
      options.onProgress(100);
    }

    return {
      id,
      url,
      originalName: name,
      mimeType: type,
      sizeBytes: file.size,
    };
  }

  async delete(fileId: string): Promise<void> {
    const file = this.files.get(fileId);
    if (file) {
      URL.revokeObjectURL(file.url);
      this.files.delete(fileId);
    }
  }

  async getUrl(fileId: string): Promise<string> {
    const file = this.files.get(fileId);
    if (!file) throw new Error('File not found');
    return file.url;
  }
}

const fileAdapter = new MockFileAdapter();

type ColorScheme = 'system' | 'light' | 'dark';

function App() {
  const [isReady, setIsReady] = useState(false);
  const [tableId, setTableId] = useState<string | null>(null);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('system');

  // Initialize with sample data
  useEffect(() => {
    const init = async () => {
      const result = await dbAdapter.seedSampleData('demo-workspace');
      setTableId(result.tableId);
      setIsReady(true);
    };
    init();
  }, []);

  // Apply color scheme class to document root (html element)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (colorScheme === 'dark') {
      root.classList.add('dark');
    } else if (colorScheme === 'light') {
      root.classList.add('light');
    }
    // 'system' = no class, follows OS preference
  }, [colorScheme]);

  const cycleColorScheme = () => {
    setColorScheme((prev) => {
      if (prev === 'system') return 'light';
      if (prev === 'light') return 'dark';
      return 'system';
    });
  };

  const getSchemeIcon = () => {
    if (colorScheme === 'system') return '💻';
    if (colorScheme === 'light') return '☀️';
    return '🌙';
  };

  const getSchemeLabel = () => {
    if (colorScheme === 'system') return 'System';
    if (colorScheme === 'light') return 'Light';
    return 'Dark';
  };

  if (!isReady || !tableId) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--demo-text-secondary)' }}>
        Loading demo data...
      </div>
    );
  }

  return (
    <DataTableProvider dbAdapter={dbAdapter} fileAdapter={fileAdapter} workspaceId="demo-workspace">
      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--demo-text-primary)' }}>
              Data Table Demo
            </h1>
            <p style={{ color: 'var(--demo-text-secondary)', marginTop: '8px' }}>
              A Notion-like data table with custom properties, filtering, sorting, and inline editing.
            </p>
          </div>
          <button
            onClick={cycleColorScheme}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--demo-button-bg)',
              color: 'var(--demo-button-text)',
              border: '1px solid var(--demo-button-border)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: '110px',
            }}
          >
            {getSchemeIcon()} {getSchemeLabel()}
          </button>
        </header>

        <ReceiptsTable tableId={tableId} />
      </div>
    </DataTableProvider>
  );
}

function ReceiptsTable({ tableId }: { tableId: string }) {
  const {
    table,
    columns,
    rows,
    total,
    hasMore,
    isRowsLoading,
    selectOptions,
    filters,
    sorts,
    setFilters,
    setSorts,
    updateCell,
    updateColumn,
    addColumn,
    addRow,
    deleteRow,
    loadMore,
    loadSelectOptions,
    createSelectOption,
    updateSelectOption,
    deleteSelectOption,
    uploadFile,
    deleteFile,
  } = useTable({ tableId });

  const {
    views,
    currentView,
    createView,
    updateView,
    deleteView,
    setCurrentView,
  } = useViews({ tableId });

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [groupConfig, setGroupConfig] = useState<GroupConfig | undefined>(undefined);
  const [subItemsConfig, setSubItemsConfig] = useState<SubItemsConfig>({
    enabled: true,
    displayMode: 'nested',
    filterMode: 'all',
    collapsedParents: [],
  });
  const [columnOrder, setColumnOrder] = useState<string[] | undefined>(undefined);
  const [footerConfig, setFooterConfig] = useState<FooterConfig>({ calculations: {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRows, setFilteredRows] = useState<Row[]>([]);
  const [columnAlignments, setColumnAlignments] = useState<Map<string, TextAlignment>>(new Map());

  // Use filtered rows when searching, otherwise use all rows
  const displayRows = searchTerm ? filteredRows : rows;

  // Apply alignment overrides to columns
  const columnsWithAlignment: Column[] = columns.map((col) => ({
    ...col,
    alignment: columnAlignments.get(col.id) ?? col.alignment,
  }));

  // Handle column alignment change from context menu
  const handleColumnAlignmentChange = (columnId: string, alignment: TextAlignment) => {
    setColumnAlignments((prev) => new Map(prev).set(columnId, alignment));
  };

  // Find the Status column ID for BoardView grouping
  const statusColumnId = columns.find((col) => col.name === 'Status')?.id;

  // Find the Date column ID for CalendarView
  const dateColumnId = columns.find((col) => col.name === 'Date')?.id;

  const handleColumnResize = async (columnId: string, width: number) => {
    await updateColumn(columnId, { width });
  };

  const handleAddProperty = async (name: string, type: ColumnType) => {
    const column = await addColumn({ name, type });
    // If it's a select type, load the options (empty initially)
    if (type === 'select' || type === 'multi_select') {
      await loadSelectOptions(column.id);
    }
  };

  // Column reorder handler
  const handleColumnReorder = (columnId: string, newPosition: number) => {
    const currentOrder = columnOrder || columns.map((c) => c.id);
    const oldIndex = currentOrder.indexOf(columnId);
    if (oldIndex === -1) return;

    const newOrder = [...currentOrder];
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newPosition, 0, columnId);
    setColumnOrder(newOrder);
  };

  // Sub-items handlers
  const handleExpandRow = (rowId: string) => {
    setSubItemsConfig((prev) => ({
      ...prev,
      collapsedParents: prev.collapsedParents?.filter((id) => id !== rowId) || [],
    }));
  };

  const handleCollapseRow = (rowId: string) => {
    setSubItemsConfig((prev) => ({
      ...prev,
      collapsedParents: [...(prev.collapsedParents || []), rowId],
    }));
  };

  const handleCreateSubItem = async (parentRowId: string) => {
    await addRow({ parentRowId });
  };

  // Relation callbacks using the dbAdapter
  const handleSearchRelationRows = async (relatedTableId: string, query: string): Promise<Row[]> => {
    const result = await dbAdapter.getRows(relatedTableId, { limit: 20 });
    if (!query) return result.items;
    // Filter by query (simple case-insensitive search on all text values)
    return result.items.filter((row: Row) => {
      return Object.values(row.cells).some((value) => {
        if (typeof value === 'string') {
          return value.toLowerCase().includes(query.toLowerCase());
        }
        return false;
      });
    });
  };

  const handleGetRelationRowTitle = async (relatedTableId: string, rowId: string): Promise<string> => {
    try {
      const row = await dbAdapter.getRow(rowId);
      if (!row) return `Row ${rowId}`;
      // Get the primary column for this table
      const tableColumns = await dbAdapter.getColumns(relatedTableId);
      const primaryColumn = tableColumns.find((col) => col.isPrimary);
      if (primaryColumn) {
        const value = row.cells[primaryColumn.id];
        if (value !== null && value !== undefined) {
          return String(value);
        }
      }
      // Fallback to first text column value
      const firstTextColumn = tableColumns.find((col) => col.type === 'text');
      if (firstTextColumn) {
        const value = row.cells[firstTextColumn.id];
        if (value !== null && value !== undefined) {
          return String(value);
        }
      }
      return `Row ${rowId}`;
    } catch {
      return `Row ${rowId}`;
    }
  };

  // Handler for creating a new view
  const handleCreateView = async (type: 'table' | 'board' | 'calendar' | 'gallery' | 'timeline' | 'list') => {
    const viewNames: Record<string, string> = {
      table: 'Table View',
      board: 'Board View',
      calendar: 'Calendar View',
      gallery: 'Gallery View',
      timeline: 'Timeline View',
      list: 'List View',
    };
    await createView({
      name: viewNames[type] || type,
      type,
    });
  };

  // Handlers for CalendarView
  const handleRowClick = (row: Row) => {
    console.log('Row clicked:', row);
    // You could open a detail modal here
  };

  const handleDayClick = (date: Date, events: unknown[]) => {
    console.log('Day clicked:', date, 'Events:', events);
    // You could show a day detail view or create a new event
  };

  if (!table) {
    return <div>Loading table...</div>;
  }

  return (
    <div>
      {/* Table header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>
            {table.icon} {table.name}
          </h2>
          <p style={{ color: 'var(--demo-text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {total} {total === 1 ? 'item' : 'items'}
            {filters.length > 0 && ` (filtered)`}
            {' · '}{columns.length} properties
          </p>
        </div>

        {selectedRows.size > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                selectedRows.forEach((id) => deleteRow(id));
                setSelectedRows(new Set());
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--demo-button-danger)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Delete {selectedRows.size} selected
            </button>
            <button
              onClick={() => setSelectedRows(new Set())}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--demo-button-bg)',
                color: 'var(--demo-button-text)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* View Switcher */}
      <ViewSwitcher
        views={views}
        currentViewId={currentView?.id ?? null}
        onViewChange={setCurrentView}
        onCreateView={handleCreateView}
        onDeleteView={deleteView}
        onRenameView={(viewId, name) => updateView(viewId, { name })}
      />

      {/* Search and Filter bar (only for table view) */}
      {(!currentView || currentView.type === 'table') && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <SearchBar
            rows={rows}
            columns={columns}
            onSearchResults={(results, term) => {
              setFilteredRows(results);
              setSearchTerm(term);
            }}
            placeholder="Search table..."
            style={{ minWidth: '250px', flex: '0 0 auto' }}
          />
          <div style={{ flex: 1 }}>
            <FilterBar
              columns={columns}
              filters={filters}
              selectOptions={selectOptions}
              onFiltersChange={setFilters}
            />
          </div>
        </div>
      )}

      {/* Grouping Controls */}
      {(!currentView || currentView.type === 'table') && (
        <div style={{ marginBottom: '12px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '14px', color: 'var(--demo-text-primary)' }}>
            Group by:
            <select
              value={groupConfig?.columnId || ''}
              onChange={(e) => {
                if (e.target.value) {
                  setGroupConfig({ columnId: e.target.value, direction: 'asc', hideEmptyGroups: false, collapsedGroups: [] });
                } else {
                  setGroupConfig(undefined);
                }
              }}
              style={{ 
                marginLeft: '8px', 
                padding: '4px 8px', 
                borderRadius: '4px', 
                border: '1px solid var(--demo-border)',
                backgroundColor: 'var(--demo-card-bg)',
                color: 'var(--demo-text-primary)'
              }}
            >
              <option value="">None</option>
              {columns.filter(c => ['text', 'select', 'multi_select', 'boolean'].includes(c.type)).map((col) => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '14px', color: 'var(--demo-text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={subItemsConfig.enabled}
              onChange={(e) => setSubItemsConfig(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            Sub-items
          </label>
          {columnOrder && (
            <button
              onClick={() => setColumnOrder(undefined)}
              style={{ 
                padding: '4px 8px', 
                borderRadius: '4px', 
                border: '1px solid var(--demo-border)', 
                background: 'var(--demo-card-bg)', 
                color: 'var(--demo-text-primary)',
                cursor: 'pointer', 
                fontSize: '13px' 
              }}
            >
              Reset Column Order
            </button>
          )}
        </div>
      )}

      {/* Conditional View Rendering */}
      {(!currentView || currentView.type === 'table') && (
        <TableView
          columns={columnsWithAlignment}
          rows={displayRows}
          selectOptions={selectOptions}
          onCellChange={(rowId, columnId, value) => updateCell(rowId, columnId, value)}
          onAddRow={() => addRow()}
          onDeleteRow={deleteRow}
          onColumnResize={handleColumnResize}
          onAddProperty={handleAddProperty}
          onCreateSelectOption={createSelectOption}
          onUpdateSelectOption={updateSelectOption}
          onDeleteSelectOption={deleteSelectOption}
          onUploadFile={uploadFile}
          onDeleteFile={deleteFile}
          onSearchRelationRows={handleSearchRelationRows}
          onGetRelationRowTitle={handleGetRelationRowTitle}
          sorts={sorts}
          onSortChange={setSorts}
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
          isLoading={isRowsLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          // New features
          groupConfig={groupConfig}
          onGroupConfigChange={setGroupConfig}
          subItemsConfig={subItemsConfig}
          onExpandRow={handleExpandRow}
          onCollapseRow={handleCollapseRow}
          onCreateSubItem={handleCreateSubItem}
          columnOrder={columnOrder}
          onColumnReorder={handleColumnReorder}
          // Footer calculations
          footerConfig={footerConfig}
          onFooterConfigChange={setFooterConfig}
          showFooter={true}
          // Column alignment
          onColumnAlignmentChange={handleColumnAlignmentChange}
          style={{ backgroundColor: 'var(--demo-card-bg)' }}
        />
      )}

      {currentView?.type === 'board' && statusColumnId && (
        <BoardView
          columns={columns}
          rows={rows}
          selectOptions={selectOptions}
          config={{ groupByColumnId: statusColumnId, showEmptyGroups: true }}
          onCellChange={(rowId, columnId, value) => updateCell(rowId, columnId, value)}
          onAddRow={(initialCellValues) => addRow({ cells: initialCellValues })}
          onDeleteRow={deleteRow}
          onCreateSelectOption={createSelectOption}
          onUpdateSelectOption={updateSelectOption}
          onDeleteSelectOption={deleteSelectOption}
          onUploadFile={uploadFile}
          onDeleteFile={deleteFile}
        />
      )}

      {currentView?.type === 'calendar' && dateColumnId && (
        <CalendarView
          columns={columns}
          rows={rows}
          config={{ dateColumnId: dateColumnId }}
          onRowClick={handleRowClick}
          onDayClick={handleDayClick}
        />
      )}

      {/* Instructions */}
      <div
        style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: 'var(--demo-info-bg)',
          borderRadius: '8px',
          fontSize: '14px',
          color: 'var(--demo-info-text)',
          border: `1px solid var(--demo-info-border)`,
        }}
      >
        <strong>Try it out:</strong>
        <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
          <li><b>Search</b> - Use the search bar (Cmd/Ctrl+F) to find rows instantly</li>
          <li><b>Edit cells</b> - Double-click any cell to edit inline</li>
          <li><b>Sort</b> - Click column headers to sort (click again to toggle)</li>
          <li><b>Filter</b> - Use the filter bar above the table</li>
          <li><b>Resize columns</b> - Drag the edge of any column header</li>
          <li><b>Reorder columns</b> - Drag the grip handle on column headers to reorder</li>
          <li><b>Align columns</b> - Right-click any column header to change text alignment</li>
          <li><b>Group rows</b> - Use the "Group by" dropdown to group rows by a column</li>
          <li><b>Sub-items</b> - Hover over a row to see the "+" button, click to create a sub-item</li>
          <li><b>Add properties</b> - Click "+ New property" to add a column</li>
          <li><b>Select rows</b> - Use checkboxes, then bulk delete</li>
          <li><b>Add rows</b> - Click "+ New row" at the bottom</li>
          <li><b>Upload files</b> - Click the "Receipt" file column to upload files (drag & drop supported)</li>
          <li><b>Footer calculations</b> - Click "Calculate" in the footer row to add sum, average, count, etc.</li>
          <li><b>Timestamps</b> - "Created" and "Last Edited" columns auto-update when rows change</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
