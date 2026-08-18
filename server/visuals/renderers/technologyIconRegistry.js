import {
  siGoogleanalytics,
  siNextdotjs,
  siNodedotjs,
  siOpensearch,
  siPostgresql,
  siReact,
} from 'simple-icons';
import { escapeXml } from './svgPrimitives.js';

const BRAND_MATCHERS = [
  { pattern: /next\.?js/i, icon: siNextdotjs },
  { pattern: /\breact\b/i, icon: siReact },
  { pattern: /node\.?js/i, icon: siNodedotjs },
  { pattern: /postgres/i, icon: siPostgresql },
  { pattern: /opensearch/i, icon: siOpensearch },
  { pattern: /\bga4\b|google analytics/i, icon: siGoogleanalytics },
];

const SEMANTIC_PATHS = Object.freeze({
  users: '<circle cx="8" cy="8" r="4"/><circle cx="17" cy="9" r="3"/><path d="M2 22v-3c0-4 3-7 7-7s7 3 7 7v3"/><path d="M16 14c3 0 6 2 6 6v2"/>',
  editor: '<circle cx="10" cy="7" r="4"/><path d="M3 22v-3c0-4 3-7 7-7 2 0 4 1 5 2"/><path d="M16 18l5-5 2 2-5 5-4 1z"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3 9-8 11-5-2-8-6-8-11V5z"/><path d="M8 12l3 3 5-6"/>',
  browser: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/><circle cx="6" cy="6.5" r=".7"/><circle cx="9" cy="6.5" r=".7"/>',
  document: '<path d="M5 2h10l4 4v16H5z"/><path d="M15 2v5h5M8 12h8M8 16h8"/>',
  api: '<path d="M8 5L3 12l5 7M16 5l5 7-5 7M14 3l-4 18"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="M15 15l7 7"/>',
  integration: '<circle cx="5" cy="12" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><path d="M8 11l8-5M8 13l8 5"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 2 4 3 8 3s8-1 8-3V5M4 12v7c0 2 4 3 8 3s8-1 8-3v-7"/>',
  folder: '<path d="M2 6h8l2 3h10v11H2z"/>',
  identity: '<path d="M12 2l8 3v6c0 5-3 9-8 11-5-2-8-6-8-11V5z"/><circle cx="12" cy="9" r="3"/><path d="M7 18c1-3 3-5 5-5s4 2 5 5"/>',
  analytics: '<path d="M4 21V11h4v10M10 21V4h4v17M16 21v-7h4v7M2 21h20"/>',
  pipeline: '<circle cx="4" cy="12" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="20" cy="12" r="2"/><circle cx="12" cy="19" r="2"/><path d="M6 11l4-4M14 7l4 4M18 13l-4 4M10 17l-4-4"/>',
  environments: '<rect x="3" y="3" width="18" height="5" rx="1"/><rect x="3" y="10" width="18" height="5" rx="1"/><rect x="3" y="17" width="18" height="5" rx="1"/>',
  monitoring: '<rect x="2" y="3" width="20" height="15" rx="2"/><path d="M5 12h3l2-5 4 9 2-4h3M8 22h8"/>',
});

function semanticKey(component) {
  const value = `${component.label || ''} ${component.technology || ''}`.toLowerCase();
  if (/learner|user|visitor|career changer/.test(value)) return 'users';
  if (/editor|administrator|author/.test(value)) return 'editor';
  if (/waf|protection|security|cdn|edge/.test(value)) return 'shield';
  if (/web application|frontend|website/.test(value)) return 'browser';
  if (/cms|content/.test(value)) return 'document';
  if (/\bapi\b/.test(value)) return 'api';
  if (/search/.test(value)) return 'search';
  if (/integration|provider|external/.test(value)) return 'integration';
  if (/database|postgres|relational/.test(value)) return 'database';
  if (/storage|media|document/.test(value)) return 'folder';
  if (/identity|access|oidc|oauth|rbac/.test(value)) return 'identity';
  if (/analytics/.test(value)) return 'analytics';
  if (/pipeline|ci\/cd|build|release/.test(value)) return 'pipeline';
  if (/environment|uat|production/.test(value)) return 'environments';
  if (/monitor|operations|logs|metrics|alerts/.test(value)) return 'monitoring';
  return 'integration';
}

export function renderTechnologyIcon(component, x, y, size = 46, fallbackColor = '#176B87') {
  const technology = component.technology || '';
  const brand = BRAND_MATCHERS.find(item => item.pattern.test(technology));
  const padding = 6;
  const inner = size - padding * 2;
  if (brand) {
    const color = `#${brand.icon.hex}`;
    return [
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="11" fill="${color}" opacity="0.10"/>`,
      `<svg x="${x + padding}" y="${y + padding}" width="${inner}" height="${inner}" viewBox="0 0 24 24" aria-label="${escapeXml(brand.icon.title)}">`,
      `<path d="${brand.icon.path}" fill="${color}"/>`,
      '</svg>',
    ].join('');
  }

  const key = semanticKey(component);
  return [
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="11" fill="${fallbackColor}" opacity="0.10"/>`,
    `<svg x="${x + padding}" y="${y + padding}" width="${inner}" height="${inner}" viewBox="0 0 24 24" fill="none" stroke="${fallbackColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">`,
    SEMANTIC_PATHS[key],
    '</svg>',
  ].join('');
}
