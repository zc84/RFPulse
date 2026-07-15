function normalizeText(value) {
  return String(value || '').toLowerCase();
}

const INTENT_KEYWORDS = {
  'security governance': ['security', 'compliance', 'iso', 'soc2', 'privacy', 'data residency', 'encryption', 'access control'],
  'delivery governance': ['governance', 'pmo', 'steering', 'reporting', 'tracking', 'milestone', 'status cadence'],
  'solution architecture': ['architecture', 'platform', 'integration', 'api', 'microservice', 'cloud', 'scalability'],
  mobilisation: ['mobilisation', 'onboarding', 'kickoff', 'transition', 'readiness'],
  'support and sla': ['support', 'sla', 'incident', 'service desk', 'availability', 'response time'],
  'local presence': ['local', 'onsite', 'uae', 'gcc', 'regional', 'presence'],
  'delivery capacity': ['capacity', 'team', 'staffing', 'resources', 'certified', 'experience'],
};

function scoreIntent(text, keywords = []) {
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) score += 1;
  }
  return score;
}

export function resolveRetrievalIntents(queryText = '', intents = [], { maxIntents = 4 } = {}) {
  const explicit = Array.isArray(intents)
    ? [...new Set(intents.map(intent => String(intent || '').trim()).filter(Boolean))]
    : [];
  if (explicit.length > 0) {
    return {
      intents: explicit,
      inferred: false,
    };
  }

  const normalizedQuery = normalizeText(queryText);
  const ranked = Object.entries(INTENT_KEYWORDS)
    .map(([intent, keywords]) => ({ intent, score: scoreIntent(normalizedQuery, keywords) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.intent.localeCompare(b.intent));

  const inferred = ranked.slice(0, Math.max(1, Math.min(maxIntents, 8))).map(item => item.intent);
  return {
    intents: inferred,
    inferred: true,
  };
}
