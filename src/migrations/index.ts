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
import * as migration_20261013_222148_feedback from './20261013_222148_feedback';
import * as migration_20261013_222448_catalog_v3 from './20261013_222448_catalog_v3';
import * as migration_20261013_223934_progression_name from './20261013_223934_progression_name';
import * as migration_20261013_224654_templates from './20261013_224654_templates';
import * as migration_20261013_225541_equipment_pole from './20261013_225541_equipment_pole';
import * as migration_20261014_101706_stress_hip_back_ankle from './20261014_101706_stress_hip_back_ankle';
import * as migration_20261014_120000_one_arm_pull_name from './20261014_120000_one_arm_pull_name';
import * as migration_20261014_120602_activity_challenge from './20261014_120602_activity_challenge';

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
    name: '20261013_212741_user_phases',
  },
  {
    up: migration_20261013_222148_feedback.up,
    down: migration_20261013_222148_feedback.down,
    name: '20261013_222148_feedback',
  },
  {
    up: migration_20261013_222448_catalog_v3.up,
    down: migration_20261013_222448_catalog_v3.down,
    name: '20261013_222448_catalog_v3',
  },
  {
    up: migration_20261013_223934_progression_name.up,
    down: migration_20261013_223934_progression_name.down,
    name: '20261013_223934_progression_name',
  },
  {
    up: migration_20261013_224654_templates.up,
    down: migration_20261013_224654_templates.down,
    name: '20261013_224654_templates',
  },
  {
    up: migration_20261013_225541_equipment_pole.up,
    down: migration_20261013_225541_equipment_pole.down,
    name: '20261013_225541_equipment_pole',
  },
  {
    up: migration_20261014_101706_stress_hip_back_ankle.up,
    down: migration_20261014_101706_stress_hip_back_ankle.down,
    name: '20261014_101706_stress_hip_back_ankle',
  },
  {
    up: migration_20261014_120000_one_arm_pull_name.up,
    down: migration_20261014_120000_one_arm_pull_name.down,
    name: '20261014_120000_one_arm_pull_name',
  },
  {
    up: migration_20261014_120602_activity_challenge.up,
    down: migration_20261014_120602_activity_challenge.down,
    name: '20261014_120602_activity_challenge'
  },
];
