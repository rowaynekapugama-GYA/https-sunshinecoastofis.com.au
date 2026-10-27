import * as migration_20261027_033243_initial from './20261027_033243_initial';

export const migrations = [
  {
    up: migration_20261027_033243_initial.up,
    down: migration_20261027_033243_initial.down,
    name: '20261027_033243_initial'
  },
];
