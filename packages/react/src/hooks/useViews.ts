import { useState, useCallback, useEffect } from 'react';
import type {
  View,
  ViewType,
  CreateViewInput,
  UpdateViewInput,
} from '@marlinjai/data-table-core';
import { useDbAdapter } from '../providers/DataTableProvider';

export interface UseViewsOptions {
  tableId: string;
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

export function useViews({ tableId }: UseViewsOptions): UseViewsResult {
  const dbAdapter = useDbAdapter();
  const [views, setViews] = useState<View[]>([]);
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchViews = useCallback(async () => {
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
    fetchViews();
  }, [tableId]); // Only refetch when tableId changes, not on every fetchViews change

  const createView = useCallback(
    async (input: Omit<CreateViewInput, 'tableId'>) => {
      const view = await dbAdapter.createView({ ...input, tableId });
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
    [dbAdapter, tableId]
  );

  const updateView = useCallback(
    async (viewId: string, updates: UpdateViewInput) => {
      const view = await dbAdapter.updateView(viewId, updates);
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
    [dbAdapter]
  );

  const deleteView = useCallback(
    async (viewId: string) => {
      await dbAdapter.deleteView(viewId);
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
    [dbAdapter, currentViewId]
  );

  const reorderViews = useCallback(
    async (viewIds: string[]) => {
      await dbAdapter.reorderViews(tableId, viewIds);
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
    [dbAdapter, tableId]
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
