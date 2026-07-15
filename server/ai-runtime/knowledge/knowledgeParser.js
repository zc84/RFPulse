function parseSemanticBlockMeta(metaText) {
  const idMatch = metaText.match(/\bid:\s*([^\n]+)/i);
  const titleMatch = metaText.match(/\btitle:\s*"([^"]+)"/i);

  return {
    id: idMatch ? String(idMatch[1]).trim() : null,
    title: titleMatch ? String(titleMatch[1]).trim() : null,
  };
}

export function parseFrameworkSemanticDocument(markdown = '') {
  const input = String(markdown || '');
  const sections = new Map();
  const pattern = /<!--META([\s\S]*?)-->\s*##\s*([^\n]+)\n([\s\S]*?)(?=(?:\n<!--META)|$)/g;

  let match;
  while ((match = pattern.exec(input)) !== null) {
    const [, metaText, headingTitle, body] = match;
    const parsedMeta = parseSemanticBlockMeta(metaText);
    if (!parsedMeta.id) continue;

    sections.set(parsedMeta.id, {
      id: parsedMeta.id,
      title: parsedMeta.title || String(headingTitle || '').trim(),
      content: String(body || '').trim(),
    });
  }

  return sections;
}
