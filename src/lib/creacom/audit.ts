export function commercialAuditChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[]
): { field_name: string; old_value: unknown; new_value: unknown }[] {
  return fields.flatMap((field) => {
    const oldValue = before[field] ?? null;
    const newValue = after[field] ?? null;
    return JSON.stringify(oldValue) === JSON.stringify(newValue)
      ? []
      : [{ field_name: field, old_value: oldValue, new_value: newValue }];
  });
}
