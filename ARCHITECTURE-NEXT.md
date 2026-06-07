# Data Table: Next-Gen Architecture (Pattern C + MST)

## The Problem Today

```
Browser (client)                          Server
┌─────────────────────────┐              ┌──────────────┐
│ dashboard/page.tsx      │              │              │
│   'use client'          │              │   Postgres   │
│        │                │              │              │
│   import { dbAdapter }  │              └──────────────┘
│        │                │                    ▲
│   DataTableProvider     │                    │
│     dbAdapter={adapter} │                    │ CAN'T REACH
│        │                │                    │
│   useTable() ──────────►│── dbAdapter.getRows() ──X── PrismaClient
│                         │                              (server-only!)
│   PrismaClient CRASHES  │
│   "unable to run in     │
│    this browser"        │
└─────────────────────────┘

WHY: Bundler includes PrismaClient in client JS because
     dashboard/page.tsx imports receipts-table.ts which
     contains require('@marlinjai/data-table-adapter-prisma').
     Dynamic require() does NOT prevent bundling.
```

## The Solution: Pattern C

```
SERVER SIDE                              CLIENT SIDE
(Node.js / Server Components)            (Browser / Client Components)

┌──────────────────────────┐            ┌──────────────────────────┐
│                          │            │                          │
│  Server Component        │  props     │  Client Component        │
│  (page.tsx or layout)    │ ────────►  │  'use client'            │
│                          │            │                          │
│  ┌────────────────────┐  │            │  ┌────────────────────┐  │
│  │ PrismaAdapter      │  │  initial   │  │ DataTableProvider  │  │
│  │   .getColumns()    │──┼──data───►  │  │   initialData={..} │  │
│  │   .getRows()       │  │            │  │   actions={..}     │  │
│  │   .getSelectOpts() │  │            │  │                    │  │
│  │   .getViews()      │  │            │  │  useTable()        │  │
│  └────────────────────┘  │            │  │  useViews()        │  │
│                          │            │  │  useRows()         │  │
│  ┌────────────────────┐  │            │  │                    │  │
│  │ Server Actions     │  │  mutations │  │  TableView         │  │
│  │   createRow()     ◄├──┼───────────┼──┤  BoardView         │  │
│  │   updateRow()     ◄├──┼───────────┼──┤  CalendarView      │  │
│  │   deleteRow()     ◄├──┼───────────┼──┤                    │  │
│  │   updateColumn()  ◄├──┼───────────┼──┤  onCellChange()────┼──┘
│  │   createView()    ◄├──┼───────────┼──┤  onAddRow()────────┘
│  │   ...28 mutations  │  │            │  └────────────────────┘
│  └────────────────────┘  │            │                          │
│           │               │            │  NO PrismaClient here   │
│           ▼               │            │  NO database imports     │
│  ┌────────────────────┐  │            │  NO server-only code     │
│  │ Postgres           │  │            │                          │
│  └────────────────────┘  │            └──────────────────────────┘
└──────────────────────────┘


READS:  Server Component → PrismaAdapter → Postgres → serialized props → Client
WRITES: Client → Server Action → PrismaAdapter → Postgres → return updated data
```

## Adapter Method Split (41 total)

### 13 READ methods → Server Component (SSR, zero hop)

```
TABLES:    getTable(), listTables()
COLUMNS:   getColumns(), getColumn()
ROWS:      getRow(), getRows()              ← bulk of data
OPTIONS:   getSelectOptions()
VIEWS:     getViews(), getView()
RELATIONS: getRelatedRows(), getRelationsForRow()
FILES:     getFileReferences()
```

### 28 WRITE methods → Server Actions (client calls, server executes)

```
TABLES:    createTable, updateTable, deleteTable
COLUMNS:   createColumn, updateColumn, deleteColumn, reorderColumns
ROWS:      createRow, updateRow, deleteRow, archiveRow, unarchiveRow,
           bulkCreateRows, bulkDeleteRows, bulkArchiveRows
OPTIONS:   createSelectOption, updateSelectOption, deleteSelectOption,
           reorderSelectOptions
VIEWS:     createView, updateView, deleteView, reorderViews
RELATIONS: createRelation, deleteRelation
FILES:     addFileReference, removeFileReference, reorderFileReferences
TRANSACTIONS: transaction
```

## DataTableProvider Changes (data-table-react)

### Current API (broken with server adapters)
```tsx
// Client component receives adapter directly — BROKEN
<DataTableProvider dbAdapter={prismaAdapter}>
  <DashboardContent tableId={id} />
</DataTableProvider>
```

### New API (Pattern C)
```tsx
// Server component fetches initial data
async function DashboardPage() {
  const adapter = new PrismaAdapter({ prisma });
  const tableId = await getTableId(adapter);
  const [columns, rows, views, selectOptions] = await Promise.all([
    adapter.getColumns(tableId),
    adapter.getRows(tableId, { limit: 50 }),
    adapter.getViews(tableId),
    loadAllSelectOptions(adapter, tableId),
  ]);

  return (
    <DataTableProvider
      tableId={tableId}
      initialData={{ columns, rows, views, selectOptions }}
      actions={tableActions}  // imported from 'use server' file
    >
      <DashboardContent />
    </DataTableProvider>
  );
}
```

### DataTableProvider internal changes
```
BEFORE:                              AFTER:

useEffect → adapter.getColumns()    if (initialData) → use it directly
useEffect → adapter.getRows()       else → adapter.getColumns() (fallback)
useEffect → adapter.getViews()

onCellChange → adapter.updateRow()  onCellChange → actions.updateRow()
onAddRow → adapter.createRow()      onAddRow → actions.createRow()
onDelete → adapter.deleteRow()      onDelete → actions.deleteRow()
```

## Future: MST Integration Layer

```
┌─────────────────────────────────────────────────────┐
│  Browser (Client)                                    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ MobX State Tree (MST)                        │    │
│  │                                               │    │
│  │  RootStore                                    │    │
│  │  ├── projectStore (Framer clone)              │    │
│  │  │     └── pages → components → props         │    │
│  │  │           └── dataBinding ──────────┐      │    │
│  │  │                                     │      │    │
│  │  ├── dataTableStore (NEW) ◄────────────┘      │    │
│  │  │     ├── tables{}                           │    │
│  │  │     │     ├── columns[]                    │    │
│  │  │     │     ├── rows[]  ◄── SSR initial      │    │
│  │  │     │     ├── views[]      data             │    │
│  │  │     │     └── selectOptions{}              │    │
│  │  │     │                                      │    │
│  │  │     └── actions (call server actions)       │    │
│  │  │           ├── updateRow() → server action   │    │
│  │  │           ├── createRow() → server action   │    │
│  │  │           └── ... (optimistic updates)      │    │
│  │  │                                            │    │
│  │  └── editorUI (Framer selection state)         │    │
│  │        └── currentDataSource: ref(table)       │    │
│  └─────────────────────────────────────────────┘    │
│       ▲                    │                         │
│       │ observe            │ server actions           │
│       │                    ▼                         │
│  ┌─────────┐    ┌──────────────────┐                │
│  │ React   │    │ Server Actions   │                │
│  │ observer│    │ (HTTP POST to    │                │
│  │ comps   │    │  Next.js server) │                │
│  └─────────┘    └────────┬─────────┘                │
└──────────────────────────┼───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│  Server                                               │
│                                                       │
│  Server Actions                                       │
│  ├── PrismaAdapter.updateRow()                        │
│  ├── PrismaAdapter.createRow()                        │
│  └── ... → Postgres                                   │
│                                                       │
│  Optional: WebSocket/SSE broadcast                    │
│  ├── Postgres LISTEN/NOTIFY on row changes            │
│  ├── Broadcast to connected clients                   │
│  └── Client MST: applyPatch(incomingChanges)          │
└──────────────────────────────────────────────────────┘
```

## Data Flow: Component bound to table data (Framer + DataTable)

```
1. INITIAL LOAD (SSR)
   Server Component
     → PrismaAdapter.getRows()
     → serialize to JSON
     → pass as initialData prop
     → DataTableProvider hydrates MST store
     → Framer ComponentModel.dataBinding resolves
     → Canvas renders with real data

2. USER EDITS CELL (optimistic)
   Click cell → MST action: store.updateRow(id, cells)
     → Optimistic: MST row updates immediately
     → React observers re-render (TableView + bound Framer components)
     → Async: server action → PrismaAdapter.updateRow() → Postgres
     → On error: MST rollback via snapshot

3. REAL-TIME SYNC (future, WebSocket)
   Another client edits row
     → Postgres NOTIFY 'row_changed'
     → Server WS handler → broadcast patch
     → This client receives patch
     → MST: applyPatch(store.rows, patch)
     → All observers re-render automatically

4. FRAMER DATA BINDING
   ComponentModel {
     type: 'text',
     props: { content: '' },
     dataBinding: {
       sourceTable: ref(dataTableStore.tables.get('receipts')),
       rowFilter: { column: 'status', equals: 'Processed' },
       propMap: { content: 'vendor' }  // props.content ← row.cells.vendor
     }
   }

   → MST computed view resolves binding
   → Returns "Amazon" for content
   → Component renders "Amazon"
   → Row changes → MobX reaction → re-render
```

## Implementation Phases

### Phase 1: Pattern C (unblocks receipt-ocr NOW)
- Add `initialData` prop to DataTableProvider
- Add `actions` prop for server action callbacks
- Keep existing `dbAdapter` prop as fallback for non-Next.js apps
- Receipt-ocr dashboard: server component wrapper + server actions

### Phase 2: MST Store (enables Framer integration)
- Create DataTableStore MST model in data-table-react
- DataTableProvider hydrates MST store from initialData
- Hooks (useTable, useRows) read from MST instead of useState
- All mutations go through MST actions → server actions

### Phase 3: Real-time (multi-client sync)
- SSE or WebSocket connection per client
- Server: Postgres LISTEN/NOTIFY → broadcast
- Client: MST applyPatch on incoming changes
- Conflict resolution: last-write-wins or operational transforms

### Phase 4: Framer Data Binding
- Add dataBinding field to ComponentModel
- MST computed views resolve bindings
- Component props auto-populate from table data
- Two-way: edit in Framer → updates table, edit table → updates canvas

## Package Boundary Guarantee

```
@marlinjai/data-table-core       → Types + interfaces (universal)
@marlinjai/data-table-react      → React hooks + components (client-safe)
@marlinjai/data-table-adapter-*  → NEVER imported on client
                                    Only used in:
                                    - Server Components
                                    - Server Actions
                                    - API Routes
                                    - Node.js scripts

Rule: If a file has 'use client', it MUST NOT import any adapter.
      DataTableProvider receives data, not adapters.
```
