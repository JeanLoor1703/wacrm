import { expect, it } from 'vitest';
import { commercialAuditChanges } from './audit';

it('records only changed allowlisted fields with old and new values', () => {
  expect(
    commercialAuditChanges(
      { work_type: 'Losa', secret: 'x' },
      { work_type: 'Galpón', secret: 'y' },
      ['work_type']
    )
  ).toEqual([
    { field_name: 'work_type', old_value: 'Losa', new_value: 'Galpón' },
  ]);
});
