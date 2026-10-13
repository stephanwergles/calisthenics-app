import * as migration_20261001_232313_initial from './20261001_232313_initial';
import * as migration_20261002_123616_sync_fields from './20261002_123616_sync_fields';
import * as migration_20261012_121337_session_note from './20261012_121337_session_note';
import * as migration_20261012_122912_exercise_coaching from './20261012_122912_exercise_coaching';
import * as migration_20261012_133753_progression_region from './20261012_133753_progression_region';
import * as migration_20261012_154049_session_deleted from './20261012_154049_session_deleted';
import * as migration_20261013_193014_add_user_roles from './20261013_193014_add_user_roles';
import * as migration_20261013_202958_user_consent from './20261013_202958_user_consent';
import * as migration_20261013_203657_user_plans from './20261013_203657_user_plans';
import * as migration_20261013_205009_session_adjust from './20261013_205009_session_adjust';
import * as migration_20261013_211919_user_profile from './20261013_211919_user_profile';
import * as migration_20261013_212741_user_phases from './20261013_212741_user_phases';

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
    name: '20261012_133753_progression_region',
  },
  {
    up: migration_20261012_154049_session_deleted.up,
    down: migration_20261012_154049_session_deleted.down,
    name: '20261012_154049_session_deleted',
  },
  {
    up: migration_20261013_193014_add_user_roles.up,
    down: migration_20261013_193014_add_user_roles.down,
    name: '20261013_193014_add_user_roles',
  },
  {
    up: migration_20261013_202958_user_consent.up,
    down: migration_20261013_202958_user_consent.down,
    name: '20261013_202958_user_consent',
  },
  {
    up: migration_20261013_203657_user_plans.up,
    down: migration_20261013_203657_user_plans.down,
    name: '20261013_203657_user_plans',
  },
  {
    up: migration_20261013_205009_session_adjust.up,
    down: migration_20261013_205009_session_adjust.down,
    name: '20261013_205009_session_adjust',
  },
  {
    up: migration_20261013_211919_user_profile.up,
    down: migration_20261013_211919_user_profile.down,
    name: '20261013_211919_user_profile',
  },
  {
    up: migration_20261013_212741_user_phases.up,
    down: migration_20261013_212741_user_phases.down,
    name: '20261013_212741_user_phases'
  },
];
