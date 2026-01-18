import { useState, useCallback, useRef } from 'react';

export type DropPosition = 'before' | 'after';

export interface DragState {
  draggingId: string | null;
  dragOverId: string | null;
  dropPosition: DropPosition | null;
}

export interface UseDragAndDropOptions {
  onReorder?: (itemId: string, newPosition: number) => void;
  items: { id: string }[];
  isDisabled?: boolean;
}

export interface UseDragAndDropResult {
  dragState: DragState;
  isDragging: boolean;
  handlers: {
    onDragStart: (e: React.DragEvent, itemId: string) => void;
    onDragOver: (e: React.DragEvent, itemId: string) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, itemId: string) => void;
    onDragLeave: (e: React.DragEvent) => void;
  };
  getDragProps: (itemId: string) => {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
  };
  isItemDragging: (itemId: string) => boolean;
  isDropTarget: (itemId: string) => boolean;
  getDropPosition: (itemId: string) => DropPosition | null;
}

export function useDragAndDrop({
  onReorder,
  items,
  isDisabled = false,
}: UseDragAndDropOptions): UseDragAndDropResult {
  const [dragState, setDragState] = useState<DragState>({
    draggingId: null,
    dragOverId: null,
    dropPosition: null,
  });

  // Track the drag image element for cleanup
  const dragImageRef = useRef<HTMLElement | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, itemId: string) => {
      if (isDisabled) {
        e.preventDefault();
        return;
      }

      // Set drag data
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', itemId);

      // Create a custom drag image (optional - uses default if not set)
      const target = e.currentTarget as HTMLElement;
      if (target) {
        // Clone the element for drag image
        const clone = target.cloneNode(true) as HTMLElement;
        clone.style.position = 'absolute';
        clone.style.top = '-1000px';
        clone.style.opacity = '0.8';
        clone.style.transform = 'scale(0.95)';
        document.body.appendChild(clone);
        e.dataTransfer.setDragImage(clone, 0, 0);
        dragImageRef.current = clone;

        // Remove clone after drag starts
        requestAnimationFrame(() => {
          if (dragImageRef.current) {
            document.body.removeChild(dragImageRef.current);
            dragImageRef.current = null;
          }
        });
      }

      setDragState({
        draggingId: itemId,
        dragOverId: null,
        dropPosition: null,
      });
    },
    [isDisabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, itemId: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (isDisabled || dragState.draggingId === itemId) {
        return;
      }

      e.dataTransfer.dropEffect = 'move';

      // Calculate drop position based on mouse position within the element
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      const dropPosition: DropPosition = e.clientX < midpoint ? 'before' : 'after';

      setDragState((prev) => ({
        ...prev,
        dragOverId: itemId,
        dropPosition,
      }));
    },
    [isDisabled, dragState.draggingId]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only clear if we're leaving the element entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;

    if (!currentTarget.contains(relatedTarget)) {
      setDragState((prev) => ({
        ...prev,
        dragOverId: null,
        dropPosition: null,
      }));
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();

      const { draggingId, dropPosition } = dragState;

      if (isDisabled || !draggingId || draggingId === targetId || !onReorder) {
        setDragState({
          draggingId: null,
          dragOverId: null,
          dropPosition: null,
        });
        return;
      }

      // Calculate new position
      const itemIds = items.map((item) => item.id);
      const dragIndex = itemIds.indexOf(draggingId);
      let targetIndex = itemIds.indexOf(targetId);

      if (dragIndex === -1 || targetIndex === -1) {
        setDragState({
          draggingId: null,
          dragOverId: null,
          dropPosition: null,
        });
        return;
      }

      // Adjust target index based on drop position
      if (dropPosition === 'after') {
        targetIndex += 1;
      }

      // Adjust for the removal of the dragged item
      if (dragIndex < targetIndex) {
        targetIndex -= 1;
      }

      // Call the reorder callback
      onReorder(draggingId, targetIndex);

      setDragState({
        draggingId: null,
        dragOverId: null,
        dropPosition: null,
      });
    },
    [dragState, isDisabled, items, onReorder]
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    // Cleanup drag image if it still exists
    if (dragImageRef.current) {
      try {
        document.body.removeChild(dragImageRef.current);
      } catch {
        // Element may already be removed
      }
      dragImageRef.current = null;
    }

    setDragState({
      draggingId: null,
      dragOverId: null,
      dropPosition: null,
    });
  }, []);

  const getDragProps = useCallback(
    (itemId: string) => ({
      draggable: !isDisabled,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, itemId),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, itemId),
      onDragEnd: handleDragEnd,
      onDrop: (e: React.DragEvent) => handleDrop(e, itemId),
      onDragLeave: handleDragLeave,
    }),
    [isDisabled, handleDragStart, handleDragOver, handleDragEnd, handleDrop, handleDragLeave]
  );

  const isItemDragging = useCallback(
    (itemId: string) => dragState.draggingId === itemId,
    [dragState.draggingId]
  );

  const isDropTarget = useCallback(
    (itemId: string) => dragState.dragOverId === itemId && dragState.draggingId !== itemId,
    [dragState.dragOverId, dragState.draggingId]
  );

  const getDropPosition = useCallback(
    (itemId: string): DropPosition | null => {
      if (dragState.dragOverId === itemId && dragState.draggingId !== itemId) {
        return dragState.dropPosition;
      }
      return null;
    },
    [dragState.dragOverId, dragState.draggingId, dragState.dropPosition]
  );

  return {
    dragState,
    isDragging: dragState.draggingId !== null,
    handlers: {
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDrop: handleDrop,
      onDragLeave: handleDragLeave,
    },
    getDragProps,
    isItemDragging,
    isDropTarget,
    getDropPosition,
  };
}
