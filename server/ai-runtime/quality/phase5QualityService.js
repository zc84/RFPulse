import { query } from '../../db.js';
import { classifyResponseProfile } from '../strategy/bidStrategyService.js';
import { retrieveCompanyProfileSections } from '../knowledge/companyProfileRetriever.js';
import { retrieveFrameworkSections } from '../knowledge/frameworkRetriever.js';

const DEFAULT_FILE_KEY = 'proposal-main';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeProposalMarkdownStyle(markdown = '') {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const normalized = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (normalized.length > 0 && normalized[normalized.length - 1] !== '') {
        normalized.push('');
      }
      continue;
    }

    const fauxHeading = trimmed.match(/^\*\*\s*(.+?)\s*\*\*\s*:??\s*$/);
    if (fauxHeading) {
      const headingText = String(fauxHeading[1] || '').trim().replace(/:+$/, '');
      if (headingText) {
        normalized.push(`## ${headingText}`);
        continue;
      }
    }

    const bulletLike = rawLine.match(/^\s*[•▪◦–—]\s+(.+)$/);
    if (bulletLike) {
      normalized.push(`- ${bulletLike[1].trim()}`);
      continue;
    }

    const numberedParen = rawLine.match(/^\s*(\d+)[\)]\s+(.+)$/);
    if (numberedParen) {
      normalized.push(`${numberedParen[1]}. ${numberedParen[2].trim()}`);
      continue;
    }

    normalized.push(rawLine.replace(/\s+$/, ''));
  }

  while (normalized.length > 0 && normalized[normalized.length - 1] === '') {
    normalized.pop();
  }

  return normalized.join('\n');
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .filter(token => token.length >= 4);
}

function hasTokenOverlap(text, candidate, minMatches = 2) {
  const left = new Set(tokenize(text));
  const right = new Set(tokenize(candidate));
  let matches = 0;
  for (const token of left) {
    if (right.has(token)) matches += 1;
    if (matches >= minMatches) return true;
  }
  return false;
}

function hasStrongRequirementCoverage(requirement, candidate) {
  const requirementText = normalizeText(firstNonEmpty(requirement?.text, requirement?.normalized_text));
  const responseOnly = String(candidate || '').split(/\r?\n/)
    .filter(line => !/^\s*[-*]?\s*requirement\s*:/i.test(line)).join('\n');
  const candidateText = normalizeText(responseOnly);
  if (!requirementText || !candidateText) return false;
  const hasResponseLanguage = /\b(will|commit|provide[sd]?|include[sd]?|deliver[sd]?|approach|method|using|through|implemented|supported)\b/.test(candidateText);
  if (!hasResponseLanguage) return false;
  if (candidateText.includes(requirementText) && candidateText.length > requirementText.length + 20) return true;

  const stopWords = new Set(['provide', 'include', 'shall', 'must', 'required', 'with', 'from', 'that', 'this', 'into', 'and', 'the', 'for']);
  const tokens = [...new Set(tokenize(requirementText).filter(token => !stopWords.has(token)))];
  if (tokens.length === 0) return false;
  const matches = tokens.filter(token => candidateText.includes(token));
  const ratio = matches.length / tokens.length;
  return matches.length >= Math.min(3, tokens.length) && ratio >= 0.6;
}

function firstNonEmpty(...values) {
  return values.map(value => String(value || '').trim()).find(Boolean) || '';
}

function sectionKeyFromText(value, fallback = 'section') {
  return normalizeText(value)
    .split(' ')
    .slice(0, 5)
    .join('-') || fallback;
}

function isInternalOnlyProposalSection(title) {
  return /\b(requirements?\s+inventor(?:y|ies)|submission\s+readiness\s+manifest)\b/i.test(String(title || ''));
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function hasProposalFileMarkers(markdown) {
  return /<!--\s*proposal-file:/i.test(String(markdown || ''));
}

function parseProposalFileBlocks(markdown = '') {
  const text = String(markdown || '').trim();
  const markerRegex = /<!--\s*proposal-file:\s*([^>]+?)\s*-->/gi;
  const markers = [];
  let match;

  while ((match = markerRegex.exec(text))) {
    const meta = Object.fromEntries(
      String(match[1] || '')
        .split(';')
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => {
          const [key, ...rest] = item.split('=');
          return [String(key || '').trim().toLowerCase(), rest.join('=').trim().replace(/^["']|["']$/g, '')];
        })
    );

    markers.push({
      index: match.index,
      end: markerRegex.lastIndex,
      filename: meta.filename || null,
      title: meta.title || null,
      diagrams: String(meta.diagrams || '').toLowerCase() === 'true',
    });
  }

  if (markers.length === 0) {
    return [{
      key: DEFAULT_FILE_KEY,
      filename: 'proposal.docx',
      title: 'Proposal',
      diagrams: true,
      markdown: text,
    }];
  }

  const blocks = [];
  for (let index = 0; index < markers.length; index += 1) {
    const current = markers[index];
    const start = current.end;
    const end = index + 1 < markers.length ? markers[index + 1].index : text.length;
    const content = text.slice(start, end).trim();
    if (!content) continue;
    blocks.push({
      key: `file-${index + 1}`,
      filename: current.filename || `proposal-part-${index + 1}.docx`,
      title: current.title || `Proposal Part ${index + 1}`,
      diagrams: current.diagrams,
      markdown: content,
    });
  }

  return blocks.length > 0
    ? blocks
    : [{
      key: DEFAULT_FILE_KEY,
      filename: 'proposal.docx',
      title: 'Proposal',
      diagrams: true,
      markdown: text,
    }];
}

function parseMarkdownSections(markdown = '', fallbackTitle = 'Executive Summary') {
  const lines = String(markdown || '').trim().split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (current) sections.push(current);
      current = {
        key: `section-${sections.length + 1}`,
        title: heading[1].trim(),
        content: [],
      };
      continue;
    }

    if (!current) {
      current = { key: 'section-1', title: fallbackTitle, content: [] };
    }
    current.content.push(line);
  }

  if (current) sections.push(current);

  return sections.map(section => ({
    ...section,
    content: section.content.join('\n').trim(),
  }));
}

function inferFilePlan({ requirementInventory = [], contextSummary = '', existingMarkdown = '' } = {}) {
  if (hasProposalFileMarkers(existingMarkdown)) {
    return parseProposalFileBlocks(existingMarkdown).map((file, index) => ({
      key: file.key || `file-${index + 1}`,
      filename: file.filename || `proposal-part-${index + 1}.docx`,
      title: file.title || `Proposal Part ${index + 1}`,
      diagrams: file.diagrams !== false,
    }));
  }

  const normalizedContext = normalizeText(contextSummary);
  const hasCommercial = requirementInventory.some(item => item?.response_type === 'commercial')
    || /\b(commercial|financial|pricing|price)\b/.test(normalizedContext);
  const hasExplicitSplit = /\b(technical proposal|technical response|commercial proposal|financial proposal|volume i|volume ii|separate financial)\b/.test(normalizedContext);

  if (hasExplicitSplit && hasCommercial) {
    return [
      {
        key: 'technical-proposal',
        filename: 'technical-proposal.docx',
        title: 'Technical Proposal',
        diagrams: true,
      },
      {
        key: 'commercial-proposal',
        filename: 'commercial-proposal.docx',
        title: 'Commercial Proposal',
        diagrams: false,
      },
    ];
  }

  return [{
    key: DEFAULT_FILE_KEY,
    filename: 'proposal.docx',
    title: 'Proposal',
    diagrams: true,
  }];
}

function selectFileKeyForSection(section, files = []) {
  const availableFiles = Array.isArray(files) && files.length > 0
    ? files
    : inferFilePlan();
  if (section?.fileKey && availableFiles.some(file => file.key === section.fileKey)) {
    return section.fileKey;
  }

  const title = normalizeText(`${section?.key || ''} ${section?.title || ''}`);
  if (/\b(commercial|pricing|price|financial|budget|cost)\b/.test(title)) {
    return availableFiles.find(file => /commercial|financial/i.test(file.key) || /commercial|financial/i.test(file.title))?.key
      || availableFiles[0].key;
  }

  return availableFiles.find(file => file.diagrams)?.key
    || availableFiles[0].key;
}

function inferManualContentItems({ requirementInventory = [], sections = [] } = {}) {
  const fallbackSectionKey = sections.find(section => section.key === 'attachments')?.key
    || sections.find(section => section.key === 'commercial')?.key
    || sections.at(-1)?.key
    || 'attachments';

  return uniqueBy(
    requirementInventory
      .filter(requirement => {
        const text = normalizeText(`${requirement?.text || ''} ${requirement?.normalized_text || ''} ${requirement?.category || ''}`);
        return /\b(template|form|signed|signature|certificate|reference|case study|cv|resume|company profile|annex|appendix)\b/.test(text);
      })
      .map(requirement => {
        const topic = firstNonEmpty(requirement?.text, requirement?.normalized_text).slice(0, 120) || 'Required client template item';
        const normalized = normalizeText(topic);
        const sectionKey = requirement?.response_type === 'commercial' || /\b(price|pricing|commercial|financial)\b/.test(normalized)
          ? (sections.find(section => section.key === 'commercial')?.key || fallbackSectionKey)
          : fallbackSectionKey;

        return {
          requirementId: requirement?.id || null,
          sectionKey,
          topic,
          placeholder: `[TBC — Andersen content: ${topic}]`,
        };
      }),
    item => `${item.sectionKey}:${item.topic}`
  );
}

function formatCanonicalSection(section) {
  return `## ${firstNonEmpty(section?.title, section?.key, 'Proposal Section')}\n\n${String(section?.content || '').trim()}`.trim();
}

function orderCanonicalSections(sections = [], proposalStructure = null) {
  const structureSections = Array.isArray(proposalStructure?.sections) ? proposalStructure.sections : [];
  const sectionOrder = new Map(structureSections.map((section, index) => [section.key, index]));
  const files = Array.isArray(proposalStructure?.files) && proposalStructure.files.length > 0
    ? proposalStructure.files
    : inferFilePlan();
  const fileOrder = new Map(files.map((file, index) => [file.key, index]));

  return [...sections].sort((left, right) => {
    const leftFile = fileOrder.get(left.fileKey) ?? 0;
    const rightFile = fileOrder.get(right.fileKey) ?? 0;
    if (leftFile !== rightFile) return leftFile - rightFile;

    const leftOrder = sectionOrder.get(left.key);
    const rightOrder = sectionOrder.get(right.key);
    if (Number.isInteger(leftOrder) && Number.isInteger(rightOrder) && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    if (Number.isInteger(leftOrder) !== Number.isInteger(rightOrder)) {
      return Number.isInteger(leftOrder) ? -1 : 1;
    }

    return firstNonEmpty(left.title, left.key).localeCompare(firstNonEmpty(right.title, right.key));
  });
}

export function renderCanonicalProposalMarkdown(proposalModel) {
  const structure = proposalModel?.structure || null;
  const files = Array.isArray(structure?.files) && structure.files.length > 0
    ? structure.files
    : inferFilePlan();
  const sections = orderCanonicalSections(Array.isArray(proposalModel?.sections) ? proposalModel.sections : [], structure);
  const sectionsByFile = new Map(files.map(file => [file.key, []]));
  const defaultFileKey = files[0]?.key || DEFAULT_FILE_KEY;

  for (const section of sections) {
    const fileKey = section.fileKey && sectionsByFile.has(section.fileKey)
      ? section.fileKey
      : defaultFileKey;
    const bucket = sectionsByFile.get(fileKey) || [];
    bucket.push(section);
    sectionsByFile.set(fileKey, bucket);
  }

  const chunks = [];
  for (const file of files) {
    const fileSections = sectionsByFile.get(file.key) || [];
    if (fileSections.length === 0) continue;
    const body = fileSections
      .map(section => formatCanonicalSection(section))
      .filter(Boolean)
      .join('\n\n')
      .trim();
    if (!body) continue;

    if (files.length > 1) {
      chunks.push(`<!-- proposal-file: filename=${file.filename}; title=${file.title}; diagrams=${file.diagrams ? 'true' : 'false'} -->\n\n${body}`.trim());
    } else {
      chunks.push(body);
    }
  }

  return chunks.join('\n\n').trim();
}

export function buildCanonicalProposalModel(markdown, proposalStructure = null) {
  const text = normalizeProposalMarkdownStyle(String(markdown || '').trim());
  const files = Array.isArray(proposalStructure?.files) && proposalStructure.files.length > 0
    ? proposalStructure.files
    : inferFilePlan({ existingMarkdown: text });
  const structureSections = Array.isArray(proposalStructure?.sections) ? proposalStructure.sections : [];
  const manualContentItems = Array.isArray(proposalStructure?.manualContentItems) ? proposalStructure.manualContentItems : [];
  const unusedStructureSections = [...structureSections];
  const parsedFiles = parseProposalFileBlocks(text);
  const sections = [];

  for (const parsedFile of parsedFiles) {
    const matchedFile = files.find(file => file.filename === parsedFile.filename || file.title === parsedFile.title)
      || files.find(file => file.key === parsedFile.key)
      || files[0]
      || { key: DEFAULT_FILE_KEY };
    const parsedSections = parseMarkdownSections(parsedFile.markdown);

    for (let index = 0; index < parsedSections.length; index += 1) {
      const parsedSection = parsedSections[index];
      if (isInternalOnlyProposalSection(parsedSection.title)) continue;
      let matchedStructureSection = unusedStructureSections.find(section => normalizeText(section.title) === normalizeText(parsedSection.title));
      if (!matchedStructureSection) {
        matchedStructureSection = unusedStructureSections.find(section => hasTokenOverlap(
          `${section.title || ''} ${section.rationale || ''}`,
          parsedSection.title,
          1
        ));
      }
      if (!matchedStructureSection && unusedStructureSections[index]) {
        matchedStructureSection = unusedStructureSections[index];
      }

      if (matchedStructureSection) {
        unusedStructureSections.splice(unusedStructureSections.indexOf(matchedStructureSection), 1);
      }

      const key = firstNonEmpty(matchedStructureSection?.key, parsedSection.key, sectionKeyFromText(parsedSection.title, `section-${sections.length + 1}`));
      sections.push({
        key,
        title: firstNonEmpty(matchedStructureSection?.title, parsedSection.title, 'Proposal Section'),
        fileKey: matchedStructureSection?.fileKey || matchedFile?.key || DEFAULT_FILE_KEY,
        requirementIds: Array.isArray(matchedStructureSection?.requirementIds) ? matchedStructureSection.requirementIds : [],
        evidenceIds: Array.isArray(matchedStructureSection?.evidenceIds) ? matchedStructureSection.evidenceIds : [],
        frameworkSectionIds: Array.isArray(matchedStructureSection?.frameworkSectionIds) ? matchedStructureSection.frameworkSectionIds : [],
        companySectionIds: Array.isArray(matchedStructureSection?.companySectionIds) ? matchedStructureSection.companySectionIds : [],
        manualContentItems: manualContentItems.filter(item => item.sectionKey === key),
        content: parsedSection.content,
      });
    }
  }

  for (const structureSection of unusedStructureSections) {
    const sectionKey = firstNonEmpty(structureSection?.key, sectionKeyFromText(structureSection?.title, `section-${sections.length + 1}`));
    const sectionManualItems = manualContentItems.filter(item => item.sectionKey === sectionKey);
    sections.push({
      key: sectionKey,
      title: firstNonEmpty(structureSection?.title, sectionKey, 'Proposal Section'),
      fileKey: structureSection?.fileKey || selectFileKeyForSection(structureSection, files),
      requirementIds: Array.isArray(structureSection?.requirementIds) ? structureSection.requirementIds : [],
      evidenceIds: Array.isArray(structureSection?.evidenceIds) ? structureSection.evidenceIds : [],
      frameworkSectionIds: Array.isArray(structureSection?.frameworkSectionIds) ? structureSection.frameworkSectionIds : [],
      companySectionIds: Array.isArray(structureSection?.companySectionIds) ? structureSection.companySectionIds : [],
      manualContentItems: sectionManualItems,
      content: sectionManualItems.map(item => item.placeholder).join('\n'),
    });
  }

  const model = {
    sections: orderCanonicalSections(sections, proposalStructure),
    structure: proposalStructure || { files, sections: [] },
  };
  return {
    ...model,
    markdown: renderCanonicalProposalMarkdown(model),
  };
}

export function authorProposalSections({
  proposalStructure = null,
  requirements = [],
  evidenceItems = [],
  frameworkSections = [],
  companySections = [],
  existingMarkdown = '',
  targetSectionKeys = null,
} = {}) {
  const resolvedStructure = proposalStructure && Array.isArray(proposalStructure?.sections) && proposalStructure.sections.length > 0
    ? proposalStructure
    : buildProposalStructure({ requirementInventory: requirements, existingMarkdown });
  const requestedSectionKeys = Array.isArray(targetSectionKeys) && targetSectionKeys.length > 0
    ? new Set(targetSectionKeys)
    : null;
  const structureSections = resolvedStructure.sections.filter(section => !requestedSectionKeys || requestedSectionKeys.has(section.key));
  const manualContentItems = Array.isArray(resolvedStructure.manualContentItems) ? resolvedStructure.manualContentItems : [];
  const authoredSections = [];

  for (const structureSection of structureSections) {
    const title = firstNonEmpty(structureSection.title, structureSection.key, 'Proposal Section');
    const sectionKey = firstNonEmpty(structureSection.key, sectionKeyFromText(title));
    const scopedRequirements = requirements
      .filter(requirement => hasTokenOverlap(
        `${title} ${structureSection.rationale || ''}`,
        `${requirement.text || ''} ${requirement.normalized_text || ''} ${requirement.category || ''} ${requirement.response_type || ''}`,
        1
      ))
      .slice(0, 8);
    const scopedEvidence = evidenceItems
      .filter(evidence => scopedRequirements.some(requirement => hasTokenOverlap(
        firstNonEmpty(requirement.text, requirement.normalized_text),
        evidence.content || '',
        1
      )))
      .slice(0, 5);
    const scopedFramework = frameworkSections
      .filter(section => hasTokenOverlap(`${title} ${structureSection.rationale || ''}`, `${section.title || ''} ${section.summary || ''} ${section.content || ''}`, 1))
      .slice(0, 3);
    const scopedCompany = companySections
      .filter(section => hasTokenOverlap(`${title} ${structureSection.rationale || ''}`, `${section.title || ''} ${section.summary || ''} ${section.content || ''}`, 1))
      .slice(0, 3);
    const sectionManualItems = manualContentItems.filter(item => item.sectionKey === sectionKey);

    const content = [
      scopedRequirements.length > 0
        ? `This section responds to ${scopedRequirements.length} scoped requirement${scopedRequirements.length === 1 ? '' : 's'}.`
        : (structureSection.rationale || 'This section consolidates relevant proposal content.'),
      ...scopedRequirements.map(requirement => `- Requirement: ${firstNonEmpty(requirement.text, requirement.normalized_text).slice(0, 220)}`),
      ...scopedEvidence.map(evidence => `- Evidence: ${String(evidence.content || '').slice(0, 220)}`),
      ...scopedFramework.map(section => `- Framework basis: ${firstNonEmpty(section.title, section.id, section.sectionId)}${section.summary ? ` - ${section.summary}` : ''}`),
      ...scopedCompany.map(section => `- Company basis: ${firstNonEmpty(section.title, section.id, section.sectionId)}${section.summary ? ` - ${section.summary}` : ''}`),
      ...sectionManualItems.map(item => `- ${item.placeholder}`),
    ].join('\n').trim();

    authoredSections.push({
      key: sectionKey,
      title,
      fileKey: structureSection.fileKey || selectFileKeyForSection(structureSection, resolvedStructure.files),
      requirementIds: scopedRequirements.map(requirement => requirement.id).filter(Boolean),
      evidenceIds: scopedEvidence.map(evidence => evidence.id).filter(Boolean),
      frameworkSectionIds: scopedFramework.map(section => section.id || section.sectionId).filter(Boolean),
      companySectionIds: scopedCompany.map(section => section.id || section.sectionId).filter(Boolean),
      manualContentItems: sectionManualItems,
      content,
    });
  }

  const normalizedSections = authoredSections.map(section => ({
    ...section,
    markdown: formatCanonicalSection(section),
  }));
  const generatedMarkdown = renderCanonicalProposalMarkdown({
    structure: resolvedStructure,
    sections: normalizedSections,
  });
  return {
    sections: normalizedSections,
    structure: resolvedStructure,
    markdown: existingMarkdown && !requestedSectionKeys
      ? `${String(existingMarkdown).trim()}\n\n${generatedMarkdown}`.trim()
      : generatedMarkdown,
  };
}

export function buildProposalStructure({ requirementInventory = [], contextSummary = '', existingMarkdown = '' } = {}) {
  const mandatoryCount = requirementInventory.filter(item => item?.obligation_level === 'mandatory').length;
  const hasCommercial = requirementInventory.some(item => item?.response_type === 'commercial');
  const hasAttachments = requirementInventory.some(item => item?.response_type === 'attachment');
  const files = inferFilePlan({ requirementInventory, contextSummary, existingMarkdown });
  const normalizedContext = normalizeText(contextSummary);
  const responseProfile = classifyResponseProfile({ requirementInventory, contextSummary });

  const sections = [
    { key: 'exec-summary', title: 'Executive Summary', rationale: 'Decision-oriented overview of proposed engagement.' },
  ];

  if (responseProfile.profile === 'service-team') {
    sections.push(
      { key: 'company-fit', title: 'Company Fit & Relevant Experience', rationale: 'Evidence-backed fit for the requested service team.' },
      { key: 'team-composition', title: 'Team Composition & Roles', rationale: 'Requested roles, seniority, availability, and CV evidence.' },
      { key: 'engagement-model', title: 'Engagement Model & Ways of Working', rationale: 'Governance, continuity, onboarding, and delivery cadence.' }
    );
  } else if (responseProfile.profile === 'rfi') {
    sections.push(
      { key: 'company-capabilities', title: 'Company Capabilities', rationale: 'Concise, evidence-backed capability response.' },
      { key: 'relevant-experience', title: 'Relevant Experience', rationale: 'Relevant references and case evidence.' },
      { key: 'high-level-approach', title: 'High-Level Approach', rationale: 'Proportionate response to the information request.' }
    );
  } else {
    sections.push(
      { key: 'solution-overview', title: 'Solution Architecture & Technology Decisions', rationale: 'Requirement-led architecture, components, deployment, data, workflows, and selected technologies.' },
      { key: 'delivery-approach', title: 'Delivery Approach', rationale: 'Methodology, governance, and implementation plan.' }
    );
  }

  if (responseProfile.profile !== 'solution-build' && responseProfile.mandatoryOverrides.architecture) {
    sections.push({ key: 'solution-overview', title: 'Solution Architecture & Technology Decisions', rationale: 'Mandatory architecture response required by the RFP.' });
  }
  if (responseProfile.profile === 'rfi' && responseProfile.mandatoryOverrides.wbs) {
    sections.push({ key: 'delivery-approach', title: 'Delivery & Work Breakdown', rationale: 'Mandatory delivery/WBS response required by the RFP.' });
  }

  if (hasCommercial || /\b(commercial|pricing|financial|price|budget)\b/.test(normalizedContext)) {
    sections.push({ key: 'commercial', title: 'Commercials & Pricing', rationale: 'Commercial response aligned with tender constraints.' });
  }
  if (hasAttachments || /\b(attachment|annex|appendix|template|submission|form|signed)\b/.test(normalizedContext)) {
    sections.push({ key: 'attachments', title: 'Attachments & Evidence', rationale: 'Required forms, annexes, and supporting evidence.' });
  }

  const structuredSections = sections.map(section => ({
    ...section,
    fileKey: selectFileKeyForSection(section, files),
  }));
  const manualContentItems = inferManualContentItems({
    requirementInventory,
    sections: structuredSections,
  });

  return {
    sections: structuredSections,
    files,
    manualContentItems,
    responseInstructions: {
      hasExplicitTemplate: /\b(template|form|annex|appendix|volume|section)\b/.test(normalizedContext),
      hasExplicitFileSplit: files.length > 1,
      hasManualContentItems: manualContentItems.length > 0,
      responseProfile: responseProfile.profile,
      profileConfidence: responseProfile.confidence,
      profileNeedsConfirmation: responseProfile.ambiguous,
    },
    summary: {
      mandatoryRequirementCount: mandatoryCount,
      contextLength: String(contextSummary || '').length,
      fileCount: files.length,
      manualContentItemCount: manualContentItems.length,
      responseProfile: responseProfile.profile,
      profileConfidence: responseProfile.confidence,
      mandatoryArtifactOverrides: responseProfile.mandatoryOverrides,
    },
  };
}

export function extractClaimsFromProposalModel(proposalModel) {
  const claims = [];
  for (const section of proposalModel.sections || []) {
    const sentences = String(section.content || '')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      const normalized = normalizeText(sentence);
      let classification = 'source_fact';
      if (/\b(assume|assumption|tbc)\b/.test(normalized)) classification = 'assumption';
      else if (/\b(recommend|propose|suggest)\b/.test(normalized)) classification = 'recommendation';
      else if (/\b(will|shall|commit)\b/.test(normalized)) classification = 'commitment';

      claims.push({
        tempId: `claim-${claims.length + 1}`,
        sectionKey: section.key,
        claimText: sentence,
        classification,
        status: 'open',
      });
    }
  }
  return claims;
}

export function linkClaimsToEvidence(claims = [], evidenceItems = []) {
  const links = [];
  for (const claim of claims) {
    for (const evidence of evidenceItems || []) {
      if (!evidence?.content) continue;
      if (!hasTokenOverlap(claim.claimText, evidence.content)) continue;
      links.push({
        claimTempId: claim.tempId,
        evidenceId: evidence.id || null,
        relationship: 'supports',
      });
      break;
    }
  }
  return links;
}

function buildKnowledgeEvidenceItems(frameworkSections = [], companySections = []) {
  return [
    ...frameworkSections.map(section => ({
      id: null,
      content: `${section.title || section.sectionId || ''}. ${section.summary || ''} ${section.content || ''}`.trim(),
      sourceType: 'framework',
    })),
    ...companySections.map(section => ({
      id: null,
      content: `${section.title || section.sectionId || ''}. ${section.summary || ''} ${section.content || ''}`.trim(),
      sourceType: 'company',
    })),
  ].filter(item => item.content);
}

function findSectionKeysByPatterns(proposalModel, patterns = []) {
  const regexes = patterns.map(pattern => pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i'));
  return (proposalModel?.sections || [])
    .filter(section => regexes.some(regex => regex.test(`${section.title || ''} ${section.content || ''}`)))
    .map(section => section.key);
}

export function selectRepairTargetSectionKeys({ findings = [], proposalModel, requirements = [] } = {}) {
  const requirementById = new Map(
    requirements
      .filter(requirement => requirement?.id != null)
      .map(requirement => [requirement.id, requirement])
  );
  const selected = new Set();

  const addMatchingSections = text => {
    if (!text) return;
    for (const section of proposalModel?.sections || []) {
      const haystack = `${section.title || ''} ${section.content || ''}`;
      if (hasTokenOverlap(text, haystack, 1)) {
        selected.add(section.key);
      }
    }
  };

  for (const finding of findings || []) {
    if (finding?.requirementId && requirementById.has(finding.requirementId)) {
      const requirement = requirementById.get(finding.requirementId);
      const directMatches = (proposalModel?.sections || [])
        .filter(section => Array.isArray(section.requirementIds) && section.requirementIds.includes(requirement.id))
        .map(section => section.key);
      if (directMatches.length > 0) {
        for (const key of directMatches) selected.add(key);
      } else {
        addMatchingSections(firstNonEmpty(requirement.text, requirement.normalized_text));
      }
    }

    addMatchingSections(finding?.issue || '');

    if (finding?.gateKey === 'quality.submission') {
      for (const key of findSectionKeysByPatterns(proposalModel, [/attachment/i, /submission/i, /annex/i, /appendix/i, /form/i, /evidence/i])) {
        selected.add(key);
      }
    }
    if (finding?.gateKey === 'quality.estimation') {
      for (const key of findSectionKeysByPatterns(proposalModel, [/commercial/i, /pricing/i, /delivery/i, /timeline/i, /effort/i])) {
        selected.add(key);
      }
    }
    if (finding?.gateKey === 'quality.framework-company') {
      for (const key of findSectionKeysByPatterns(proposalModel, [/executive/i, /solution/i, /delivery/i, /company/i, /methodology/i])) {
        selected.add(key);
      }
    }
    if (finding?.gateKey === 'quality.consistency' || finding?.gateKey === 'quality.style-usability') {
      for (const section of proposalModel?.sections || []) {
        selected.add(section.key);
      }
    }
  }

  if (selected.size === 0) {
    return (proposalModel?.sections || []).map(section => section.key);
  }

  return [...selected];
}

function mergeCanonicalSections(existingSections = [], updatedSections = [], proposalStructure = null) {
  const updatedByKey = new Map(updatedSections.map(section => [section.key, section]));
  const merged = existingSections.map(section => updatedByKey.get(section.key) || section);
  for (const section of updatedSections) {
    if (!merged.some(existing => existing.key === section.key)) {
      merged.push(section);
    }
  }
  return orderCanonicalSections(merged, proposalStructure);
}

async function repairProposalModelSections({
  proposalModel,
  proposalStructure,
  findings = [],
  requirements = [],
  evidenceItems = [],
  frameworkSections = [],
  companySections = [],
  contextSummary = '',
  queryFn = query,
}) {
  const targetSectionKeys = selectRepairTargetSectionKeys({
    findings,
    proposalModel,
    requirements,
  });
  if (targetSectionKeys.length === 0) {
    return null;
  }

  const scopedStructureSections = (proposalStructure?.sections || []).filter(section => targetSectionKeys.includes(section.key));
  const effectiveStructure = {
    ...(proposalStructure || buildProposalStructure({ requirementInventory: requirements, contextSummary })),
    sections: scopedStructureSections.length > 0
      ? scopedStructureSections
      : targetSectionKeys.map(sectionKey => {
        const existingSection = (proposalModel?.sections || []).find(section => section.key === sectionKey);
        return {
          key: sectionKey,
          title: existingSection?.title || sectionKey,
          fileKey: existingSection?.fileKey || DEFAULT_FILE_KEY,
          rationale: 'Targeted repair section.',
        };
      }),
  };

  const retrievalQuery = [
    ...effectiveStructure.sections.map(section => `${section.title || ''} ${section.rationale || ''}`),
    ...findings.map(finding => finding.issue || ''),
    contextSummary,
  ].filter(Boolean).join('\n');

  const resolvedFrameworkSections = Array.isArray(frameworkSections) && frameworkSections.length > 0
    ? frameworkSections
    : (await retrieveFrameworkSections({
      queryText: retrievalQuery,
      intents: ['delivery-methodology', 'quality', 'governance'],
      limit: 5,
    }, queryFn)).sections;
  const resolvedCompanySections = Array.isArray(companySections) && companySections.length > 0
    ? companySections
    : (await retrieveCompanyProfileSections({
      queryText: retrievalQuery,
      intents: ['company-profile', 'delivery-capability'],
      limit: 5,
    }, queryFn)).sections;

  const repaired = authorProposalSections({
    proposalStructure: effectiveStructure,
    requirements,
    evidenceItems,
    frameworkSections: resolvedFrameworkSections,
    companySections: resolvedCompanySections,
    targetSectionKeys,
  });

  const repairedModel = {
    structure: proposalStructure,
    sections: mergeCanonicalSections(proposalModel?.sections || [], repaired.sections || [], proposalStructure),
  };

  return {
    proposalModel: {
      ...repairedModel,
      markdown: renderCanonicalProposalMarkdown(repairedModel),
    },
    targetSectionKeys,
    frameworkSections: resolvedFrameworkSections,
    companySections: resolvedCompanySections,
    repairMode: 'targeted-section-rerun',
  };
}

export function evaluateCoverageGate(requirements = [], proposalModel) {
  const findings = [];
  const mandatoryRequirements = requirements.filter(item => item?.obligation_level === 'mandatory');

  for (const requirement of mandatoryRequirements) {
    const text = requirement?.text || requirement?.normalized_text || '';
    const covered = (proposalModel.sections || []).some(section => hasStrongRequirementCoverage(requirement, `${section.title || ''}\n${section.content || ''}`));
    if (!covered) {
      findings.push({
        gateKey: 'quality.coverage',
        severity: 'high',
        requirementId: requirement.id || null,
        issue: `Mandatory requirement not mapped in proposal: ${text.slice(0, 180)}`,
        requiredFix: 'Add or update a proposal section that explicitly responds to this requirement.',
        status: 'open',
      });
    }
  }

  return {
    status: findings.length === 0 ? 'pass' : 'fail',
    findings,
  };
}

export function evaluateEvidenceGate(claims = [], claimEvidenceLinks = []) {
  const linkedClaimIds = new Set(
    claimEvidenceLinks
      .filter(link => link?.evidenceId !== null && link?.evidenceId !== undefined)
      .map(link => link.claimTempId)
  );
  const findings = [];

  for (const claim of claims) {
    if (claim.classification === 'assumption' || claim.classification === 'recommendation') continue;
    if (!linkedClaimIds.has(claim.tempId)) {
      findings.push({
        gateKey: 'quality.evidence',
        severity: claim.classification === 'commitment' ? 'critical' : 'high',
        issue: `Claim is not grounded in evidence: ${claim.claimText.slice(0, 180)}`,
        requiredFix: 'Add evidence-backed support or relabel as explicit assumption/recommendation.',
        status: 'open',
      });
    }
  }

  return {
    status: findings.length === 0 ? 'pass' : 'fail',
    findings,
  };
}

export function evaluateConsistencyGate(proposalModel) {
  const findings = [];
  const text = normalizeText(proposalModel.markdown || '');
  if (/\bnot in scope\b/.test(text) && /\bin scope\b/.test(text)) {
    findings.push({
      gateKey: 'quality.consistency',
      severity: 'high',
      issue: 'Proposal contains both in-scope and out-of-scope statements for overlapping content.',
      requiredFix: 'Align scope statements and keep one canonical scope position.',
      status: 'open',
    });
  }

  return {
    status: findings.length === 0 ? 'pass' : 'fail',
    findings,
  };
}

export function evaluateEstimationReconciliationGate(proposalModel) {
  const findings = [];
  const text = normalizeText(proposalModel.markdown || '');
  const hasEstimate = /\b(hours|effort|wbs|estimate|pricing|commercial|cost|budget|timeline|weeks)\b/.test(text);
  const hasDeliveryCommitment = /\b(deliver|implementation|development|phase|sprint|milestone)\b/.test(text);

  if (hasDeliveryCommitment && !hasEstimate) {
    findings.push({
      gateKey: 'quality.estimation',
      severity: 'high',
      issue: 'Delivery commitments are present without effort, schedule, WBS, or commercial reconciliation.',
      requiredFix: 'Reconcile delivery scope with estimation, schedule, and commercial assumptions.',
      status: 'open',
    });
  }

  return {
    status: findings.length === 0 ? 'pass' : 'fail',
    findings,
  };
}

export function evaluateSubmissionComplianceGate(requirements = [], proposalModel) {
  const findings = [];
  const submissionRequirements = requirements.filter(requirement => {
    const text = normalizeText(`${requirement.text || ''} ${requirement.normalized_text || ''} ${requirement.category || ''} ${requirement.response_type || ''}`);
    return /\b(attachment|form|annex|appendix|signature|signed|template|format|submission|deadline|portal|excel|xlsx|pdf|docx)\b/.test(text);
  });

  for (const requirement of submissionRequirements) {
    const text = firstNonEmpty(requirement.text, requirement.normalized_text);
    const covered = (proposalModel.sections || []).some(section => hasStrongRequirementCoverage(requirement, `${section.title || ''}\n${section.content || ''}`));
    if (!covered) {
      findings.push({
        gateKey: 'quality.submission',
        severity: requirement.obligation_level === 'mandatory' ? 'critical' : 'medium',
        requirementId: requirement.id || null,
        issue: `Submission instruction is not explicitly addressed: ${text.slice(0, 180)}`,
        requiredFix: 'Add a submission compliance note, required attachment, or explicit owner/status for this instruction.',
        status: 'open',
      });
    }
  }

  return {
    status: findings.length === 0 ? 'pass' : 'fail',
    findings,
  };
}

export function evaluateFrameworkCompanyAccuracyGate(claims = [], claimEvidenceLinks = []) {
  const linkedClaimIds = new Set(claimEvidenceLinks.map(link => link.claimTempId));
  const findings = [];

  for (const claim of claims) {
    const text = normalizeText(claim.claimText);
    const looksLikeCompanyClaim = /\b(andersen|certified|iso|global|delivered|clients|employees|development centers|framework|methodology|case study)\b/.test(text);
    if (!looksLikeCompanyClaim || claim.classification === 'assumption') continue;
    if (!linkedClaimIds.has(claim.tempId)) {
      findings.push({
        gateKey: 'quality.framework-company',
        severity: 'high',
        issue: `Framework/company claim lacks approved evidence link: ${claim.claimText.slice(0, 180)}`,
        requiredFix: 'Ground the company or methodology statement in approved framework/company evidence, or remove it.',
        status: 'open',
      });
    }
  }

  return {
    status: findings.length === 0 ? 'pass' : 'fail',
    findings,
  };
}

export function evaluateStyleUsabilityGate(proposalModel) {
  const findings = [];
  const markdown = String(proposalModel.markdown || '');
  const text = normalizeText(markdown);
  const sectionCount = Array.isArray(proposalModel.sections) ? proposalModel.sections.length : 0;

  if (sectionCount < 3) {
    findings.push({
      gateKey: 'quality.style-usability',
      severity: 'medium',
      issue: 'Proposal has fewer than three top-level sections, which weakens scanability for evaluators.',
      requiredFix: 'Structure the proposal into clear evaluator-facing sections with descriptive headings.',
      status: 'open',
    });
  }
  if (/\b(tbd|tbc|todo|lorem ipsum|placeholder)\b|\[tbc\s*[—-]/.test(text)) {
    findings.push({
      gateKey: 'quality.style-usability',
      severity: 'high',
      issue: 'Proposal contains placeholder text.',
      requiredFix: 'Replace placeholders with final content, explicit assumptions, or a clear manual-completion marker.',
      status: 'open',
    });
  }
  if (/\bPROJECT_NAME\b|\bCLIENT_NAME\b|\{\{\s*CLIENT\s*\}\}|\bMM\/YYYY\b|\bYYYY\b/.test(markdown)) {
    findings.push({
      gateKey: 'quality.style-usability',
      severity: 'high',
      issue: 'Proposal contains unresolved template placeholders (for example PROJECT_NAME, CLIENT, or YYYY).',
      requiredFix: 'Replace all template placeholders with real deal values or explicit approved assumptions.',
      status: 'open',
    });
  }
  if (/\b(about\s+andersen|why\s+choose\s+andersen|industry\s+(overview|expertise)|marketing\s+message|value\s+proposition)\b/i.test(markdown)) {
    findings.push({
      gateKey: 'quality.style-usability',
      severity: 'medium',
      issue: 'Proposal still contains boilerplate marketing/template sections not tailored to the deal.',
      requiredFix: 'Remove generic marketing boilerplate and keep only requirement-aligned, deal-specific content.',
      status: 'open',
    });
  }
  if (markdown.length > 0 && markdown.split(/\s+/).length / Math.max(sectionCount, 1) > 650) {
    findings.push({
      gateKey: 'quality.style-usability',
      severity: 'medium',
      issue: 'Proposal sections are long on average and may be difficult for evaluators to scan.',
      requiredFix: 'Break long sections into focused subsections, tables, or bullet-led responses.',
      status: 'open',
    });
  }

  return {
    status: findings.length === 0 ? 'pass' : 'fail',
    findings,
  };
}

export function evaluateReleaseReadiness(findings = []) {
  const blockingFindings = (findings || []).filter(finding => (
    finding?.severity === 'critical'
    || (finding?.gateKey === 'quality.coverage' && finding?.severity === 'high')
    || (finding?.gateKey === 'quality.evidence' && finding?.severity === 'high')
    || (finding?.gateKey === 'quality.submission' && finding?.severity === 'high')
    || finding?.gateKey === 'quality.style-usability'
  ));
  return {
    ready: blockingFindings.length === 0,
    blockingFindings,
    reason: blockingFindings.length === 0
      ? null
      : 'Mandatory submission, evidence, or client-facing quality findings remain unresolved.',
  };
}

export function buildRepairTasksFromFindings(findings = []) {
  return uniqueBy(findings, finding => `${finding.gateKey || ''}:${finding.requirementId || ''}:${finding.issue || finding.requiredFix || ''}`)
    .map((finding, index) => ({
    id: `repair-${index + 1}`,
    type: finding.gateKey || 'quality.repair',
    severity: finding.severity || 'medium',
    instruction: finding.requiredFix || finding.issue || 'Resolve quality finding.',
  }));
}

export async function persistClaimsAndFindings({
  sessionId,
  dealId,
  claims = [],
  claimEvidenceLinks = [],
  findings = [],
  queryFn = query,
}) {
  try {
    await queryFn('DELETE FROM ai_findings WHERE session_id = $1', [sessionId]);
    await queryFn('DELETE FROM ai_claim_evidence WHERE claim_id IN (SELECT id FROM ai_claims WHERE session_id = $1)', [sessionId]);
    await queryFn('DELETE FROM ai_claims WHERE session_id = $1', [sessionId]);

    const claimIdByTempId = new Map();
    for (const claim of claims) {
      const result = await queryFn(
        `INSERT INTO ai_claims (session_id, deal_id, artifact_id, section_key, claim_text, classification, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          sessionId,
          dealId,
          null,
          claim.sectionKey || null,
          claim.claimText,
          claim.classification || 'source_fact',
          claim.status || 'open',
        ]
      );
      const insertedId = result?.rows?.[0]?.id || `temp-${claim.tempId}`;
      claimIdByTempId.set(claim.tempId, insertedId);
    }

    for (const link of claimEvidenceLinks) {
      const claimId = claimIdByTempId.get(link.claimTempId);
      if (!claimId || !link.evidenceId) continue;
      await queryFn(
        `INSERT INTO ai_claim_evidence (claim_id, evidence_item_id, relationship)
         VALUES ($1, $2, $3)`,
        [claimId, link.evidenceId, link.relationship || 'supports']
      );
    }

    const findingIds = [];
    for (const finding of findings) {
      const result = await queryFn(
        `INSERT INTO ai_findings (session_id, deal_id, gate_key, severity, requirement_id, artifact_id, issue, required_fix, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          sessionId,
          dealId,
          finding.gateKey || 'quality.unknown',
          finding.severity || 'medium',
          finding.requirementId || null,
          finding.artifactId || null,
          finding.issue || 'Quality issue',
          finding.requiredFix || 'Apply targeted correction.',
          finding.status || 'open',
        ]
      );
      findingIds.push(result?.rows?.[0]?.id || null);
    }

    return {
      findingIds,
    };
  } catch (err) {
    if (err?.code === '42P01') {
      return { findingIds: [] };
    }
    throw err;
  }
}

export async function runPhase5QualityRepairLoop({
  sessionId,
  dealId,
  initialProposalMarkdown,
  requirements = [],
  evidenceItems = [],
  maxRepairCycles = 2,
  contextSummary = '',
  proposalStructure = null,
  rerunProposalSections = null,
  frameworkSections = [],
  companySections = [],
  regenerateProposal,
  onCycle = null,
  queryFn = query,
}) {
  let proposalMarkdown = String(initialProposalMarkdown || '');
  const resolvedStructure = proposalStructure || buildProposalStructure({
    requirementInventory: requirements,
    contextSummary,
    existingMarkdown: proposalMarkdown,
  });
  let proposalModel = buildCanonicalProposalModel(proposalMarkdown, resolvedStructure);
  let cycle = 0;
  let finalFindings = [];
  let finalClaims = [];
  let finalLinks = [];
  let finalModel = proposalModel;
  let resolvedFrameworkSections = Array.isArray(frameworkSections) ? frameworkSections : [];
  let resolvedCompanySections = Array.isArray(companySections) ? companySections : [];

  while (cycle <= maxRepairCycles) {
    proposalModel = {
      ...proposalModel,
      markdown: renderCanonicalProposalMarkdown(proposalModel),
    };
    const combinedEvidenceItems = [
      ...(Array.isArray(evidenceItems) ? evidenceItems : []),
      ...buildKnowledgeEvidenceItems(resolvedFrameworkSections, resolvedCompanySections),
    ];
    const claims = extractClaimsFromProposalModel(proposalModel);
    const claimEvidenceLinks = linkClaimsToEvidence(claims, combinedEvidenceItems);

    const coverage = evaluateCoverageGate(requirements, proposalModel);
    const evidence = evaluateEvidenceGate(claims, claimEvidenceLinks);
    const consistency = evaluateConsistencyGate(proposalModel);
    const estimation = evaluateEstimationReconciliationGate(proposalModel);
    const submission = evaluateSubmissionComplianceGate(requirements, proposalModel);
    const frameworkCompany = evaluateFrameworkCompanyAccuracyGate(claims, claimEvidenceLinks);
    const styleUsability = evaluateStyleUsabilityGate(proposalModel);
    const findings = [
      ...coverage.findings,
      ...evidence.findings,
      ...consistency.findings,
      ...estimation.findings,
      ...submission.findings,
      ...frameworkCompany.findings,
      ...styleUsability.findings,
    ];

    const { findingIds } = await persistClaimsAndFindings({
      sessionId,
      dealId,
      claims,
      claimEvidenceLinks,
      findings,
      queryFn,
    });

    const repairTasks = buildRepairTasksFromFindings(findings);
    const targetSectionKeys = selectRepairTargetSectionKeys({
      findings,
      proposalModel,
      requirements,
    });

    await onCycle?.({ cycle, findings, findingIds, repairTasks, targetSectionKeys });

    finalFindings = findings;
    finalClaims = claims;
    finalLinks = claimEvidenceLinks;
    finalModel = proposalModel;

    if (findings.length === 0 || cycle >= maxRepairCycles) {
      break;
    }

    let repaired = null;
    if (targetSectionKeys.length > 0) {
      repaired = typeof rerunProposalSections === 'function'
        ? await rerunProposalSections({
          cycle,
          proposalModel,
          proposalStructure: resolvedStructure,
          findings,
          repairTasks,
          targetSectionKeys,
          requirements,
          evidenceItems,
          frameworkSections: resolvedFrameworkSections,
          companySections: resolvedCompanySections,
        })
        : await repairProposalModelSections({
          proposalModel,
          proposalStructure: resolvedStructure,
          findings,
          requirements,
          evidenceItems,
          frameworkSections: resolvedFrameworkSections,
          companySections: resolvedCompanySections,
          contextSummary,
          queryFn,
        });
    }

    if (repaired?.proposalModel) {
      proposalModel = repaired.proposalModel;
      proposalMarkdown = repaired.proposalModel.markdown;
      if (Array.isArray(repaired.frameworkSections) && repaired.frameworkSections.length > 0) {
        resolvedFrameworkSections = repaired.frameworkSections;
      }
      if (Array.isArray(repaired.companySections) && repaired.companySections.length > 0) {
        resolvedCompanySections = repaired.companySections;
      }
      cycle += 1;
      continue;
    }

    if (typeof regenerateProposal !== 'function') break;

    const repairedMarkdown = await regenerateProposal({
      cycle,
      proposalMarkdown,
      proposalModel,
      findings,
      repairTasks,
      targetSectionKeys,
    });
    if (!repairedMarkdown || repairedMarkdown === proposalMarkdown) break;
    proposalMarkdown = repairedMarkdown;
    proposalModel = buildCanonicalProposalModel(proposalMarkdown, resolvedStructure);
    cycle += 1;
  }

  return {
    proposalMarkdown: finalModel?.markdown || proposalMarkdown,
    canonicalProposalModel: finalModel
      ? {
        ...finalModel,
        markdown: renderCanonicalProposalMarkdown(finalModel),
      }
      : null,
    claims: finalClaims,
    claimEvidenceLinks: finalLinks,
    findings: finalFindings,
    repairTasks: buildRepairTasksFromFindings(finalFindings),
    repairCycles: cycle,
    qualityStatus: finalFindings.length === 0 ? 'pass' : 'fail',
  };
}
