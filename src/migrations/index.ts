import * as migration_20261001_232313_initial from './20261001_232313_initial';

export const migrations = [
  {
    up: migration_20261001_232313_initial.up,
    down: migration_20261001_232313_initial.down,
    name: '20261001_232313_initial'
  },
];
