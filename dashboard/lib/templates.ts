import { templates } from '@/lib/content';
import type { TemplateDefs } from '../editors/PageEditor';

/** Section labels and field lists for the editor (the approved HTML itself stays on the server). */
export function templateDefs(): TemplateDefs {
  const out: TemplateDefs = {};
  for (const [k, t] of Object.entries(templates())) {
    out[k] = { label: t.label, fields: t.fields, generated: [...t.html.matchAll(/\{\{@(\w+)\}\}/g)].map((m) => m[1]) };
  }
  return out;
}
