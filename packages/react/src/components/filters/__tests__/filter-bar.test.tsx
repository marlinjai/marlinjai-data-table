import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { Column } from '@marlinjai/data-table-core';
import { FilterBar } from '../FilterBar';

const columns = [{ id: 'name', name: 'Name', type: 'text' }] as unknown as Column[];

describe('the filter bar', () => {
  it('draws its own frame by default', () => {
    const { container } = render(<FilterBar columns={columns} filters={[]} onFiltersChange={() => {}} />);
    const bar = container.querySelector('.dt-filter-bar') as HTMLElement;
    expect(bar.classList.contains('dt-filter-bar-bare')).toBe(false);
    expect(bar.style.padding).toBe('8px 12px');
  });

  it('has no frame of its own inside a host toolbar', () => {
    const { container } = render(<FilterBar columns={columns} filters={[]} onFiltersChange={() => {}} bare />);
    const bar = container.querySelector('.dt-filter-bar') as HTMLElement;
    expect(bar.classList.contains('dt-filter-bar-bare')).toBe(true);
    expect(bar.style.padding).toBe('0px');
    expect(bar.style.borderBottomStyle).toBe('none');
    expect(bar.textContent).toContain('Add filter');
  });
});
