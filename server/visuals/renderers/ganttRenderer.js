import {
  PALETTE,
  indexById,
  rasterizeSvg,
  renderSvgDocument,
  renderTextLines,
  wrapText,
} from './svgPrimitives.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const GROUP_COLORS = Object.freeze([
  { bar: '#176B87', pale: '#DDF3F8', text: '#0E5269' },
  { bar: '#6E4AA5', pale: '#EEE7F8', text: '#52357E' },
  { bar: '#D48B08', pale: '#FFF0CF', text: '#8A5800' },
  { bar: '#27845C', pale: '#DDF3E8', text: '#176241' },
  { bar: '#C84F6A', pale: '#F9E3E8', text: '#8D3046' },
  { bar: '#4667A8', pale: '#E4EAF7', text: '#304B82' },
]);

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
    return {
      ...task,
      group: task.group || 'Delivery',
      startDate: start,
      endDate: end,
      dependencies,
    };
  });
}

function dayOffset(date, origin) {
  return Math.round((date.getTime() - origin.getTime()) / DAY_MS);
}

function buildProjectMonthSegments(start, end) {
  const segments = [];
  const totalDays = dayOffset(end, start) + 1;
  for (let offset = 0, month = 1; offset < totalDays; offset += 28, month += 1) {
    segments.push({
      label: `M${month}`,
      startOffset: offset,
      durationDays: Math.min(28, totalDays - offset),
    });
  }
  return segments;
}

function formatProjectPosition(date, origin) {
  const offset = Math.max(0, dayOffset(date, origin));
  return {
    month: Math.floor(offset / 28) + 1,
    week: Math.floor((offset % 28) / 7) + 1,
  };
}

function formatTaskPeriod(task, origin) {
  const start = formatProjectPosition(task.startDate, origin);
  const end = formatProjectPosition(task.endDate, origin);
  const startLabel = `M${start.month} · WK${start.week}`;
  const endLabel = `M${end.month} · WK${end.week}`;
  return startLabel === endLabel ? startLabel : `${startLabel} → ${endLabel}`;
}

function renderMetric(x, label, value, width = 174) {
  return [
    `<rect x="${x}" y="118" width="${width}" height="58" rx="12" fill="${PALETTE.panel}" stroke="${PALETTE.border}"/>`,
    renderTextLines([label.toUpperCase()], x + 16, 139, { size: 9, weight: 700, fill: PALETTE.muted }),
    renderTextLines([value], x + 16, 163, { size: 18, weight: 700, fill: '#102A43' }),
  ].join('');
}

export function renderGantt(plan, options = {}) {
  const tasks = normalizeTasks(plan.content || {});
  const start = new Date(Math.min(...tasks.map(task => task.startDate.getTime())));
  const end = new Date(Math.max(...tasks.map(task => task.endDate.getTime())));
  const totalDays = Math.max(1, dayOffset(end, start) + 1);
  const groupNames = [...new Set(tasks.map(task => task.group))];
  const groupStyles = new Map(groupNames.map((group, index) => [
    group,
    GROUP_COLORS[index % GROUP_COLORS.length],
  ]));
  const milestoneCount = tasks.filter(task => task.milestone).length;
  const durationWeeks = Math.max(1, Math.ceil(totalDays / 7));

  const labelWidth = 360;
  const chartX = labelWidth + 34;
  const top = 242;
  const rowHeight = 68;
  const footerHeight = 70;
  const width = Math.max(1400, Math.min(2600, Number(options.width) || 1800));
  const height = Math.max(760, Number(options.height) || 0, top + tasks.length * rowHeight + footerHeight);
  if (height > 1800 || width * height > 3_500_000) {
    throw new Error('Gantt exceeds the maximum safe raster size.');
  }
  const chartWidth = width - chartX - 38;
  const scale = chartWidth / totalDays;
  const rowsBottom = top + tasks.length * rowHeight;

  const header = [
    `<rect x="0" y="0" width="${width}" height="194" fill="${PALETTE.white}"/>`,
    `<rect x="36" y="30" width="62" height="8" rx="4" fill="${PALETTE.yellow}"/>`,
    renderTextLines(wrapText(plan.title || 'Delivery Plan and Milestones', 90, 1), 36, 76, {
      size: 32,
      weight: 700,
      fill: '#102A43',
    }),
    renderTextLines(wrapText(plan.purpose || 'Delivery workstreams, dependencies, and key milestones', 130, 1), 36, 102, {
      size: 13,
      fill: PALETTE.secondary,
    }),
    renderMetric(36, 'Duration', `${durationWeeks} weeks`),
    renderMetric(224, 'Workstreams', String(groupNames.length)),
    renderMetric(412, 'Milestones', String(milestoneCount)),
    renderMetric(600, 'Delivery window', `M1 – M${Math.ceil(totalDays / 28)}`, 230),
    `<line x1="36" y1="193" x2="${width - 36}" y2="193" stroke="${PALETTE.border}"/>`,
  ].join('');

  const monthSegments = buildProjectMonthSegments(start, end);
  const timelineHeader = [
    `<rect x="0" y="194" width="${width}" height="48" fill="${PALETTE.panel}"/>`,
    renderTextLines(['WORKSTREAM / TASK'], 36, 207, { size: 9, weight: 700, fill: PALETTE.muted }),
    ...monthSegments.flatMap(segment => {
      const x = chartX + segment.startOffset * scale;
      const segmentWidth = Math.max(scale, segment.durationDays * scale);
      return [
      `<rect x="${x}" y="194" width="${segmentWidth}" height="48" fill="${PALETTE.panel}"/>`,
        renderTextLines([segment.label], x + 8, 207, { size: 11, weight: 700, fill: '#425466' }),
      ];
    }),
  ].join('');

  const calendarGrid = [];
  for (let day = 0; day <= totalDays; day += 7) {
    const x = chartX + day * scale;
    calendarGrid.push(
      `<line x1="${x}" y1="${top}" x2="${x}" y2="${rowsBottom}" stroke="${day % 28 === 0 ? '#C9D2DC' : '#E6E9ED'}" stroke-width="1"/>`
    );
    if (day < totalDays) {
      calendarGrid.push(
        renderTextLines([`WK${Math.floor((day % 28) / 7) + 1}`], x + 5, 231, { size: 9, fill: PALETTE.muted })
      );
    }
  }

  const taskPositions = new Map();
  const rowBackgrounds = [];
  const taskLabels = [];
  const bars = [];
  tasks.forEach((task, index) => {
    const y = top + index * rowHeight;
    const style = groupStyles.get(task.group);
    const barX = chartX + dayOffset(task.startDate, start) * scale;
    const durationDays = Math.max(1, dayOffset(task.endDate, task.startDate) + 1);
    const barWidth = Math.max(10, durationDays * scale);
    const barY = y + 29;
    const taskLabelLines = wrapText(task.label, 42, 2);
    const taskLabelY = y + (taskLabelLines.length > 1 ? 41 : 44);
    const taskDateY = y + (taskLabelLines.length > 1 ? 65 : 61);
    taskPositions.set(task.id, { x: barX, y: barY, width: barWidth, height: 24 });

    rowBackgrounds.push(
      `<rect x="0" y="${y}" width="${width}" height="${rowHeight}" fill="${index % 2 ? '#FBFCFD' : PALETTE.white}"/>`,
      `<rect x="0" y="${y}" width="7" height="${rowHeight}" fill="${style.bar}"/>`,
      `<line x1="36" y1="${y + rowHeight}" x2="${width - 36}" y2="${y + rowHeight}" stroke="${PALETTE.border}"/>`
    );
    taskLabels.push(
      `<rect x="36" y="${y + 10}" width="${Math.max(58, task.group.length * 6 + 18)}" height="18" rx="9" fill="${style.pale}"/>`,
      renderTextLines([task.group.toUpperCase()], 45, y + 23, { size: 8, weight: 700, fill: style.text }),
      renderTextLines(taskLabelLines, 36, taskLabelY, {
        size: 13,
        weight: 700,
        lineHeight: 14,
        fill: '#102A43',
      }),
      renderTextLines([formatTaskPeriod(task, start)], 36, taskDateY, {
        size: 8,
        fill: PALETTE.muted,
      })
    );
    if (task.milestone) {
      bars.push(
        `<path d="M ${barX} ${barY - 2} L ${barX + 14} ${barY + 12} L ${barX} ${barY + 26} L ${barX - 14} ${barY + 12} Z" fill="${PALETTE.yellow}" stroke="#102A43" stroke-width="1.5"/>`,
        renderTextLines(['MILESTONE'], barX + 20, barY + 16, { size: 8, weight: 700, fill: '#425466' })
      );
    } else {
      bars.push(
        `<rect x="${barX}" y="${barY}" width="${barWidth}" height="24" rx="7" fill="${style.bar}"/>`,
        `<rect x="${barX}" y="${barY}" width="${barWidth}" height="5" rx="2.5" fill="${style.pale}" opacity="0.65"/>`
      );
    }
  });

  const dependencyPaths = [];
  for (const task of tasks) {
    const target = taskPositions.get(task.id);
    for (const dependencyId of task.dependencies) {
      const source = taskPositions.get(dependencyId);
      if (!source || !target) continue;
      const startX = source.x + source.width;
      const startY = source.y + source.height / 2;
      const endX = target.x;
      const endY = target.y + target.height / 2;
      const elbowX = Math.max(startX + 9, Math.min(endX - 9, (startX + endX) / 2));
      dependencyPaths.push(
        `<path d="M ${startX} ${startY} L ${elbowX} ${startY} L ${elbowX} ${endY} L ${endX} ${endY}" fill="none" stroke="#6B7785" stroke-width="1.5" marker-end="url(#arrow)"/>`
      );
    }
  }

  const legendItems = groupNames.slice(0, 6).map((group, index) => {
    const style = groupStyles.get(group);
    const x = 36 + index * 190;
    return [
      `<circle cx="${x + 6}" cy="${height - 29}" r="6" fill="${style.bar}"/>`,
      renderTextLines([group], x + 18, height - 25, { size: 10, fill: PALETTE.secondary }),
    ].join('');
  });
  const milestoneLegendX = Math.min(width - 196, 36 + groupNames.slice(0, 6).length * 190);
  const footer = [
    `<rect x="0" y="${rowsBottom}" width="${width}" height="${footerHeight}" fill="${PALETTE.white}"/>`,
    `<line x1="36" y1="${rowsBottom + 10}" x2="${width - 36}" y2="${rowsBottom + 10}" stroke="${PALETTE.border}"/>`,
    ...legendItems,
    `<path d="M ${milestoneLegendX} ${height - 39} L ${milestoneLegendX + 10} ${height - 29} L ${milestoneLegendX} ${height - 19} L ${milestoneLegendX - 10} ${height - 29} Z" fill="${PALETTE.yellow}" stroke="#102A43"/>`,
    renderTextLines(['Milestone'], milestoneLegendX + 17, height - 25, { size: 10, fill: PALETTE.secondary }),
  ].join('');

  const body = [
    header,
    timelineHeader,
    ...rowBackgrounds,
    ...calendarGrid,
    ...dependencyPaths,
    ...taskLabels,
    ...bars,
    footer,
  ].join('');
  const svg = renderSvgDocument({ width, height, title: plan.title || 'Delivery Plan and Milestones', body });
  return {
    ...rasterizeSvg(svg, width, height),
    renderer: 'deterministic-gantt-v2',
  };
}

export const GANTT_RENDERER_VERSION = 'deterministic-gantt-v2';
