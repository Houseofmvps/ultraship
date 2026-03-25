import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(__dirname, '..', 'tools', 'content-scorer.mjs');

function runScorer(dir, extraArgs = []) {
  const out = execFileSync('node', [TOOL, dir, ...extraArgs], { encoding: 'utf8' });
  return JSON.parse(out);
}

// Generate N words of filler text (simple sentences for predictable readability)
function filler(wordCount) {
  const sentence = 'The quick brown fox jumps over the lazy dog near the river bank. ';
  const words = sentence.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < wordCount; i++) {
    out.push(words[i % words.length]);
  }
  return out.join(' ');
}

describe('content-scorer', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-content-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Test 1: Empty directory ──────────────────────────────────────
  it('returns warning and empty pages array for empty directory', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-content-empty-'));
    try {
      const result = runScorer(emptyDir);
      assert.equal(result.success, true);
      assert.ok(result.warning, 'Should include a warning about no HTML files');
      assert.ok(Array.isArray(result.pages));
      assert.equal(result.pages.length, 0);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  // ── Test 2: Well-structured HTML with good content ───────────────
  it('scores well-structured content highly', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Best Practices Guide</title></head>
<body>
  <h1>Best Practices Guide</h1>
  <h2>How do you get started?</h2>
  <p>${filler(200)}</p>
  <h2>What are the key benefits?</h2>
  <p>${filler(200)}</p>
  <h2>Why does this matter?</h2>
  <p>${filler(200)}</p>
</body>
</html>`;
    fs.writeFileSync(path.join(tmpDir, 'good.html'), html);
    const result = runScorer(tmpDir);
    assert.equal(result.success, true);
    const page = result.pages.find(p => p.file === 'good.html');
    assert.ok(page, 'Should analyze good.html');
    assert.ok(page.content_score >= 80, `Expected high score, got ${page.content_score}`);
    assert.ok(page.word_count >= 500, 'Should count 500+ words');
    assert.ok(page.heading_count >= 4, 'Should detect headings');
    assert.ok(page.h2_count >= 3, 'Should detect H2s');
    assert.ok(page.question_h2_count >= 3, 'Should detect question H2s');
  });

  // ── Test 3: Thin content page (<300 words) ───────────────────────
  it('flags thin content under 300 words as high severity', () => {
    const thinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-content-thin-'));
    try {
      const html = `<!DOCTYPE html>
<html><head><title>Thin</title></head>
<body>
  <h1>Short Page</h1>
  <h2>Section</h2>
  <p>${filler(100)}</p>
</body>
</html>`;
      fs.writeFileSync(path.join(thinDir, 'thin.html'), html);
      const result = runScorer(thinDir);
      const page = result.pages.find(p => p.file === 'thin.html');
      assert.ok(page, 'Should analyze thin.html');
      assert.ok(page.word_count < 300, `Expected <300 words, got ${page.word_count}`);
      const thinFinding = page.findings.find(f => f.type === 'thin_content');
      assert.ok(thinFinding, 'Should have thin_content finding');
      assert.equal(thinFinding.severity, 'high');
    } finally {
      fs.rmSync(thinDir, { recursive: true, force: true });
    }
  });

  // ── Test 4: Readability scoring returns numbers ──────────────────
  it('produces numeric Flesch readability scores', () => {
    const readDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-content-read-'));
    try {
      const html = `<!DOCTYPE html>
<html><head><title>Readability</title></head>
<body>
  <h1>Readability Test</h1>
  <h2>Overview</h2>
  <p>${filler(400)}</p>
</body>
</html>`;
      fs.writeFileSync(path.join(readDir, 'readable.html'), html);
      const result = runScorer(readDir);
      const page = result.pages.find(p => p.file === 'readable.html');
      assert.ok(page, 'Should analyze readable.html');
      assert.equal(typeof page.readability.flesch_reading_ease, 'number');
      assert.equal(typeof page.readability.flesch_kincaid_grade, 'number');
      assert.ok(page.readability.flesch_reading_ease >= 0 && page.readability.flesch_reading_ease <= 100,
        'Flesch reading ease should be 0-100');
      assert.ok(page.readability.flesch_kincaid_grade >= 0,
        'Flesch-Kincaid grade should be non-negative');
      assert.ok(['easy', 'standard', 'difficult', 'very_difficult'].includes(page.readability.rating),
        'Rating should be a valid category');
    } finally {
      fs.rmSync(readDir, { recursive: true, force: true });
    }
  });

  // ── Test 5: Keyword density with --keyword flag ──────────────────
  it('analyzes keyword density when --keyword is provided', () => {
    const kwDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-content-kw-'));
    try {
      const html = `<!DOCTYPE html>
<html><head><title>Retention Software</title></head>
<body>
  <h1>Retention Software Guide</h1>
  <h2>About retention</h2>
  <p>Retention is important for SaaS businesses. Good retention means lower churn.
  Every company needs a retention strategy. Building retention into your product is key.
  Retention helps you grow. Retention matters. ${filler(300)}</p>
</body>
</html>`;
      fs.writeFileSync(path.join(kwDir, 'kw.html'), html);
      const result = runScorer(kwDir, ['--keyword=retention']);
      assert.equal(result.target_keyword, 'retention');
      const page = result.pages.find(p => p.file === 'kw.html');
      assert.ok(page, 'Should analyze kw.html');
      assert.ok(page.keyword_analysis, 'Should include keyword_analysis');
      assert.equal(page.keyword_analysis.keyword, 'retention');
      assert.ok(page.keyword_analysis.count > 0, 'Should find keyword occurrences');
      assert.equal(typeof page.keyword_analysis.density_pct, 'number');
      assert.ok(page.keyword_analysis.total_words > 0);
    } finally {
      fs.rmSync(kwDir, { recursive: true, force: true });
    }
  });

  // ── Test 6: GEO heading detection (question-format H2s) ─────────
  it('detects question-based H2 headings for GEO', () => {
    const geoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-content-geo-'));
    try {
      const html = `<!DOCTYPE html>
<html><head><title>FAQ</title></head>
<body>
  <h1>Frequently Asked Questions</h1>
  <h2>What is churn rate?</h2>
  <p>${filler(150)}</p>
  <h2>How do you reduce churn?</h2>
  <p>${filler(150)}</p>
  <h2>Why is retention important?</h2>
  <p>${filler(150)}</p>
</body>
</html>`;
      fs.writeFileSync(path.join(geoDir, 'faq.html'), html);
      const result = runScorer(geoDir);
      const page = result.pages.find(p => p.file === 'faq.html');
      assert.ok(page, 'Should analyze faq.html');
      assert.equal(page.h2_count, 3);
      assert.equal(page.question_h2_count, 3, 'All 3 H2s should be detected as questions');
      // No geo_headings finding because all H2s are questions
      const geoFinding = page.findings.find(f => f.type === 'geo_headings');
      assert.equal(geoFinding, undefined, 'Should NOT flag geo_headings when questions exist');
    } finally {
      fs.rmSync(geoDir, { recursive: true, force: true });
    }
  });

  // ── Test 7: No headings warning on long content ──────────────────
  it('flags missing headings on content over 200 words', () => {
    const noHDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-content-noh-'));
    try {
      const html = `<!DOCTYPE html>
<html><head><title>Wall of Text</title></head>
<body>
  <p>${filler(400)}</p>
</body>
</html>`;
      fs.writeFileSync(path.join(noHDir, 'noheadings.html'), html);
      const result = runScorer(noHDir);
      const page = result.pages.find(p => p.file === 'noheadings.html');
      assert.ok(page, 'Should analyze noheadings.html');
      assert.equal(page.heading_count, 0);
      const noHeadingsFinding = page.findings.find(f => f.type === 'no_headings');
      assert.ok(noHeadingsFinding, 'Should flag no_headings');
      assert.equal(noHeadingsFinding.severity, 'high');
    } finally {
      fs.rmSync(noHDir, { recursive: true, force: true });
    }
  });

  // ── Test 8: Valid JSON output structure ──────────────────────────
  it('returns valid JSON with all expected top-level fields', () => {
    const jsonDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-content-json-'));
    try {
      const html = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body><h1>Test</h1><h2>Section</h2><p>${filler(350)}</p></body>
</html>`;
      fs.writeFileSync(path.join(jsonDir, 'test.html'), html);
      const result = runScorer(jsonDir);
      // Top-level fields
      assert.equal(result.success, true);
      assert.equal(typeof result.pages_analyzed, 'number');
      assert.equal(typeof result.total_findings, 'number');
      assert.equal(typeof result.average_content_score, 'number');
      assert.ok(Array.isArray(result.pages));
      assert.ok(result.pages.length > 0);
      // Per-page fields
      const page = result.pages[0];
      assert.equal(typeof page.file, 'string');
      assert.equal(typeof page.word_count, 'number');
      assert.equal(typeof page.sentence_count, 'number');
      assert.equal(typeof page.avg_sentence_length, 'number');
      assert.equal(typeof page.heading_count, 'number');
      assert.equal(typeof page.h2_count, 'number');
      assert.equal(typeof page.question_h2_count, 'number');
      assert.equal(typeof page.content_score, 'number');
      assert.ok(page.content_score >= 0 && page.content_score <= 100);
      assert.ok(typeof page.readability === 'object');
      assert.ok(Array.isArray(page.findings));
    } finally {
      fs.rmSync(jsonDir, { recursive: true, force: true });
    }
  });

  // ── Test 9: Wall of text detection ───────────────────────────────
  it('detects wall of text paragraphs over 150 words', () => {
    const wallDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-content-wall-'));
    try {
      const html = `<!DOCTYPE html>
<html><head><title>Wall</title></head>
<body>
  <h1>Long Paragraphs</h1>
  <h2>Details</h2>
  <p>${filler(200)}</p>
  <p>${filler(200)}</p>
</body>
</html>`;
      fs.writeFileSync(path.join(wallDir, 'wall.html'), html);
      const result = runScorer(wallDir);
      const page = result.pages.find(p => p.file === 'wall.html');
      assert.ok(page, 'Should analyze wall.html');
      const wallFinding = page.findings.find(f => f.type === 'wall_of_text');
      assert.ok(wallFinding, 'Should flag wall_of_text');
      assert.equal(wallFinding.severity, 'medium');
      assert.ok(wallFinding.message.includes('150+ words'));
    } finally {
      fs.rmSync(wallDir, { recursive: true, force: true });
    }
  });

  // ── Test 10: Non-question H2s trigger GEO warning ────────────────
  it('flags non-question H2s as GEO issue when 3+ H2s exist', () => {
    const noqDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-content-noq-'));
    try {
      const html = `<!DOCTYPE html>
<html><head><title>Guide</title></head>
<body>
  <h1>Complete Guide</h1>
  <h2>Introduction</h2>
  <p>${filler(150)}</p>
  <h2>Features</h2>
  <p>${filler(150)}</p>
  <h2>Conclusion</h2>
  <p>${filler(150)}</p>
</body>
</html>`;
      fs.writeFileSync(path.join(noqDir, 'noq.html'), html);
      const result = runScorer(noqDir);
      const page = result.pages.find(p => p.file === 'noq.html');
      assert.ok(page, 'Should analyze noq.html');
      assert.equal(page.h2_count, 3);
      assert.equal(page.question_h2_count, 0);
      const geoFinding = page.findings.find(f => f.type === 'geo_headings');
      assert.ok(geoFinding, 'Should flag geo_headings when no question H2s');
      assert.equal(geoFinding.severity, 'medium');
    } finally {
      fs.rmSync(noqDir, { recursive: true, force: true });
    }
  });
});
