const PROFILE_DEFINITIONS = {
  'solution-build': {
    label: 'Solution build',
    patterns: [
      /\b(design|build|develop|moderni[sz]e|implement|platform|application|system)\b/g,
      /\b(functional|non-functional|nfr|architecture|integration|api|deployment|migration)\b/g,
    ],
  },
  'service-team': {
    label: 'Service team',
    patterns: [
      /\b(dedicated team|staff augmentation|time and materials|t&m|rate card|resource augmentation)\b/g,
      /\b(cv|resume|fte|seniority|role profile|team composition|interview)\b/g,
    ],
  },
  rfi: {
    label: 'RFI / capability response',
    patterns: [
      /\b(rfi|request for information|expression of interest|eoi|market sounding)\b/g,
      /\b(capabilit(?:y|ies)|company profile|supplier questionnaire|information request)\b/g,
    ],
  },
};

function normalizeRequirement(requirement) {
  return {
    ...requirement,
    text: String(requirement?.text || requirement?.normalized_text || requirement?.normalizedText || ''),
    obligationLevel: requirement?.obligation_level || requirement?.obligationLevel || 'informational',
    responseType: requirement?.response_type || requirement?.responseType || 'narrative',
    priority: requirement?.priority || 'low',
    status: requirement?.status || 'open',
  };
}

function countPatternMatches(text, patterns) {
  return patterns.reduce((total, pattern) => total + (text.match(pattern) || []).length, 0);
}

function hasMandatorySignal(requirements, pattern) {
  return requirements.some(requirement => (
    requirement.obligationLevel === 'mandatory' && pattern.test(requirement.text.toLowerCase())
  ));
}

export function classifyResponseProfile({ requirementInventory = [], contextSummary = '' } = {}) {
  const requirements = requirementInventory.map(normalizeRequirement);
  const corpus = `${contextSummary}\n${requirements.map(item => item.text).join('\n')}`.toLowerCase();
  const scores = {};
  const signals = {};

  for (const [profile, definition] of Object.entries(PROFILE_DEFINITIONS)) {
    const matches = countPatternMatches(corpus, definition.patterns);
    scores[profile] = matches;
    signals[profile] = definition.patterns
      .flatMap(pattern => corpus.match(pattern) || [])
      .map(value => value.toLowerCase())
      .filter((value, index, list) => list.indexOf(value) === index)
      .slice(0, 8);
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [winner, runnerUp] = ranked;
  const topScore = winner?.[1] || 0;
  const margin = topScore - (runnerUp?.[1] || 0);
  const profile = winner?.[0] || 'solution-build';
  const confidence = topScore === 0 ? 'low' : margin >= 3 ? 'high' : margin >= 1 ? 'medium' : 'low';

  const mandatoryOverrides = {
    architecture: hasMandatorySignal(requirements, /\b(architecture|solution diagram|component diagram|technical design)\b/),
    pricing: requirements.some(requirement => requirement.obligationLevel === 'mandatory'
      && (requirement.responseType === 'commercial' || /\b(price|pricing|commercial|rate card|estimate|budget|cost)\b/i.test(requirement.text))),
    wbs: hasMandatorySignal(requirements, /\b(wbs|work breakdown|implementation plan|delivery plan|effort estimate)\b/),
  };

  return {
    profile,
    label: PROFILE_DEFINITIONS[profile].label,
    confidence,
    ambiguous: confidence === 'low',
    scores,
    signals,
    mandatoryOverrides,
    rationale: topScore === 0
      ? 'No decisive profile signal was found; solution-build is retained as the safe compatibility default.'
      : `${PROFILE_DEFINITIONS[profile].label} has the strongest source signals (${topScore}; margin ${margin}).`,
  };
}

export function buildBidQualificationSnapshot({ requirementInventory = [], contextSummary = '' } = {}) {
  const requirements = requirementInventory.map(normalizeRequirement);
  const mandatory = requirements.filter(item => item.obligationLevel === 'mandatory');
  const criticalGaps = mandatory.filter(item => (
    item.status === 'gap'
    || item.status === 'missing'
    || item.status === 'failed'
  ));
  const conflicts = requirements.filter(item => item.conflict_group || item.conflictGroup);
  const missingAppendices = requirements.filter(item => {
    const metadata = typeof item.metadata === 'string'
      ? (() => { try { return JSON.parse(item.metadata); } catch { return {}; } })()
      : (item.metadata || {});
    return metadata.gapType === 'missing-appendix-reference';
  });
  const verificationItems = mandatory.filter(item => (
    /\b(certificate|insurance|turnover|reference|legal presence|registration|cv|signed|signature)\b/i.test(item.text)
  ));
  const profile = classifyResponseProfile({ requirementInventory: requirements, contextSummary });

  let recommendation = 'go';
  if (criticalGaps.length > 0) recommendation = 'no-go';
  else if (conflicts.length > 0 || missingAppendices.length > 0 || verificationItems.length > 0 || profile.ambiguous) {
    recommendation = 'conditional-go';
  }

  return {
    recommendation,
    profile,
    counts: {
      total: requirements.length,
      mandatory: mandatory.length,
      scored: requirements.filter(item => item.obligationLevel === 'should').length,
      criticalGaps: criticalGaps.length,
      conflicts: conflicts.length,
      missingAppendices: missingAppendices.length,
      internalVerificationItems: verificationItems.length,
    },
    blockers: criticalGaps.map(item => item.text),
    conditions: [
      ...conflicts.map(item => `Resolve contradictory requirement: ${item.text}`),
      ...missingAppendices.map(item => `Obtain referenced appendix: ${item.text}`),
      ...verificationItems.map(item => `Verify internally: ${item.text}`),
      ...(profile.ambiguous ? ['Confirm the response profile before final artifact generation.'] : []),
    ],
  };
}

export function evaluateCompetitivenessReadiness({
  requirementInventory = [],
  estimate = null,
  benchmarkEvidence = [],
} = {}) {
  const requirements = requirementInventory.map(normalizeRequirement);
  const pricingRequested = requirements.some(item => (
    item.responseType === 'commercial' || /\b(price|pricing|commercial|rate card|budget|cost)\b/i.test(item.text)
  ));
  if (!pricingRequested) {
    return { applicable: false, verdict: 'not-applicable', reasons: ['The source package does not request pricing.'] };
  }

  const hasEstimate = Boolean(estimate && (typeof estimate === 'object' || String(estimate).trim()));
  const hasBenchmarks = Array.isArray(benchmarkEvidence) && benchmarkEvidence.length > 0;
  const missingInputs = [];
  if (!hasEstimate) missingInputs.push('estimate');
  if (!hasBenchmarks) missingInputs.push('comparable tender or delivered-project benchmarks');

  return {
    applicable: true,
    verdict: missingInputs.length > 0 ? 'not-assessable' : 'requires-price-to-win-review',
    separateFromCompliance: true,
    missingInputs,
    reasons: missingInputs.length > 0
      ? [`Price-to-win must not be invented; missing ${missingInputs.join(' and ')}.`]
      : ['Pricing is in scope and grounded benchmark evidence is available for an independent competitiveness review.'],
  };
}
