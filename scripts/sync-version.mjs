#!/usr/bin/env node
/**
 * Syncs version from package.json to plugin.json and marketplace.json.
 * Runs automatically via npm "version" lifecycle script.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(root, 'package.json');
const pluginPath = resolve(root, '.claude-plugin/plugin.json');
const marketplacePath = resolve(root, '.claude-plugin/marketplace.json');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

const plugin = JSON.parse(readFileSync(pluginPath, 'utf8'));
plugin.version = version;
writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + '\n');

const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8'));
marketplace.plugins[0].version = version;
writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + '\n');

console.log(`Synced version ${version} to plugin.json and marketplace.json`);
