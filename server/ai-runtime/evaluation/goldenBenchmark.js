const REQUIRED_LABELS = [
  'criticalRequirements',
  'expectedCapabilities',
  'requiredArtifacts',
  'prohibitedUnsupportedClaims',
  'expectedFileStructure',
  'smePreference',
];

export function validateGoldenBenchmarkPack(pack) {
  const errors = [];
  if (!pack || typeof pack !== 'object') return { valid: false, errors: ['Pack must be an object.'] };
  if (!String(pack.id || '').trim()) errors.push('id is required.');
  if (!String(pack.category || '').trim()) errors.push(`${pack.id || 'pack'}: category is required.`);
  if (!String(pack.sourcePack || '').trim()) errors.push(`${pack.id || 'pack'}: sourcePack is required.`);
  for (const label of REQUIRED_LABELS) {
    if (pack[label] === undefined) errors.push(`${pack.id || 'pack'}: ${label} is required.`);
  }
  for (const field of ['criticalRequirements', 'expectedCapabilities', 'requiredArtifacts', 'prohibitedUnsupportedClaims']) {
    if (pack[field] !== undefined && !Array.isArray(pack[field])) errors.push(`${pack.id || 'pack'}: ${field} must be an array.`);
  }
  if (pack.smePreference !== undefined && !['v2', 'legacy', 'equal', 'unrated'].includes(pack.smePreference)) {
    errors.push(`${pack.id || 'pack'}: smePreference must be v2, legacy, equal, or unrated.`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateGoldenBenchmarkManifest(manifest) {
  const packs = Array.isArray(manifest) ? manifest : manifest?.packs;
  const errors = [];
  if (!Array.isArray(packs)) return { valid: false, packCount: 0, errors: ['Manifest must contain a packs array.'] };
  if (packs.length < 12 || packs.length > 20) errors.push(`Manifest must contain 12–20 packs; found ${packs.length}.`);
  const ids = new Set();
  packs.forEach(pack => {
    const result = validateGoldenBenchmarkPack(pack);
    errors.push(...result.errors);
    if (ids.has(pack?.id)) errors.push(`Duplicate pack id: ${pack.id}.`);
    ids.add(pack?.id);
  });
  return { valid: errors.length === 0, packCount: packs.length, errors };
}

export { REQUIRED_LABELS };
