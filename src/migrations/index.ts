import * as migration_20261001_232313_initial from './20261001_232313_initial';
import * as migration_20261002_123616_sync_fields from './20261002_123616_sync_fields';

export const migrations = [
  {
    up: migration_20261001_232313_initial.up,
    down: migration_20261001_232313_initial.down,
    name: '20261001_232313_initial',
  },
  {
    up: migration_20261002_123616_sync_fields.up,
    down: migration_20261002_123616_sync_fields.down,
    name: '20261002_123616_sync_fields'
  },
];
