#!/usr/bin/env node
// tools/cost-tracker.mjs
// AI Build Cost Tracker — tracks AI usage costs per project/feature
// Usage: node tools/cost-tracker.mjs <project-dir> <command> [args]
//   Commands: log <label> <input_tokens> <output_tokens> [--model=X] | show | summary | reset
// Safe: reads/writes .ultraship/cost-history.json only

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

// Pricing per 1M tokens (USD)
const PRICING = {
  'claude-opus-4-6':   { input: 15,    output: 75 },
  'claude-sonnet-4-6': { input: 3,     output: 15 },
  'claude-haiku-4-5':  { input: 0.80,  output: 4 },
  'gpt-4o':            { input: 2.50,  output: 10 },
  'gpt-4o-mini':       { input: 0.15,  output: 0.60 },
  'gpt-4.1':           { input: 2.00,  output: 8.00 },
  'gpt-4.1-mini':      { input: 0.40,  output: 1.60 },
  'gemini-2.5-pro':    { input: 1.25,  output: 10 },
  'gemini-2.5-flash':  { input: 0.15,  output: 0.60 },
};

function calcCost(model, inputTokens, outputTokens) {
  const p = PRICING[model] || PRICING['claude-opus-4-6'];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

function readHistory(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return []; }
}

function saveHistory(path, entries, ultraDir) {
  if (!existsSync(ultraDir)) mkdirSync(ultraDir, { mode: 0o700, recursive: true });
  if (entries.length > 1000) entries = entries.slice(-1000);
  writeFileSync(path, JSON.stringify(entries, null, 2), { mode: 0o600 });
}

function generateInsights(entries) {
  const insights = [];
  if (entries.length === 0) return insights;

  const byLabel = {};
  for (const e of entries) {
    if (!byLabel[e.label]) byLabel[e.label] = { cost: 0, count: 0 };
    byLabel[e.label].cost += e.cost_usd;
    byLabel[e.label].count++;
  }

  const totalCost = entries.reduce((s, e) => s + e.cost_usd, 0);
  const avgCost = totalCost / Object.keys(byLabel).length;

  // Expensive tasks
  for (const [label, data] of Object.entries(byLabel)) {
    if (data.cost > avgCost * 3 && data.cost > 5) {
      insights.push(`"${label}" cost $${data.cost.toFixed(2)} — ${(data.cost / avgCost).toFixed(1)}x above average. Consider breaking into smaller tasks.`);
    }
  }

  // Debug spend
  const debugCost = Object.entries(byLabel).filter(([l]) => /bug|fix|debug|error/i.test(l)).reduce((s, [, d]) => s + d.cost, 0);
  if (debugCost > totalCost * 0.3 && totalCost > 10) {
    insights.push(`Debugging costs ${Math.round(debugCost / totalCost * 100)}% of your budget ($${debugCost.toFixed(2)}). Consider investing in more tests upfront.`);
  }

  // Model optimization
  const byModel = {};
  for (const e of entries) {
    if (!byModel[e.model]) byModel[e.model] = 0;
    byModel[e.model] += e.cost_usd;
  }
  if (byModel['claude-opus-4-6'] > 20) {
    const sonnetSavings = byModel['claude-opus-4-6'] * 0.8;
    insights.push(`Using Sonnet instead of Opus for routine tasks could save ~$${sonnetSavings.toFixed(2)}.`);
  }

  // Daily spend warning
  const today = new Date().toISOString().split('T')[0];
  const todayCost = entries.filter(e => e.timestamp.startsWith(today)).reduce((s, e) => s + e.cost_usd, 0);
  if (todayCost > 20) {
    insights.push(`Today's spend is $${todayCost.toFixed(2)} — high usage day.`);
  }

  return insights;
}

function buildSummary(entries) {
  const totalCost = entries.reduce((s, e) => s + e.cost_usd, 0);
  const totalInput = entries.reduce((s, e) => s + e.input_tokens, 0);
  const totalOutput = entries.reduce((s, e) => s + e.output_tokens, 0);

  const byLabel = {};
  for (const e of entries) {
    if (!byLabel[e.label]) byLabel[e.label] = { cost_usd: 0, entries: 0 };
    byLabel[e.label].cost_usd += e.cost_usd;
    byLabel[e.label].entries++;
  }
  // Round values
  for (const v of Object.values(byLabel)) v.cost_usd = Math.round(v.cost_usd * 100) / 100;

  const byModel = {};
  for (const e of entries) {
    if (!byModel[e.model]) byModel[e.model] = { cost_usd: 0, entries: 0 };
    byModel[e.model].cost_usd += e.cost_usd;
    byModel[e.model].entries++;
  }
  for (const v of Object.values(byModel)) v.cost_usd = Math.round(v.cost_usd * 100) / 100;

  const labelEntries = Object.entries(byLabel).sort((a, b) => b[1].cost_usd - a[1].cost_usd);
  const mostExpensive = labelEntries[0] ? { label: labelEntries[0][0], cost_usd: labelEntries[0][1].cost_usd } : null;
  const cheapest = labelEntries.length > 1 ? { label: labelEntries[labelEntries.length - 1][0], cost_usd: labelEntries[labelEntries.length - 1][1].cost_usd } : null;

  // Daily costs (last 30 days)
  const dailyCosts = {};
  for (const e of entries) {
    const day = e.timestamp.split('T')[0];
    if (!dailyCosts[day]) dailyCosts[day] = { date: day, cost_usd: 0, entries: 0 };
    dailyCosts[day].cost_usd += e.cost_usd;
    dailyCosts[day].entries++;
  }
  const dailyArr = Object.values(dailyCosts).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  for (const d of dailyArr) d.cost_usd = Math.round(d.cost_usd * 100) / 100;

  return {
    total_entries: entries.length,
    total_cost_usd: Math.round(totalCost * 100) / 100,
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    by_label: byLabel,
    by_model: byModel,
    avg_cost_per_task: labelEntries.length > 0 ? Math.round(totalCost / labelEntries.length * 100) / 100 : 0,
    most_expensive_task: mostExpensive,
    cheapest_task: cheapest,
    daily_costs: dailyArr,
    insights: generateInsights(entries),
  };
}

function main() {
  const args = process.argv.slice(2);
  const dir = args[0];
  const command = args[1];

  if (!dir || !command) {
    output({ error: 'Usage: node cost-tracker.mjs <project-dir> <log|show|summary|reset> [args]', success: false });
    process.exit(0);
  }
  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  const ultraDir = join(dir, '.ultraship');
  const historyPath = join(ultraDir, 'cost-history.json');

  if (command === 'log') {
    const label = args[2];
    const inputTokens = parseInt(args[3]);
    const outputTokens = parseInt(args[4]);
    const modelFlag = args.find(a => a.startsWith('--model='));
    const model = modelFlag ? modelFlag.replace('--model=', '') : 'claude-opus-4-6';

    if (!label || isNaN(inputTokens) || isNaN(outputTokens) || inputTokens < 0 || outputTokens < 0) {
      output({ error: 'Usage: node cost-tracker.mjs <dir> log <label> <input_tokens> <output_tokens> [--model=X]', success: false });
      process.exit(0);
    }

    const costUsd = calcCost(model, inputTokens, outputTokens);
    const entry = {
      timestamp: new Date().toISOString(),
      label,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: Math.round(costUsd * 10000) / 10000,
    };

    const entries = readHistory(historyPath);
    entries.push(entry);
    saveHistory(historyPath, entries, ultraDir);

    output({ success: true, logged: entry, total_entries: entries.length });

  } else if (command === 'show') {
    const entries = readHistory(historyPath);
    output({ success: true, entries, summary: buildSummary(entries) });

  } else if (command === 'summary') {
    const entries = readHistory(historyPath);
    output({ success: true, summary: buildSummary(entries) });

  } else if (command === 'reset') {
    saveHistory(historyPath, [], ultraDir);
    output({ success: true, message: 'Cost history cleared' });

  } else {
    output({ error: `Unknown command: ${command}. Use: log, show, summary, reset`, success: false });
  }

  process.exit(0);
}

main();
