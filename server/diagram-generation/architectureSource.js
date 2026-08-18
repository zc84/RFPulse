const MARKDOWN_HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const ARCHITECTURE_SECTION_PATTERNS = [
  /^\s*#{1,6}\s+.*\b(proposed architecture|solution architecture|technical solution|proposed solution|solution overview|architecture)\b.*$/i,
];
const EXCLUDED_ARCHITECTURE_SUBSECTION_PATTERNS = [
  /^\s*#{1,6}\s+.*\b(implementation plan|timeline|delivery plan|roadmap|project schedule|schedule|wbs|work breakdown)\b.*$/i,
];

export function stripArchitectureDiagramPrompt(report = '') {
  const normalized = String(report || '');
  const marker = '\n\n## Architecture Diagram Prompt';
  const index = normalized.indexOf(marker);
  return index >= 0 ? normalized.slice(0, index).trim() : normalized.trim();
}

export function extractArchitectureDiagramSource(report = '') {
  const body = stripArchitectureDiagramPrompt(report);
  const lines = body.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const heading = MARKDOWN_HEADING_PATTERN.exec(line);
    if (!heading || !ARCHITECTURE_SECTION_PATTERNS.some(pattern => pattern.test(line))) continue;

    const sectionLevel = heading[1].length;
    let end = index + 1;
    while (end < lines.length) {
      const nextHeading = MARKDOWN_HEADING_PATTERN.exec(lines[end].trim());
      if (nextHeading && nextHeading[1].length <= sectionLevel) break;
      end += 1;
    }

    const kept = [lines[index]];
    let skippedSubsectionLevel = null;
    for (let cursor = index + 1; cursor < end; cursor += 1) {
      const currentLine = lines[cursor];
      const currentHeading = MARKDOWN_HEADING_PATTERN.exec(currentLine.trim());

      if (skippedSubsectionLevel !== null) {
        if (currentHeading && currentHeading[1].length <= skippedSubsectionLevel) {
          skippedSubsectionLevel = null;
        } else {
          continue;
        }
      }

      if (
        currentHeading
        && EXCLUDED_ARCHITECTURE_SUBSECTION_PATTERNS.some(
          pattern => pattern.test(currentLine.trim())
        )
      ) {
        skippedSubsectionLevel = currentHeading[1].length;
        continue;
      }

      kept.push(currentLine);
    }

    const extracted = kept.join('\n').trim();
    if (extracted) return extracted;
  }

  return body.trim();
}
