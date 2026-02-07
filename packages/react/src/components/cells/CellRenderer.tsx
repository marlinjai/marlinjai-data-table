import type { Column, CellValue, SelectOption, FileReference, RelationValue, RelationColumnConfig, Row, TextAlignment } from '@marlinjai/data-table-core';
import { TextCell } from './TextCell';
import { NumberCell } from './NumberCell';
import { DateCell } from './DateCell';
import { BooleanCell } from './BooleanCell';
import { SelectCell } from './SelectCell';
import { MultiSelectCell } from './MultiSelectCell';
import { UrlCell } from './UrlCell';
import { FileCell } from './FileCell';
import { RelationCell } from './RelationCell';
import { TimestampCell } from './TimestampCell';

export interface CellRendererProps {
  column: Column;
  value: CellValue;
  onChange: (value: CellValue) => void;
  selectOptions?: SelectOption[];
  readOnly?: boolean;
  alignment?: TextAlignment;
  onCreateOption?: (name: string, color?: string) => Promise<SelectOption>;
  onUpdateOption?: (optionId: string, updates: { name?: string; color?: string }) => Promise<SelectOption>;
  onDeleteOption?: (optionId: string) => Promise<void>;
  onUploadFile?: (file: File) => Promise<FileReference>;
  onDeleteFile?: (fileId: string) => Promise<void>;
  // Relation cell callbacks
  onSearchRelationRows?: (tableId: string, query: string) => Promise<Row[]>;
  onGetRelationRowTitle?: (tableId: string, rowId: string) => Promise<string>;
}

export function CellRenderer({
  column,
  value,
  onChange,
  selectOptions = [],
  readOnly,
  alignment,
  onCreateOption,
  onUpdateOption,
  onDeleteOption,
  onUploadFile,
  onDeleteFile,
  onSearchRelationRows,
  onGetRelationRowTitle,
}: CellRendererProps) {
  switch (column.type) {
    case 'text':
      return (
        <TextCell
          value={value as string | null}
          onChange={onChange}
          config={column.config as any}
          readOnly={readOnly}
          alignment={alignment}
        />
      );

    case 'number':
      return (
        <NumberCell
          value={value as number | null}
          onChange={onChange}
          config={column.config as any}
          readOnly={readOnly}
          alignment={alignment}
        />
      );

    case 'date':
      return (
        <DateCell
          value={value as Date | string | null}
          onChange={onChange}
          config={column.config as any}
          readOnly={readOnly}
          alignment={alignment}
        />
      );

    case 'boolean':
      return (
        <BooleanCell
          value={value as boolean | null}
          onChange={onChange}
          readOnly={readOnly}
          alignment={alignment}
        />
      );

    case 'select':
      return (
        <SelectCell
          value={value as string | null}
          onChange={onChange}
          options={selectOptions}
          readOnly={readOnly}
          alignment={alignment}
          onCreateOption={onCreateOption}
          onUpdateOption={onUpdateOption}
          onDeleteOption={onDeleteOption}
        />
      );

    case 'multi_select':
      return (
        <MultiSelectCell
          value={value as string[] | null}
          onChange={onChange}
          options={selectOptions}
          config={column.config as any}
          readOnly={readOnly}
          alignment={alignment}
          onCreateOption={onCreateOption}
          onUpdateOption={onUpdateOption}
          onDeleteOption={onDeleteOption}
        />
      );

    case 'url':
      return (
        <UrlCell
          value={value as string | null}
          onChange={onChange}
          config={column.config as any}
          readOnly={readOnly}
          alignment={alignment}
        />
      );

    case 'formula':
      // Formula cells are read-only and display computed values
      return (
        <div
          className="dt-cell-formula"
          style={{
            padding: '4px 8px',
            color: '#6b7280',
            fontStyle: 'italic',
            minHeight: '24px',
            textAlign: alignment,
          }}
        >
          {value?.toString() ?? ''}
        </div>
      );

    case 'relation':
      return (
        <RelationCell
          value={value as RelationValue[] | null}
          onChange={onChange}
          config={column.config as RelationColumnConfig}
          readOnly={readOnly}
          alignment={alignment}
          onSearchRows={onSearchRelationRows}
          onGetRowTitle={onGetRelationRowTitle}
        />
      );

    case 'rollup':
      // Rollup cells are read-only and display aggregated values
      return (
        <div
          className="dt-cell-rollup"
          style={{
            padding: '4px 8px',
            color: '#6b7280',
            fontStyle: 'italic',
            minHeight: '24px',
            textAlign: alignment,
          }}
        >
          {value?.toString() ?? ''}
        </div>
      );

    case 'file':
      return (
        <FileCell
          value={value as FileReference[] | null}
          onChange={onChange}
          config={column.config as any}
          readOnly={readOnly}
          alignment={alignment}
          onUpload={onUploadFile}
          onDelete={onDeleteFile}
        />
      );

    case 'created_time':
    case 'last_edited_time':
      return (
        <TimestampCell
          column={column}
          value={value as Date | string | null}
          alignment={alignment}
        />
      );

    default:
      return (
        <div
          className="dt-cell-unknown"
          style={{
            padding: '4px 8px',
            color: '#999',
            minHeight: '24px',
            textAlign: alignment,
          }}
        >
          {value?.toString() ?? ''}
        </div>
      );
  }
}
