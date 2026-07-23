const RENDERER_REGISTRY = Object.freeze({
  'proposal-docx': { tool: 'artifact.render.docx', renderer: 'proposalDocument' },
  'architecture-diagram': { tool: 'artifact.render.diagram', renderer: 'architectureDiagram' },
  'timeline-diagram': { tool: 'artifact.render.diagram', renderer: 'timelineDiagram' },
  'detailed-wbs-xlsx': { tool: 'artifact.render.xlsx', renderer: 'wbsWorkbook' },
  'compliance-matrix-xlsx': { tool: 'artifact.render.xlsx', renderer: 'complianceMatrixWorkbook' },
  'submission-manifest': { tool: 'artifact.render.markdown', renderer: 'submissionManifest' },
});

export function getArtifactRenderer(artifactKey) {
  return RENDERER_REGISTRY[artifactKey] || null;
}

export function listArtifactRenderers() {
  return Object.entries(RENDERER_REGISTRY).map(([artifactKey, definition]) => ({ artifactKey, ...definition }));
}

export function validateArtifactRendererSelection(artifactPlan) {
  const selected = artifactPlan?.selectedArtifactKeys || [];
  const unsupported = selected.filter(key => !getArtifactRenderer(key));
  if (unsupported.length > 0) {
    throw new Error(`No renderer registered for artifact(s): ${unsupported.join(', ')}`);
  }
  return selected.map(key => ({ artifactKey: key, ...getArtifactRenderer(key) }));
}
