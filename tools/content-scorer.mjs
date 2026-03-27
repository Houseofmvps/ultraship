#!/usr/bin/env node
// tools/content-scorer.mjs
// Content quality analysis — readability, keyword density, content scoring
// Usage: node tools/content-scorer.mjs <project-directory> [--keyword=<keyword>]
// Safe: pure file parsing, no shell execution

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { checkFileSize } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

const ALWAYS_SKIP = new Set(['node_modules', '.git', '.next', 'coverage', '.cache']);
const MAYBE_SKIP = new Set(['dist', 'build']);

function dirHasHtml(dirPath) {
  try {
    for (const entry of readdirSync(dirPath)) {
      const p = join(dirPath, entry);
      try {
        const s = statSync(p);
        if (s.isFile() && (entry.endsWith('.html') || entry.endsWith('.htm'))) return true;
        if (s.isDirectory() && !entry.startsWith('.') && dirHasHtml(p)) return true;
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return false;
}

function findHtmlFiles(dir) {
  // Check which MAYBE_SKIP dirs contain HTML (pre-rendered sites)
  const includeOverrides = new Set();
  for (const name of MAYBE_SKIP) {
    const p = join(dir, name);
    try {
      if (statSync(p).isDirectory() && dirHasHtml(p)) includeOverrides.add(name);
    } catch { /* skip */ }
  }

  const files = [];
  function walk(d) {
    try {
      for (const entry of readdirSync(d)) {
        if (entry.startsWith('.') || ALWAYS_SKIP.has(entry)) continue;
        if (MAYBE_SKIP.has(entry) && !includeOverrides.has(entry)) continue;
        const p = join(d, entry);
        try {
          const s = statSync(p);
          if (s.isDirectory()) walk(p);
          else if (entry.endsWith('.html') || entry.endsWith('.htm')) files.push(p);
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir);

  // Deduplicate: if both root/file.html and dist/file.html exist, keep only dist version
  const distFiles = new Set();
  for (const f of files) {
    const rel = relative(dir, f);
    for (const prefix of ['dist/', 'build/']) {
      if (rel.startsWith(prefix)) distFiles.add(rel.slice(prefix.length));
    }
  }
  const deduped = files.filter(f => {
    const rel = relative(dir, f);
    // Drop root-level file if it has a dist/build counterpart
    if (!rel.startsWith('dist/') && !rel.startsWith('build/') && distFiles.has(rel)) return false;
    return true;
  });

  return deduped;
}

function stripHtml(html) {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function extractHeadings(html) {
  const headings = [];
  const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1][1]);
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text) headings.push({ level, text });
  }
  return headings;
}

function getSentences(text) {
  return text.split(/[.!?]+/).filter(s => s.trim().length > 5);
}

function getWords(text) {
  return text.split(/\s+/).filter(w => w.length > 0);
}

function getSyllableCount(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function fleschReadingEase(text) {
  const sentences = getSentences(text);
  const words = getWords(text);
  if (sentences.length === 0 || words.length === 0) return null;

  const totalSyllables = words.reduce((sum, w) => sum + getSyllableCount(w), 0);
  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables / words.length;

  const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  return Math.round(Math.max(0, Math.min(100, score)));
}

function fleschKincaidGrade(text) {
  const sentences = getSentences(text);
  const words = getWords(text);
  if (sentences.length === 0 || words.length === 0) return null;

  const totalSyllables = words.reduce((sum, w) => sum + getSyllableCount(w), 0);
  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables / words.length;

  const grade = (0.39 * avgSentenceLength) + (11.8 * avgSyllablesPerWord) - 15.59;
  return Math.round(Math.max(0, grade) * 10) / 10;
}

function readabilityRating(score) {
  if (score >= 80) return 'easy';
  if (score >= 60) return 'standard';
  if (score >= 40) return 'difficult';
  return 'very_difficult';
}

function keywordDensity(text, keyword) {
  if (!keyword) return null;
  const words = getWords(text.toLowerCase());
  const kw = keyword.toLowerCase();
  const kwWords = kw.split(/\s+/);

  if (kwWords.length === 1) {
    const count = words.filter(w => w === kw).length;
    return { keyword: kw, count, total_words: words.length, density_pct: Math.round((count / words.length) * 10000) / 100 };
  }

  const textLower = text.toLowerCase();
  let count = 0;
  let pos = 0;
  while ((pos = textLower.indexOf(kw, pos)) !== -1) {
    count++;
    pos += kw.length;
  }
  return { keyword: kw, count, total_words: words.length, density_pct: Math.round((count * kwWords.length / words.length) * 10000) / 100 };
}

const SPA_FRAMEWORKS = {
  'react': 'React',
  'react-dom': 'React',
  'vue': 'Vue',
  '@angular/core': 'Angular',
  'svelte': 'Svelte',
};

const SPA_ROOT_PATTERNS = [
  /<div\s+id\s*=\s*["']root["']/i,
  /<div\s+id\s*=\s*["']app["']/i,
  /<div\s+id\s*=\s*["']__next["']/i,
];

function detectSpaProject(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [dep, framework] of Object.entries(SPA_FRAMEWORKS)) {
      if (allDeps && allDeps[dep]) return framework;
    }
  } catch { /* skip */ }
  return null;
}

function isSpaShell(html, wordThreshold = 50) {
  const text = stripHtml(html);
  const words = getWords(text);
  if (words.length >= wordThreshold) return false;
  return SPA_ROOT_PATTERNS.some(pattern => pattern.test(html));
}

function analyzeContent(html, filePath, keyword) {
  const text = stripHtml(html);
  const words = getWords(text);
  const sentences = getSentences(text);
  const headings = extractHeadings(html);

  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;

  const readability = fleschReadingEase(text);
  const gradeLevel = fleschKincaidGrade(text);

  const findings = [];

  if (wordCount < 300) {
    findings.push({ type: 'thin_content', severity: 'high', message: `Only ${wordCount} words — pages with <300 words rank poorly and get ignored by AI engines` });
  } else if (wordCount < 500) {
    findings.push({ type: 'thin_content', severity: 'medium', message: `${wordCount} words — consider expanding to 800+ for competitive topics` });
  }

  if (readability !== null && readability < 40) {
    findings.push({ type: 'readability', severity: 'medium', message: `Readability score ${readability}/100 (very difficult) — AI engines prefer clear, simple language. Target 60+.` });
  }

  if (avgSentenceLength > 25) {
    findings.push({ type: 'sentence_length', severity: 'low', message: `Average sentence length is ${avgSentenceLength} words — keep under 20 for better readability` });
  }

  if (headings.length === 0 && wordCount > 200) {
    findings.push({ type: 'no_headings', severity: 'high', message: 'No headings found — content without structure ranks poorly in both traditional and AI search' });
  }

  const h2s = headings.filter(h => h.level === 2);
  const questionH2s = h2s.filter(h => /^(what|how|why|when|where|who|which|can|does|is|are|should|do)\s/i.test(h.text));
  if (h2s.length >= 3 && questionH2s.length === 0) {
    findings.push({ type: 'geo_headings', severity: 'medium', message: 'No question-based H2 headings — rewrite key headings as questions for AI citation' });
  }

  const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  const longParas = paragraphs.filter(p => getWords(stripHtml(p)).length > 150);
  if (longParas.length > 0) {
    findings.push({ type: 'wall_of_text', severity: 'medium', message: `${longParas.length} paragraph(s) with 150+ words — break into smaller chunks` });
  }

  let kwAnalysis = null;
  if (keyword) {
    kwAnalysis = keywordDensity(text, keyword);
    if (kwAnalysis.count === 0) {
      findings.push({ type: 'keyword_missing', severity: 'high', message: `Target keyword "${keyword}" not found on this page` });
    } else if (kwAnalysis.density_pct > 3) {
      findings.push({ type: 'keyword_stuffing', severity: 'high', message: `Keyword density ${kwAnalysis.density_pct}% is too high (max 2-3%)` });
    } else if (kwAnalysis.density_pct < 0.5 && wordCount > 300) {
      findings.push({ type: 'keyword_low', severity: 'low', message: `Keyword density ${kwAnalysis.density_pct}% is low — use "${keyword}" more naturally` });
    }

    const kwInHeadings = headings.some(h => h.text.toLowerCase().includes(keyword.toLowerCase()));
    if (!kwInHeadings && kwAnalysis.count > 0) {
      findings.push({ type: 'keyword_not_in_heading', severity: 'medium', message: `Target keyword "${keyword}" not found in any heading` });
    }
  }

  // Weighted scoring: positive signals earn points, issues deduct
  // Word count: 0-35 points (300+ words = full marks)
  const wordScore = wordCount >= 800 ? 35 : wordCount >= 500 ? 30 : wordCount >= 300 ? 25 : wordCount >= 100 ? Math.round(wordCount / 100 * 8) : Math.round(wordCount / 20);

  // Heading structure: 0-20 points
  let headingScore = 0;
  if (headings.length > 0) headingScore += 10;
  if (h2s.length >= 2) headingScore += 5;
  if (questionH2s.length > 0) headingScore += 5;

  // Readability: 0-25 points
  let readScore = 0;
  if (readability !== null) {
    if (readability >= 60) readScore = 25;
    else if (readability >= 40) readScore = 15;
    else readScore = 5;
  }

  // Base quality: 0-20 points (no issues = full marks)
  let qualityScore = 20;
  for (const f of findings) {
    if (f.severity === 'critical') qualityScore -= 10;
    else if (f.severity === 'high') qualityScore -= 5;
    else if (f.severity === 'medium') qualityScore -= 3;
    else qualityScore -= 1;
  }
  qualityScore = Math.max(0, qualityScore);

  const score = Math.min(100, Math.max(0, wordScore + headingScore + readScore + qualityScore));

  return {
    file: filePath,
    word_count: wordCount,
    sentence_count: sentenceCount,
    avg_sentence_length: avgSentenceLength,
    heading_count: headings.length,
    h2_count: h2s.length,
    question_h2_count: questionH2s.length,
    readability: {
      flesch_reading_ease: readability,
      flesch_kincaid_grade: gradeLevel,
      rating: readability !== null ? readabilityRating(readability) : null,
    },
    keyword_analysis: kwAnalysis,
    content_score: Math.max(0, score),
    findings,
  };
}

function main() {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  const keywordArg = args.find(a => a.startsWith('--keyword='));
  const keyword = keywordArg ? keywordArg.split('=').slice(1).join('=') : null;

  if (!dir) {
    output({ error: 'Usage: node content-scorer.mjs <project-directory> [--keyword=<keyword>]', success: false });
    process.exit(0);
  }

  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  const htmlFiles = findHtmlFiles(dir);
  if (htmlFiles.length === 0) {
    output({ success: true, warning: 'No HTML files found', pages: [] });
    process.exit(0);
  }

  const spaFramework = detectSpaProject(dir);

  const pages = [];
  for (const file of htmlFiles) {
    const sizeCheck = checkFileSize(file, statSync);
    if (!sizeCheck.ok) continue;
    const html = readFileSync(file, 'utf8');
    const relPath = relative(dir, file);

    if (spaFramework && isSpaShell(html)) {
      pages.push({
        file: relPath,
        spa_detected: true,
        note: 'SPA shell detected — content is rendered client-side. Static content analysis not applicable.',
        spa_framework: spaFramework,
        content_score: null,
        findings: [],
      });
    } else {
      pages.push(analyzeContent(html, relPath, keyword));
    }
  }

  pages.sort((a, b) => {
    const scoreA = a.content_score ?? -1;
    const scoreB = b.content_score ?? -1;
    return scoreA - scoreB;
  });

  const scoredPages = pages.filter(p => p.content_score !== null);
  const totalFindings = pages.reduce((sum, p) => sum + p.findings.length, 0);
  const avgScore = scoredPages.length > 0
    ? Math.round(scoredPages.reduce((sum, p) => sum + p.content_score, 0) / scoredPages.length)
    : null;
  const avgReadability = scoredPages.filter(p => p.readability && p.readability.flesch_reading_ease !== null);
  const avgReadabilityScore = avgReadability.length > 0
    ? Math.round(avgReadability.reduce((sum, p) => sum + p.readability.flesch_reading_ease, 0) / avgReadability.length)
    : null;

  output({
    success: true,
    pages_analyzed: pages.length,
    total_findings: totalFindings,
    average_content_score: avgScore,
    average_readability: avgReadabilityScore,
    target_keyword: keyword || null,
    pages,
  });
}

main();
