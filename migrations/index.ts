import * as migration_20261027_033243_initial from './20261027_033243_initial';
import * as migration_20261102_000001_seo_compliance_content from './20261102_000001_seo_compliance_content';
import * as migration_20261102_000002_blog_menu from './20261102_000002_blog_menu';

export const migrations = [
  {
    up: migration_20261027_033243_initial.up,
    down: migration_20261027_033243_initial.down,
    name: '20261027_033243_initial'
  },
  {
    up: migration_20261102_000001_seo_compliance_content.up,
    down: migration_20261102_000001_seo_compliance_content.down,
    name: '20261102_000001_seo_compliance_content'
  },
  {
    up: migration_20261102_000002_blog_menu.up,
    down: migration_20261102_000002_blog_menu.down,
    name: '20261102_000002_blog_menu'
  },
];
