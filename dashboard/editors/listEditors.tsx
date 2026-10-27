'use client';
import React, { useState } from 'react';
import { SortableList, DragHandle } from '../ui/Sortable';
import { Icons } from '../ui/Icons';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 12)).replace(/-/g, '').slice(0, 24);
export const withId = <T extends { id?: string | null }>(row: T): T & { id: string } => ({ ...row, id: row.id || newId() });
const Trash = Icons.trash;
const Plus = Icons.plus;


function RemoveButton({ onClick, label = 'Remove' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="d-btn ghost icon" aria-label={label} title={label} onClick={onClick}>
      <Trash />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Plain list of lines / paragraphs                                    */
/* ------------------------------------------------------------------ */
export type Row = { id: string; value: string };
export function StringListEditor({ value, onChange, itemLabel, rows = 2 }: { value: Row[]; onChange: (v: Row[]) => void; itemLabel: string; rows?: number }) {
  const items = (value || []).map(withId);
  return (
    <div>
      <SortableList items={items} getId={(r) => r.id} onReorder={onChange}>
        {(r, i) => (
          <div className="d-list-item">
            <DragHandle />
            {rows <= 1 ? (
              <input className="d-input" value={r.value} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} aria-label={`${itemLabel} ${i + 1}`} />
            ) : (
              <textarea className="d-textarea" rows={rows} value={r.value} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} aria-label={`${itemLabel} ${i + 1}`} />
            )}
            <RemoveButton onClick={() => onChange(items.filter((_, j) => j !== i))} label={`Remove ${itemLabel.toLowerCase()}`} />
          </div>
        )}
      </SortableList>
      <button type="button" className="d-add" onClick={() => onChange([...items, { id: newId(), value: '' }])}>
        <Plus width={14} height={14} /> Add {itemLabel.toLowerCase()}
      </button>
    </div>
  );
}

