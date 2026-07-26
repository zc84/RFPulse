import { createHash } from 'node:crypto';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonicalize(value[key])])
  );
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function escapeJsonPointerSegment(segment) {
  return String(segment).replaceAll('~', '~0').replaceAll('/', '~1');
}

function collectLeafFacts(value, path, output) {
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => collectLeafFacts(entry, `${path}/${index}`, output));
      if (value.length === 0) output.push({ canonicalPath: path, value });
      return;
    }
    const keys = Object.keys(value).sort();
    keys.forEach(key => collectLeafFacts(
      value[key],
      `${path}/${escapeJsonPointerSegment(key)}`,
      output
    ));
    if (keys.length === 0) output.push({ canonicalPath: path, value });
    return;
  }
  output.push({ canonicalPath: path, value });
}

export function createStructuredFactIndex(structuredData = {}) {
  const normalized = canonicalize(structuredData);
  const sourceDigest = sha256(JSON.stringify(normalized));
  const leaves = [];
  collectLeafFacts(normalized, '/structured_data', leaves);

  const facts = leaves.map(({ canonicalPath, value }) => {
    const valueDigest = sha256(canonicalJson(value));
    return Object.freeze({
      factId: `fact_${sha256(`${canonicalPath}:${valueDigest}`).slice(0, 24)}`,
      sourceId: 'structured_data',
      canonicalPath,
      sourceDigest,
      valueDigest,
      value,
    });
  });

  return Object.freeze({
    sourceDigest,
    canonical: normalized,
    facts: Object.freeze(facts),
    byId: new Map(facts.map(fact => [fact.factId, fact])),
    byPath: new Map(facts.map(fact => [fact.canonicalPath, fact])),
  });
}

export function verifyEvidenceRef(reference, factIndex) {
  const fact = factIndex?.byId?.get(reference?.factId);
  return Boolean(
    fact
      && fact.sourceId === reference.sourceId
      && fact.canonicalPath === reference.canonicalPath
      && fact.sourceDigest === reference.sourceDigest
      && fact.valueDigest === reference.valueDigest
  );
}

