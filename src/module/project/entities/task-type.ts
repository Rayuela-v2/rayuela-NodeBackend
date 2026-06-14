/**
 * Task type stored on a project.
 *
 * Historically a task type was just its name (`string`). It is being migrated
 * to a richer object carrying a description (which may embed an external link).
 * Existing projects still persist the legacy `string` form, so the value is a
 * union and every consumer must accept both shapes.
 */
export interface TaskType {
  name: string;
  description?: string;
}

// Retrocompatibility: the `string` arm must stay until every existing project
// in the database is migrated from the legacy plain-name form to the object
// form. Removing it would break reads of old documents (and their gamification
// rules), which still store task types as bare strings. Drop `string` only once
// a data migration has backfilled all projects to the object form.
export type TaskTypeValue = string | TaskType;

/**
 * Resolve the display name of a task type regardless of which form it takes.
 * Use this instead of inlining `typeof t === 'string' ? t : t.name` so the
 * legacy/object handling lives in one place during the migration.
 */
export function getTaskTypeName(value: TaskTypeValue): string {
  return typeof value === 'string' ? value : value?.name;
}
