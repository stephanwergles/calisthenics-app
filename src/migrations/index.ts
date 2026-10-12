import * as migration_20261001_232313_initial from './20261001_232313_initial';
import * as migration_20261002_123616_sync_fields from './20261002_123616_sync_fields';
import * as migration_20261012_121337_session_note from './20261012_121337_session_note';
import * as migration_20261012_122912_exercise_coaching from './20261012_122912_exercise_coaching';
import * as migration_20261012_133753_progression_region from './20261012_133753_progression_region';

export const migrations = [
  {
    up: migration_20261001_232313_initial.up,
    down: migration_20261001_232313_initial.down,
    name: '20261001_232313_initial',
  },
  {
    up: migration_20261002_123616_sync_fields.up,
    down: migration_20261002_123616_sync_fields.down,
    name: '20261002_123616_sync_fields',
  },
  {
    up: migration_20261012_121337_session_note.up,
    down: migration_20261012_121337_session_note.down,
    name: '20261012_121337_session_note',
  },
  {
    up: migration_20261012_122912_exercise_coaching.up,
    down: migration_20261012_122912_exercise_coaching.down,
    name: '20261012_122912_exercise_coaching',
  },
  {
    up: migration_20261012_133753_progression_region.up,
    down: migration_20261012_133753_progression_region.down,
    name: '20261012_133753_progression_region'
  },
];
