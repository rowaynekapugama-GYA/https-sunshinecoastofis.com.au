/** Shared between the dashboard's visual editor and the /edit-preview/ route. */
export const DRAFT_KEY = (id: string | number) => `page-draft-${id}`;
export const PREVIEW_ROUTE = (id: string | number) => `/edit-preview/${id}/`;
