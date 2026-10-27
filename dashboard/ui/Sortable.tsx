'use client';
import React from 'react';
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icons } from './Icons';

/** Vertical drag-to-reorder list. `ids` must be stable per row. */
export function SortableList<T>({ items, getId, onReorder, children }: { items: T[]; getId: (item: T, index: number) => string; onReorder: (next: T[]) => void; children: (item: T, index: number) => React.ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = items.map(getId);
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((it, i) => (
          <SortableRow key={ids[i]} id={ids[i]}>
            {children(it, i)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

const HandleCtx = React.createContext<{ attributes: any; listeners: any; isDragging: boolean }>({ attributes: {}, listeners: {}, isDragging: false });

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 5 : undefined };
  return (
    <div ref={setNodeRef} style={style}>
      <HandleCtx.Provider value={{ attributes, listeners, isDragging }}>{children}</HandleCtx.Provider>
    </div>
  );
}

/** The six-dot grip. Place inside a SortableList row. */
export function DragHandle({ label = 'Drag to reorder' }: { label?: string }) {
  const { attributes, listeners } = React.useContext(HandleCtx);
  const Grip = Icons.drag;
  return (
    <button type="button" className="d-handle" aria-label={label} title={label} {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
      <Grip width={18} height={18} />
    </button>
  );
}
export const useDragging = () => React.useContext(HandleCtx).isDragging;
