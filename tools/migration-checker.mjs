#!/usr/bin/env node
// tools/migration-checker.mjs
// Checks for pending database migrations (Drizzle, Prisma, Knex)
// Usage: node tools/migration-checker.mjs <project-directory>
// Safe: reads files only, no shell execution

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { findWorkspacePackages } from './lib/monorepo.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function detectOrm(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (allDeps['drizzle-orm'] || allDeps['drizzle-kit']) return 'drizzle';
  if (allDeps['prisma'] || allDeps['@prisma/client']) return 'prisma';
  if (allDeps['knex']) return 'knex';
  if (allDeps['typeorm']) return 'typeorm';
  if (allDeps['sequelize']) return 'sequelize';
  if (allDeps['mongoose']) return 'mongoose';
  return null;
}

function checkDrizzle(dir) {
  const findings = [];
  const info = { orm: 'drizzle', migration_dir: null, schema_files: [], migrations: [] };

  // Find drizzle config
  const configNames = ['drizzle.config.ts', 'drizzle.config.js', 'drizzle.config.mjs'];
  let configPath = null;
  for (const name of configNames) {
    const p = join(dir, name);
    if (existsSync(p)) { configPath = p; break; }
  }

  if (!configPath) {
    findings.push({ severity: 'high', message: 'No drizzle.config found — migrations may not be configured' });
  } else {
    const config = readFileSync(configPath, 'utf8');
    // Extract out dir
    const outMatch = config.match(/out\s*:\s*['"]([^'"]+)['"]/);
    if (outMatch) info.migration_dir = outMatch[1];
  }

  // Find migration directory
  const migrationDirs = [info.migration_dir, 'drizzle', 'migrations', 'db/migrations'].filter(Boolean);
  let migDir = null;
  for (const d of migrationDirs) {
    const p = join(dir, d);
    if (existsSync(p) && statSync(p).isDirectory()) { migDir = p; info.migration_dir = d; break; }
  }

  if (migDir) {
    // List migration files
    const files = readdirSync(migDir).filter(f => f.endsWith('.sql') || f.endsWith('.ts') || f.endsWith('.js'));
    info.migrations = files.map(f => {
      const s = statSync(join(migDir, f));
      return { name: f, modified: s.mtime.toISOString().split('T')[0] };
    });
    info.migration_count = files.length;

    // Check for journal (Drizzle tracks applied migrations)
    const journalPath = join(migDir, 'meta', '_journal.json');
    if (existsSync(journalPath)) {
      try {
        const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
        info.applied_count = journal.entries ? journal.entries.length : 0;
        if (info.migration_count > info.applied_count) {
          findings.push({
            severity: 'critical',
            message: `${info.migration_count - info.applied_count} pending migrations not yet applied — run: npx drizzle-kit push`,
          });
        }
      } catch { /* ignore */ }
    }
  } else {
    findings.push({ severity: 'medium', message: 'No migration directory found — run: npx drizzle-kit generate' });
  }

  // Find schema files
  const schemaPatterns = ['schema.ts', 'schema.js', 'db/schema.ts', 'src/db/schema.ts', 'src/schema.ts'];
  for (const pattern of schemaPatterns) {
    const p = join(dir, pattern);
    if (existsSync(p)) info.schema_files.push(pattern);
  }
  // Also search for schema directory
  const schemaDirs = ['src/db', 'db', 'src/schema'];
  for (const d of schemaDirs) {
    const p = join(dir, d);
    if (existsSync(p) && statSync(p).isDirectory()) {
      const files = readdirSync(p).filter(f => f.includes('schema') && (f.endsWith('.ts') || f.endsWith('.js')));
      for (const f of files) info.schema_files.push(join(d, f));
    }
  }

  if (info.schema_files.length === 0) {
    findings.push({ severity: 'high', message: 'No schema files found — Drizzle ORM needs schema definitions' });
  }

  return { ...info, findings };
}

function checkPrisma(dir) {
  const findings = [];
  const info = { orm: 'prisma', schema_file: null, migrations: [] };

  // Find prisma schema
  const schemaPaths = ['prisma/schema.prisma', 'schema.prisma'];
  for (const p of schemaPaths) {
    const full = join(dir, p);
    if (existsSync(full)) { info.schema_file = p; break; }
  }

  if (!info.schema_file) {
    findings.push({ severity: 'critical', message: 'No prisma/schema.prisma found' });
    return { ...info, findings };
  }

  // Check migrations directory
  const migDir = join(dir, 'prisma/migrations');
  if (existsSync(migDir) && statSync(migDir).isDirectory()) {
    const dirs = readdirSync(migDir).filter(f => {
      const p = join(migDir, f);
      return statSync(p).isDirectory() && f !== '_lock';
    });
    info.migrations = dirs.map(d => ({ name: d }));
    info.migration_count = dirs.length;
  } else {
    findings.push({ severity: 'medium', message: 'No prisma migrations directory — run: npx prisma migrate dev' });
  }

  // Check for Prisma client generation
  const nodeModulesPrisma = join(dir, 'node_modules/.prisma/client');
  if (!existsSync(nodeModulesPrisma)) {
    findings.push({ severity: 'high', message: 'Prisma client not generated — run: npx prisma generate' });
  }

  return { ...info, findings };
}

function checkKnex(dir) {
  const findings = [];
  const info = { orm: 'knex', migration_dir: null, migrations: [] };

  // Find knexfile
  const knexfileNames = ['knexfile.js', 'knexfile.ts', 'knexfile.mjs'];
  let knexfilePath = null;
  for (const name of knexfileNames) {
    const p = join(dir, name);
    if (existsSync(p)) { knexfilePath = p; break; }
  }

  if (!knexfilePath) {
    findings.push({ severity: 'medium', message: 'No knexfile found — migration config may be inline' });
  }

  // Check common migration directories
  const migDirs = ['migrations', 'db/migrations', 'src/migrations'];
  for (const d of migDirs) {
    const p = join(dir, d);
    if (existsSync(p) && statSync(p).isDirectory()) {
      info.migration_dir = d;
      const files = readdirSync(p).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
      info.migrations = files.map(f => ({ name: f }));
      info.migration_count = files.length;
      break;
    }
  }

  if (!info.migration_dir) {
    findings.push({ severity: 'medium', message: 'No migrations directory found — run: npx knex migrate:make initial' });
  }

  return { ...info, findings };
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    output({ error: 'Usage: node migration-checker.mjs <project-directory>', success: false });
    process.exit(0);
  }

  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  // Scan all workspace packages in monorepos
  const packages = findWorkspacePackages(dir);
  const results = [];

  for (const pkgDir of packages) {
    const orm = detectOrm(pkgDir);
    if (!orm) continue;

    let result;
    switch (orm) {
      case 'drizzle': result = checkDrizzle(pkgDir); break;
      case 'prisma': result = checkPrisma(pkgDir); break;
      case 'knex': result = checkKnex(pkgDir); break;
      default:
        result = {
          orm,
          findings: [{ severity: 'info', message: `${orm} detected but migration checking not yet supported — only Drizzle, Prisma, and Knex are supported` }],
        };
    }

    const label = pkgDir === dir ? '(root)' : relative(dir, pkgDir);
    result.package = label;
    results.push(result);
  }

  if (results.length === 0) {
    output({
      success: true,
      orm: null,
      message: 'No supported ORM detected (Drizzle, Prisma, Knex, TypeORM, Sequelize)',
      findings: [],
    });
    process.exit(0);
  }

  const allFindings = results.flatMap(r => r.findings.map(f => ({ ...f, package: r.package })));
  const deploy_safe = allFindings.filter(f => f.severity === 'critical').length === 0;

  output({
    success: true,
    packages_with_orm: results.length,
    deploy_safe,
    results,
    findings: allFindings,
  });
}

main();
