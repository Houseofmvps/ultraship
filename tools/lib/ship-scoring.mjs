// tools/lib/ship-scoring.mjs
// Single source of truth for /ship scorecard math. Imported by bin/ultraship.mjs (runShip)
// and tools/ship-gate.mjs so the advisory scorecard and the blocking gate can never disagree.

// Generic findings-based score: start at 100, deduct per finding by severity.
// dedupeByRule = same rule across N pages counts once (it's one fix pattern, not N).
export function calcFindingsScore(data, deductionMap, dedupeByRule = false) {
  if (!data || data._failed) return null;
  if (!data.findings) return 100;
  let deductions = 0;
  if (dedupeByRule) {
    const seenRules = new Set();
    for (const f of data.findings) {
      const ruleKey = f.rule || f.category || f.message;
      if (!seenRules.has(ruleKey)) {
        seenRules.add(ruleKey);
        deductions += deductionMap[f.severity] || 0;
      }
    }
  } else {
    for (const f of data.findings) {
      deductions += deductionMap[f.severity] || 0;
    }
  }
  return Math.max(0, 100 - deductions);
}

// Code Quality = code-profiler findings (deduped by category:file) + dep-doctor findings.
export function calcQualityScore(profileData, depsData) {
  let deductions = 0;
  if (profileData && !profileData._failed && profileData.findings) {
    const seenCatFile = new Set();
    for (const f of profileData.findings) {
      const key = `${f.category}:${f.file}`;
      const first = !seenCatFile.has(key);
      seenCatFile.add(key);
      const mult = first ? 1 : 0.5;
      if (f.severity === 'high') deductions += 5 * mult;
      else if (f.severity === 'medium') deductions += 2 * mult;
      else deductions += 0.5 * mult;
    }
  } else if (!profileData || profileData._failed) {
    return null;
  }
  if (depsData && !depsData._failed) {
    const unusedList = depsData.unused || [];
    const outdated = depsData.outdated?.length || 0;
    for (const u of unusedList) {
      if (u.severity === 'high') deductions += 3;
      else deductions += 1;
    }
    deductions += outdated * 1;
  }
  return Math.max(0, Math.round(100 - deductions));
}

// Bundle = base 100 minus heavy-dependency and total-size penalties.
export function calcBundleScore(data) {
  if (!data || data._failed) return null;
  if (!data.success) return 100; // no build output = nothing to check
  const heavyDeps = data.dependencies?.heavy_deps?.length || data.heavy_dependencies?.length || 0;
  const totalBytes = data.bundle?.total_bytes || data.total_size || 0;
  const totalMB = totalBytes / (1024 * 1024);
  let deductions = heavyDeps * 8;
  if (totalMB > 5) deductions += 15;
  else if (totalMB > 2) deductions += 8;
  return Math.max(0, 100 - deductions);
}

// Per-category deduction maps (the weights /ship and the gate both use).
export const DEDUCTIONS = {
  seo: { critical: 5, high: 3, medium: 1, low: 0 },
  a11y: { critical: 10, high: 5, medium: 3, low: 1 },
  security: { critical: 15, high: 10, medium: 5 },
};

// Compute every category score + overall from the six tool result objects.
// Returns nulls for categories that failed or were skipped (backend/no-HTML projects).
export function computeShipScores({ seo, a11y, secrets, profile, deps, bundle }) {
  const seoWasSkipped = seo?.skipped || seo?.scores?.seo === null;
  const a11yWasSkipped = a11y?.skipped || a11y?.scores?.a11y === null;

  const seoScore = seoWasSkipped ? null : calcFindingsScore(seo, DEDUCTIONS.seo, true);
  const a11yScore = a11yWasSkipped ? null : calcFindingsScore(a11y, DEDUCTIONS.a11y, true);
  const securityScore = calcFindingsScore(secrets, DEDUCTIONS.security);
  const qualityScore = calcQualityScore(profile, deps);
  const bundleScore = calcBundleScore(bundle);

  const present = [seoScore, a11yScore, securityScore, qualityScore, bundleScore].filter(s => s !== null);
  const overall = present.length > 0 ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : 0;

  return {
    seoScore, a11yScore, securityScore, qualityScore, bundleScore,
    seoWasSkipped, a11yWasSkipped,
    overall, ran: present.length,
  };
}
