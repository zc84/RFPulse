import json
import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.shared import Inches, Pt
from docx.oxml.ns import qn

ROBOTO = 'Roboto'


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
  set_run_font(run, size=11 if style == 'Normal' else 11, bold=bold, italic=italic)
  if style in ('List Bullet', 'List Number'):
    para.paragraph_format.left_indent = Inches(0.25)
  return para


def is_table_separator(line):
  return bool(re.match(r'^\s*\|?[\s:-]+(\|[\s:-]+)+\|?\s*$', line))


def parse_table_row(line):
  cells = [clean_inline(cell.replace(r'\|', '|').strip()) for cell in line.strip().strip('|').split('|')]
  return cells


def add_markdown(doc, markdown):
  lines = markdown.splitlines()
  paragraph_buffer = []

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
      doc.add_paragraph(clean_inline(heading.group(2)), style=heading_style)
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
        if has_style(doc, 'Table Grid'):
          table.style = 'Table Grid'
        for r_index, row in enumerate(table_rows):
          for c_index in range(max_cols):
            text = row[c_index] if c_index < len(row) else ''
            cell_para = table.rows[r_index].cells[c_index].paragraphs[0]
            cell_para.text = ''
            run = cell_para.add_run(text)
            set_run_font(run, size=10)
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
  for diagram in diagrams:
    title = diagram.get('title') or 'Diagram'
    doc.add_paragraph(title, style='Heading 3')
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = para.add_run()
    run.add_picture(diagram['path'], width=Inches(6.5))
    if title:
      caption = doc.add_paragraph(clean_inline(title))
      caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
      if caption.runs:
        set_run_font(caption.runs[0], size=11, italic=True)


def main():
  payload = json.loads(sys.stdin.read() or '{}')
  markdown = payload.get('markdown') or ''
  output_path = payload['outputPath']
  title = payload.get('title') or 'Proposal'
  template_path = payload.get('templatePath')
  diagrams = payload.get('diagrams') or []

  if template_path and Path(template_path).exists():
    doc = Document(template_path)
    doc._body.clear_content()
  else:
    doc = Document()
    doc._body.clear_content()

  configure_styles(doc)

  doc.add_paragraph(title, style='Title')
  doc.add_paragraph('')

  add_markdown(doc, markdown)
  add_diagrams(doc, diagrams)

  Path(output_path).parent.mkdir(parents=True, exist_ok=True)
  doc.save(output_path)


if __name__ == '__main__':
  main()
