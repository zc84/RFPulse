import {
  PALETTE,
  indexById,
  rasterizeSvg,
  renderSvgDocument,
  renderTextLines,
  wrapText,
} from './svgPrimitives.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value, label) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must use YYYY-MM-DD`);
  return date;
}

function normalizeTasks(content) {
  const tasks = content.tasks || [];
  if (tasks.length === 0) throw new Error('gantt requires at least one task');
  const taskIndex = indexById(tasks, 'task');
  return tasks.map(task => {
    const start = parseDate(task.start, `Task '${task.id}'.start`);
    const end = parseDate(task.end || task.start, `Task '${task.id}'.end`);
    if (end < start) throw new Error(`Task '${task.id}' ends before it starts`);
    const dependencies = task.dependencies || [];
    for (const dependency of dependencies) {
      if (!taskIndex.has(dependency)) throw new Error(`Task '${task.id}' references unknown dependency '${dependency}'`);
    }
    return { ...task, startDate: start, endDate: end, dependencies };
  });
}

function dayOffset(date, origin) {
  return Math.round((date.getTime() - origin.getTime()) / DAY_MS);
}

export function renderGantt(plan, options = {}) {
  const tasks = normalizeTasks(plan.content || {});
  const start = new Date(Math.min(...tasks.map(task => task.startDate.getTime())));
  const end = new Date(Math.max(...tasks.map(task => task.endDate.getTime())));
  const totalDays = Math.max(1, dayOffset(end, start) + 1);
  const labelWidth = 340;
  const headerHeight = 168;
  const rowHeight = 64;
  const footerHeight = 42;
  const width = Math.max(1400, Math.min(2600, Number(options.width) || 1800));
  const height = Math.max(640, Number(options.height) || 0, headerHeight + tasks.length * rowHeight + footerHeight);
  if (height > 1600 || width * height > 3_500_000) {
    throw new Error('Gantt exceeds the maximum safe raster size.');
  }
  const chartX = labelWidth + 42;
  const chartWidth = width - chartX - 42;
  const scale = chartWidth / totalDays;

  const header = [
    `<rect width="${width}" height="112" fill="${PALETTE.ink}"/>`,
    `<rect x="36" y="28" width="54" height="9" rx="4.5" fill="${PALETTE.yellow}"/>`,
    renderTextLines(wrapText(plan.title || 'Delivery timeline', 110, 1), 36, 72, { size: 30, weight: 700, fill: PALETTE.white }),
    renderTextLines([`${start.toISOString().slice(0, 10)} — ${end.toISOString().slice(0, 10)} · ${tasks.length} tasks`], 36, 99, {
      size: 13,
      fill: '#D5D5D5',
    }),
    renderTextLines(['Workstream / task'], 36, 139, { size: 12, weight: 700, fill: PALETTE.secondary }),
    renderTextLines(['Schedule'], chartX, 139, { size: 12, weight: 700, fill: PALETTE.secondary }),
  ].join('');

  const weeklyLines = [];
  for (let day = 0; day <= totalDays; day += 7) {
    const x = chartX + day * scale;
    const date = new Date(start.getTime() + day * DAY_MS);
    weeklyLines.push(
      `<line x1="${x}" y1="${headerHeight - 8}" x2="${x}" y2="${height - footerHeight}" stroke="${PALETTE.border}" stroke-width="1"/>`,
      renderTextLines([date.toISOString().slice(5, 10)], x + 4, headerHeight - 17, { size: 10, fill: PALETTE.muted })
    );
  }

  const taskPositions = new Map();
  const rows = tasks.map((task, index) => {
    const y = headerHeight + index * rowHeight;
    const barX = chartX + dayOffset(task.startDate, start) * scale;
    const durationDays = Math.max(1, dayOffset(task.endDate, task.startDate) + 1);
    const barWidth = Math.max(12, durationDays * scale);
    taskPositions.set(task.id, { x: barX, y: y + 18, width: barWidth, height: 28 });
    const group = task.group ? `${task.group} · ` : '';
    return [
      `<rect x="0" y="${y}" width="${width}" height="${rowHeight}" fill="${index % 2 === 0 ? PALETTE.white : PALETTE.panel}"/>`,
      `<line x1="36" y1="${y + rowHeight}" x2="${width - 36}" y2="${y + rowHeight}" stroke="${PALETTE.border}"/>`,
      renderTextLines(wrapText(task.label, 35, 2), 36, y + 25, { size: 13, weight: 700, lineHeight: 16 }),
      renderTextLines([`${group}${task.start} → ${task.end || task.start}`], 36, y + 52, { size: 10, fill: PALETTE.muted }),
      task.milestone
        ? `<path d="M ${barX} ${y + 18} L ${barX + 14} ${y + 32} L ${barX} ${y + 46} L ${barX - 14} ${y + 32} Z" fill="${PALETTE.yellow}" stroke="${PALETTE.ink}"/>`
        : `<rect x="${barX}" y="${y + 18}" width="${barWidth}" height="28" rx="8" fill="${PALETTE.yellow}" stroke="${PALETTE.ink}" stroke-width="1"/>`,
    ].join('');
  });

  const dependencies = [];
  for (const task of tasks) {
    const target = taskPositions.get(task.id);
    for (const dependencyId of task.dependencies) {
      const source = taskPositions.get(dependencyId);
      if (!source || !target) continue;
      const startX = source.x + source.width;
      const startY = source.y + source.height / 2;
      const endX = target.x;
      const endY = target.y + target.height / 2;
      const midX = Math.max(startX + 8, (startX + endX) / 2);
      dependencies.push(
        `<path d="M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}" fill="none" stroke="${PALETTE.secondary}" stroke-width="1.5" marker-end="url(#arrow)"/>`
      );
    }
  }

  const body = [
    header,
    ...rows,
    ...weeklyLines,
    ...dependencies,
    renderTextLines(['Dates and dependencies rendered from structured source data.'], 36, height - 16, {
      size: 11,
      fill: PALETTE.muted,
    }),
  ].join('');
  const svg = renderSvgDocument({ width, height, title: plan.title || 'Gantt', body });
  return {
    ...rasterizeSvg(svg, width, height),
    renderer: 'deterministic-gantt-v1',
  };
}
