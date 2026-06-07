import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  View,
  ViewType,
  CreateViewInput,
  UpdateViewInput,
} from '@marlinjai/data-table-core';
import { useDbAdapter, useActions } from '../providers/DataTableProvider';

export interface UseViewsOptions {
  tableId: string;
  initialViews?: View[];
}

export interface UseViewsResult {
  views: View[];
  currentView: View | null;
  isLoading: boolean;
  error: Error | null;

  // Operations
  createView: (input: Omit<CreateViewInput, 'tableId'>) => Promise<View>;
  updateView: (viewId: string, updates: UpdateViewInput) => Promise<View>;
  deleteView: (viewId: string) => Promise<void>;
  reorderViews: (viewIds: string[]) => Promise<void>;
  setCurrentView: (viewId: string) => void;
  refresh: () => Promise<void>;
}

export function useViews({ tableId, initialViews }: UseViewsOptions): UseViewsResult {
  const dbAdapter = useDbAdapter();
  const actions = useActions();
  const hasInitialViews = initialViews !== undefined;

  // Compute initial currentViewId from initialViews
  const computeDefaultViewId = (views: View[]): string | null => {
    if (views.length === 0) return null;
    const defaultView = views.find((v) => v.isDefault) ?? views[0];
    return defaultView?.id ?? null;
  };

  const [views, setViews] = useState<View[]>(initialViews ?? []);
  const [currentViewId, setCurrentViewId] = useState<string | null>(
    hasInitialViews ? computeDefaultViewId(initialViews!) : null
  );
  const [isLoading, setIsLoading] = useState(!hasInitialViews);
  const [error, setError] = useState<Error | null>(null);
  // Track whether we've consumed initialViews to avoid re-fetching on mount
  const initialDataConsumed = useRef(hasInitialViews);

  const fetchViews = useCallback(async () => {
    if (!dbAdapter) {
      // No adapter available — can't fetch
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const result = await dbAdapter.getViews(tableId);
      setViews(result);

      // Set the default view as current if no current view is set
      // or if the current view no longer exists
      if (!currentViewId || !result.find((v) => v.id === currentViewId)) {
        const defaultView = result.find((v) => v.isDefault) ?? result[0];
        if (defaultView) {
          setCurrentViewId(defaultView.id);
        } else {
          setCurrentViewId(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch views'));
    } finally {
      setIsLoading(false);
    }
  }, [dbAdapter, tableId, currentViewId]);

  useEffect(() => {
    // Skip initial fetch if we already have initialViews
    if (initialDataConsumed.current) {
      initialDataConsumed.current = false;
      return;
    }
    fetchViews();
  }, [tableId]); // Only refetch when tableId changes, not on every fetchViews change

  const createView = useCallback(
    async (input: Omit<CreateViewInput, 'tableId'>) => {
      const createFn = actions?.createView
        ?? (dbAdapter ? (i: CreateViewInput) => dbAdapter.createView(i) : undefined);
      if (!createFn) throw new Error('No createView action or dbAdapter available');
      const view = await createFn({ ...input, tableId });
      setViews((prev) => {
        // If the new view is default, update other views
        if (view.isDefault) {
          return [...prev.map((v) => ({ ...v, isDefault: false })), view];
        }
        return [...prev, view];
      });
      // Switch to the newly created view
      setCurrentViewId(view.id);
      return view;
    },
    [actions, dbAdapter, tableId]
  );

  const updateView = useCallback(
    async (viewId: string, updates: UpdateViewInput) => {
      const updateFn = actions?.updateView
        ?? (dbAdapter ? (id: string, u: UpdateViewInput) => dbAdapter.updateView(id, u) : undefined);
      if (!updateFn) throw new Error('No updateView action or dbAdapter available');
      const view = await updateFn(viewId, updates);
      setViews((prev) => {
        // If the updated view is now default, update other views
        if (view.isDefault) {
          return prev.map((v) =>
            v.id === viewId ? view : { ...v, isDefault: false }
          );
        }
        return prev.map((v) => (v.id === viewId ? view : v));
      });
      return view;
    },
    [actions, dbAdapter]
  );

  const deleteView = useCallback(
    async (viewId: string) => {
      const deleteFn = actions?.deleteView
        ?? (dbAdapter ? (id: string) => dbAdapter.deleteView(id) : undefined);
      if (!deleteFn) throw new Error('No deleteView action or dbAdapter available');
      await deleteFn(viewId);
      setViews((prev) => {
        const remaining = prev.filter((v) => v.id !== viewId);
        // If we deleted the current view, switch to the default or first view
        if (viewId === currentViewId && remaining.length > 0) {
          const newDefault = remaining.find((v) => v.isDefault) ?? remaining[0];
          setCurrentViewId(newDefault.id);
        } else if (remaining.length === 0) {
          setCurrentViewId(null);
        }
        return remaining;
      });
    },
    [actions, dbAdapter, currentViewId]
  );

  const reorderViews = useCallback(
    async (viewIds: string[]) => {
      const reorderFn = actions?.reorderViews
        ?? (dbAdapter ? (tId: string, ids: string[]) => dbAdapter.reorderViews(tId, ids) : undefined);
      if (!reorderFn) throw new Error('No reorderViews action or dbAdapter available');
      await reorderFn(tableId, viewIds);
      // Reorder local state
      setViews((prev) => {
        const viewMap = new Map(prev.map((v) => [v.id, v]));
        return viewIds
          .map((id, index) => {
            const view = viewMap.get(id);
            return view ? { ...view, position: index } : null;
          })
          .filter((v): v is View => v !== null);
      });
    },
    [actions, dbAdapter, tableId]
  );

  const setCurrentView = useCallback((viewId: string) => {
    setCurrentViewId(viewId);
  }, []);

  const currentView = views.find((v) => v.id === currentViewId) ?? null;

  return {
    views,
    currentView,
    isLoading,
    error,
    createView,
    updateView,
    deleteView,
    reorderViews,
    setCurrentView,
    refresh: fetchViews,
  };
}
