import json
import re
import sys
from copy import deepcopy
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.shared import Inches, Pt
from docx.oxml.ns import qn

ROBOTO = 'Roboto'
CONTENT_MARKER = '{{PROPOSAL_CONTENT}}'
PREFERRED_TABLE_STYLE = 'Plain Table 3'
TECHNICAL_SECTION_PATTERNS = [
  re.compile(r'^\s*#{1,6}\s+.*\b(proposed architecture|solution architecture|technical solution|proposed solution|solution overview|architecture)\b.*$', re.IGNORECASE),
]
TIMELINE_SECTION_PATTERN = re.compile(r'^\s*#{1,6}\s+.*\b(timeline|implementation plan|delivery plan|roadmap|project schedule|schedule)\b.*$', re.IGNORECASE)
HEADING_PATTERN = re.compile(r'^(#{1,6})\s+(.*)$')
PHASE_LINE_PATTERN = re.compile(r'\bphase\s+([ivx]+|\d+)\b', re.IGNORECASE)
DURATION_PATTERN = re.compile(r'(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months)\b', re.IGNORECASE)


def set_run_font(run, size=11, bold=None, italic=None):
  run.font.name = ROBOTO
  rPr = run._element.get_or_add_rPr()
  rFonts = rPr.rFonts
  if rFonts is None:
    rFonts = OxmlElement('w:rFonts')
    rPr.append(rFonts)
  rFonts.set(qn('w:eastAsia'), ROBOTO)
  run.font.size = Pt(size)
  if bold is not None:
    run.bold = bold
  if italic is not None:
    run.italic = italic


def set_style_font(style, size, bold=False):
  style.font.name = ROBOTO
  rPr = style._element.get_or_add_rPr()
  rFonts = rPr.rFonts
  if rFonts is None:
    rFonts = OxmlElement('w:rFonts')
    rPr.append(rFonts)
  rFonts.set(qn('w:eastAsia'), ROBOTO)
  style.font.size = Pt(size)
  style.font.bold = bold


def configure_document_layout(doc):
  for section in doc.sections:
    section.top_margin = Inches(0.9)
    section.bottom_margin = Inches(0.9)
    section.left_margin = Inches(0.9)
    section.right_margin = Inches(0.9)

  if 'Normal' in doc.styles:
    normal = doc.styles['Normal'].paragraph_format
    normal.space_before = Pt(0)
    normal.space_after = Pt(10)
    normal.line_spacing = 1.15

  for style_name, before, after, keep_with_next in [
    ('Title', 0, 14, False),
    ('Heading 1', 24, 12, True),
    ('Heading 2', 18, 10, True),
    ('Heading 3', 14, 8, True),
  ]:
    if style_name in doc.styles:
      pf = doc.styles[style_name].paragraph_format
      pf.space_before = Pt(before)
      pf.space_after = Pt(after)
      pf.keep_with_next = keep_with_next

  for style_name in ['List Bullet', 'List Number']:
    if style_name in doc.styles:
      pf = doc.styles[style_name].paragraph_format
      pf.left_indent = Inches(0.25)
      pf.space_before = Pt(0)
      pf.space_after = Pt(4)
      pf.line_spacing = 1.1


def configure_styles(doc):
  for style_name, size, bold in [
    ('Normal', 11, False),
    ('Title', 23, True),
    ('Heading 1', 23, True),
    ('Heading 2', 18, True),
    ('Heading 3', 16, True),
    ('List Bullet', 11, False),
    ('List Number', 11, False),
  ]:
    if style_name in doc.styles:
      set_style_font(doc.styles[style_name], size, bold)
  configure_document_layout(doc)


def has_style(doc, style_name):
  try:
    doc.styles[style_name]
    return True
  except KeyError:
    return False


def clean_inline(text):
  text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'\1 (\2)', text)
  text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1 (\2)', text)
  text = re.sub(r'(\*\*|__)(.*?)\1', r'\2', text)
  text = re.sub(r'(\*|_)(.*?)\1', r'\2', text)
  text = re.sub(r'`([^`]*)`', r'\1', text)
  return text.strip()


def add_paragraph_text(doc, text, style='Normal', align=None, bold=False, italic=False):
  if not has_style(doc, style):
    style = 'Normal'
  para = doc.add_paragraph(style=style)
  if align is not None:
    para.alignment = align
  run = para.add_run(clean_inline(text))
  font_size = 23 if style in ('Title', 'Heading 1') else 18 if style == 'Heading 2' else 16 if style == 'Heading 3' else 11
  set_run_font(run, size=font_size, bold=bold, italic=italic)
  if style in ('List Bullet', 'List Number'):
    para.paragraph_format.left_indent = Inches(0.25)
  return para


def style_existing_paragraph(paragraph, size=11, bold=None, italic=None):
  for run in paragraph.runs:
    set_run_font(run, size=size, bold=bold, italic=italic)


def is_table_separator(line):
  return bool(re.match(r'^\s*\|?[\s:-]+(\|[\s:-]+)+\|?\s*$', line))


def parse_table_row(line):
  cells = [clean_inline(cell.replace(r'\|', '|').strip()) for cell in line.strip().strip('|').split('|')]
  return cells


def preferred_table_style_name(doc):
  if has_style(doc, PREFERRED_TABLE_STYLE):
    return PREFERRED_TABLE_STYLE
  if has_style(doc, 'Table Grid'):
    return 'Table Grid'
  return None


def apply_table_style(table, style_name):
  if not style_name:
    return
  table.style = style_name


def normalize_table_styles(doc):
  style_name = preferred_table_style_name(doc)
  if not style_name:
    return
  for table in doc.tables:
    apply_table_style(table, style_name)


def clear_paragraph_content(paragraph):
  p = paragraph._p
  for child in list(p):
    p.remove(child)


def add_markdown(doc, markdown):
  lines = markdown.splitlines()
  paragraph_buffer = []
  table_style_name = preferred_table_style_name(doc)

  def flush_paragraph():
    nonlocal paragraph_buffer
    if paragraph_buffer:
      text = clean_inline(' '.join(part.strip() for part in paragraph_buffer if part.strip()))
      if text:
        add_paragraph_text(doc, text)
      paragraph_buffer = []

  i = 0
  while i < len(lines):
    line = lines[i].rstrip('\n')
    stripped = line.strip()

    if not stripped:
      flush_paragraph()
      i += 1
      continue

    heading = re.match(r'^(#{1,6})\s+(.*)$', stripped)
    if heading:
      flush_paragraph()
      level = min(len(heading.group(1)), 3)
      heading_style = f'Heading {level}' if has_style(doc, f'Heading {level}') else 'Normal'
      heading_para = doc.add_paragraph(clean_inline(heading.group(2)), style=heading_style)
      heading_para.paragraph_format.space_before = Pt(24 if level == 1 else 18 if level == 2 else 14)
      heading_para.paragraph_format.space_after = Pt(12 if level == 1 else 10 if level == 2 else 8)
      heading_para.paragraph_format.keep_with_next = True
      style_existing_paragraph(heading_para, size=23 if level == 1 else 18 if level == 2 else 16, bold=True)
      i += 1
      continue

    if stripped.startswith('```'):
      flush_paragraph()
      code_lines = []
      i += 1
      while i < len(lines) and not lines[i].strip().startswith('```'):
        code_lines.append(lines[i].rstrip('\n'))
        i += 1
      add_paragraph_text(doc, '\n'.join(code_lines), style='Normal')
      i += 1
      continue

    if stripped.startswith('|') and '|' in stripped[1:]:
      flush_paragraph()
      table_rows = []
      while i < len(lines):
        row_line = lines[i].rstrip('\n')
        row_stripped = row_line.strip()
        if not row_stripped.startswith('|') or is_table_separator(row_stripped):
          if is_table_separator(row_stripped):
            i += 1
            continue
          break
        table_rows.append(parse_table_row(row_stripped))
        i += 1
      if table_rows:
        max_cols = max(len(row) for row in table_rows)
        table = doc.add_table(rows=len(table_rows), cols=max_cols)
        apply_table_style(table, table_style_name)
        for r_index, row in enumerate(table_rows):
          for c_index in range(max_cols):
            text = row[c_index] if c_index < len(row) else ''
            cell_para = table.rows[r_index].cells[c_index].paragraphs[0]
            cell_para.text = ''
            run = cell_para.add_run(text)
            set_run_font(run, size=10, bold=(r_index == 0))
        doc.add_paragraph('')
      continue

    bullet = re.match(r'^\s*[-*]\s+(.*)$', stripped)
    if bullet:
      flush_paragraph()
      add_paragraph_text(doc, bullet.group(1), style='List Bullet')
      i += 1
      continue

    numbered = re.match(r'^\s*\d+\.\s+(.*)$', stripped)
    if numbered:
      flush_paragraph()
      add_paragraph_text(doc, numbered.group(1), style='List Number')
      i += 1
      continue

    quote = re.match(r'^\s*>\s+(.*)$', stripped)
    if quote:
      flush_paragraph()
      add_paragraph_text(doc, quote.group(1), italic=True)
      i += 1
      continue

    paragraph_buffer.append(stripped)
    i += 1

  flush_paragraph()


def add_diagrams(doc, diagrams):
  if not diagrams:
    return
  for index, diagram in enumerate(diagrams, start=1):
    image_path = diagram['path']
    if not Path(image_path).exists():
      raise FileNotFoundError(f'Diagram image not found: {image_path}')
    title = diagram.get('title') or 'Diagram'
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = para.add_run()
    run.add_picture(image_path, width=Inches(6.5))
    if title:
      caption = doc.add_paragraph(f'Figure {index}. {clean_inline(title)}')
      caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
      if caption.runs:
        set_run_font(caption.runs[0], size=11, italic=True)
    description = clean_inline(diagram.get('description') or '')
    if description:
      summary = doc.add_paragraph(description)
      if summary.runs:
        set_run_font(summary.runs[0], size=10)
    doc.add_paragraph('')


def trim_architecture_narrative_heading(markdown):
  lines = markdown.splitlines()
  if not lines:
    return markdown

  first_nonempty = None
  for idx, line in enumerate(lines):
    if line.strip():
      first_nonempty = idx
      break

  if first_nonempty is None:
    return markdown

  heading = HEADING_PATTERN.match(lines[first_nonempty].strip())
  if not heading:
    return markdown

  heading_text = heading.group(2).strip().lower()
  if heading_text not in ('architecture narrative', 'diagram narrative', 'architecture diagrams narrative'):
    return markdown

  start = first_nonempty + 1
  while start < len(lines) and not lines[start].strip():
    start += 1
  return '\n'.join(lines[start:]).strip()


def duration_to_weeks(duration_matches):
  total_weeks = 0.0
  for value, unit in duration_matches:
    amount = float(value)
    normalized = unit.lower()
    if normalized.startswith('day'):
      total_weeks += amount / 5.0
    elif normalized.startswith('week'):
      total_weeks += amount
    elif normalized.startswith('month'):
      total_weeks += amount * 4.0
  return total_weeks


def extract_timeline_phases(section_lines):
  phases = []
  seen = set()
  for raw in section_lines:
    line = raw.strip()
    if not line or line.startswith('|'):
      continue
    phase_match = PHASE_LINE_PATTERN.search(line)
    durations = DURATION_PATTERN.findall(line)
    if not phase_match or not durations:
      continue
    phase_label = phase_match.group(0).title()
    cleaned = clean_inline(re.sub(r'^[-*]\s+', '', line))
    name = cleaned.split(':', 1)[0] if ':' in cleaned else phase_label
    weeks = duration_to_weeks(durations)
    if weeks <= 0:
      continue
    key = name.lower()
    if key in seen:
      continue
    seen.add(key)
    phases.append({
      'name': name,
      'durationLabel': ', '.join([f"{value} {unit}" for value, unit in durations]),
      'weeks': weeks,
    })
  return phases


def build_gantt_markdown(phases):
  lines = [
    '### Delivery Timeline (Gantt View)',
    '| Phase | Duration | Start | Finish | Gantt |',
    '|---|---|---:|---:|---|',
  ]
  start_week = 1
  for phase in phases:
    duration_weeks = max(1, int(round(phase['weeks'])))
    end_week = start_week + duration_weeks - 1
    bar = f"W{start_week:02d}-W{end_week:02d} " + ('█' * duration_weeks)
    lines.append(f"| {phase['name']} | {phase['durationLabel']} | W{start_week:02d} | W{end_week:02d} | {bar} |")
    start_week = end_week + 1
  return lines


def inject_timeline_gantt(markdown):
  lines = markdown.splitlines()
  if any('gantt view' in line.lower() for line in lines):
    return markdown

  insertions = []
  i = 0
  while i < len(lines):
    heading = HEADING_PATTERN.match(lines[i].strip())
    if not heading:
      i += 1
      continue

    if not TIMELINE_SECTION_PATTERN.match(lines[i].strip()):
      i += 1
      continue

    current_level = len(heading.group(1))
    j = i + 1
    while j < len(lines):
      next_heading = HEADING_PATTERN.match(lines[j].strip())
      if next_heading and len(next_heading.group(1)) <= current_level:
        break
      j += 1

    section_lines = lines[i + 1:j]
    phases = extract_timeline_phases(section_lines)
    if len(phases) >= 2:
      insertions.append((j, [''] + build_gantt_markdown(phases) + ['']))
    i = j

  if not insertions:
    return markdown

  for index, block in sorted(insertions, key=lambda item: item[0], reverse=True):
    lines[index:index] = block

  return '\n'.join(lines)


def split_markdown_for_diagrams(markdown):
  lines = markdown.splitlines()
  for idx, line in enumerate(lines):
    if any(pattern.match(line.strip()) for pattern in TECHNICAL_SECTION_PATTERNS):
      before = '\n'.join(lines[: idx + 1]).strip()
      after = '\n'.join(lines[idx + 1 :]).strip()
      return before, after
  return markdown.strip(), ''


def create_content_document(title, markdown, diagrams):
  doc = Document()
  doc._body.clear_content()
  configure_styles(doc)

  # Add a professional timeline visualization when the proposal includes phased timeline data.
  markdown = inject_timeline_gantt(markdown)

  doc.add_paragraph(title, style='Title')
  style_existing_paragraph(doc.paragraphs[-1], size=23, bold=True)
  doc.add_paragraph('')

  if diagrams:
    before, after = split_markdown_for_diagrams(markdown)
    add_markdown(doc, before)
    add_diagrams(doc, diagrams)
    add_markdown(doc, trim_architecture_narrative_heading(after))
  else:
    add_markdown(doc, markdown)

  normalize_table_styles(doc)

  return doc


def body_insert_index(body):
  if len(body) > 0 and body[-1].tag == qn('w:sectPr'):
    return len(body) - 1
  return len(body)


def append_body_content(target_doc, source_doc):
  target_body = target_doc.element.body
  insert_at = body_insert_index(target_body)
  for child in source_doc.element.body:
    if child.tag == qn('w:sectPr'):
      continue
    target_body.insert(insert_at, deepcopy(child))
    insert_at += 1


def insert_body_content_after_paragraph(target_doc, paragraph, source_doc):
  parent = paragraph._p.getparent()
  insert_at = parent.index(paragraph._p) + 1
  for child in source_doc.element.body:
    if child.tag == qn('w:sectPr'):
      continue
    parent.insert(insert_at, deepcopy(child))
    insert_at += 1


def render_into_template(template_path, content_doc):
  doc = Document(template_path)
  # Keep the template's original section layout intact (cover margins/positioning,
  # custom spacings, anchored objects). Applying global style/layout normalization
  # here can shift template-aligned content.

  marker_paragraph = None
  for paragraph in doc.paragraphs:
    if CONTENT_MARKER in paragraph.text:
      marker_paragraph = paragraph
      break

  if marker_paragraph is None:
    append_body_content(doc, content_doc)
    normalize_table_styles(doc)
    return doc

  marker_text = marker_paragraph.text.strip()
  remove_marker_paragraph = marker_text == CONTENT_MARKER
  if not remove_marker_paragraph:
    replacement_text = marker_paragraph.text.replace(CONTENT_MARKER, '').strip()
    clear_paragraph_content(marker_paragraph)
    if replacement_text:
      run = marker_paragraph.add_run(replacement_text)
      set_run_font(run, size=11)
    else:
      remove_marker_paragraph = True

  insert_body_content_after_paragraph(doc, marker_paragraph, content_doc)

  if remove_marker_paragraph:
    marker_paragraph._p.getparent().remove(marker_paragraph._p)

  normalize_table_styles(doc)

  return doc


def main():
  payload = json.loads(sys.stdin.read() or '{}')
  markdown = payload.get('markdown') or ''
  output_path = payload['outputPath']
  title = payload.get('title') or 'Proposal'
  template_path = payload.get('templatePath')
  diagrams = payload.get('diagrams') or []

  if template_path and Path(template_path).exists():
    content_doc = create_content_document(title, markdown, diagrams)
    doc = render_into_template(template_path, content_doc)
  else:
    doc = create_content_document(title, markdown, diagrams)

  Path(output_path).parent.mkdir(parents=True, exist_ok=True)
  doc.save(output_path)


if __name__ == '__main__':
  main()
