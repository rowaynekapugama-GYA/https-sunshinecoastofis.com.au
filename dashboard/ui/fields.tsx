'use client';
import React, { useId } from 'react';

export const INLINE_HELP = (
  <>
    Shortcuts: <code>**bold**</code>, <code>{'{{phone}}'}</code> for the practice phone, <code>{'{{email}}'}</code> for the email, <code>[link text](/services/)</code> for a link.
  </>
);

export function Field({ label, help, children, counter }: { label: string; help?: React.ReactNode; children: React.ReactNode; counter?: React.ReactNode }) {
  return (
    <div className="d-field">
      <span className="d-label">
        {label}
        {counter}
      </span>
      {children}
      {help && <div className="d-help">{help}</div>}
    </div>
  );
}

export function Counter({ value, ideal, max }: { value: string; ideal?: number; max: number }) {
  const n = (value || '').length;
  const cls = n > max ? 'over' : ideal && n && n < ideal ? 'short' : '';
  return (
    <span className={`d-counter ${cls}`}>
      {n} / {max}
    </span>
  );
}

export function TextInput({ label, value, onChange, help, placeholder, type = 'text', readOnly, counter }: { label: string; value: string; onChange: (v: string) => void; help?: React.ReactNode; placeholder?: string; type?: string; readOnly?: boolean; counter?: { ideal?: number; max: number } }) {
  const id = useId();
  return (
    <div className="d-field">
      <label htmlFor={id}>
        {label}
        {counter && <Counter value={value} {...counter} />}
      </label>
      <input id={id} className="d-input" type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly} />
      {help && <div className="d-help">{help}</div>}
    </div>
  );
}

export function TextArea({ label, value, onChange, help, rows = 3, placeholder, counter }: { label: string; value: string; onChange: (v: string) => void; help?: React.ReactNode; rows?: number; placeholder?: string; counter?: { ideal?: number; max: number } }) {
  const id = useId();
  return (
    <div className="d-field">
      <label htmlFor={id}>
        {label}
        {counter && <Counter value={value} {...counter} />}
      </label>
      <textarea id={id} className="d-textarea" rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {help && <div className="d-help">{help}</div>}
    </div>
  );
}

export function Select({ label, value, onChange, options, help, allowEmpty }: { label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; help?: React.ReactNode; allowEmpty?: string }) {
  const id = useId();
  return (
    <div className="d-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="d-select" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {help && <div className="d-help">{help}</div>}
    </div>
  );
}

export function Check({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: React.ReactNode }) {
  const id = useId();
  return (
    <div className="d-field">
      <label className="d-check" htmlFor={id}>
        <input id={id} type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
        <span>
          {label}
          {help && <div className="d-help">{help}</div>}
        </span>
      </label>
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`d-switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export function HelpBox({ children }: { children: React.ReactNode }) {
  return <div className="d-inline-help">{children}</div>;
}

export function Modal({ title, onClose, children, footer, small }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; small?: boolean }) {
  return (
    <div className="d-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`d-modal ${small ? 'sm' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="d-modal-head">
          <h2>{title}</h2>
          <button className="d-btn ghost sm" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div className="d-modal-body">{children}</div>
        {footer && <div className="d-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
