class MinHeap {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].score <= item.score) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }

  pop() {
    if (this.items.length === 0) return null;
    const root = this.items[0];
    const tail = this.items.pop();
    if (this.items.length === 0) return root;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.items.length) break;
      const smaller = right < this.items.length && this.items[right].score < this.items[left].score
        ? right
        : left;
      if (this.items[smaller].score >= tail.score) break;
      this.items[index] = this.items[smaller];
      index = smaller;
    }
    this.items[index] = tail;
    return root;
  }
}

function pointKey(x, y, direction) {
  return `${x}:${y}:${direction}`;
}

function cellKey(x, y) {
  return `${x}:${y}`;
}

function compress(points) {
  if (points.length <= 2) return points;
  const result = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = result[result.length - 1];
    const current = points[index];
    const next = points[index + 1];
    const sameX = previous.x === current.x && current.x === next.x;
    const sameY = previous.y === current.y && current.y === next.y;
    if (!sameX && !sameY) result.push(current);
  }
  result.push(points[points.length - 1]);
  return result;
}

export function createOrthogonalRouter({
  width,
  height,
  obstacles,
  cellSize = 10,
  margin = 8,
}) {
  const columns = Math.floor(width / cellSize);
  const rows = Math.floor(height / cellSize);
  const blocked = new Set();
  const occupied = new Map();

  for (const obstacle of obstacles) {
    const left = Math.max(0, Math.floor((obstacle.x - margin) / cellSize));
    const right = Math.min(columns - 1, Math.ceil((obstacle.x + obstacle.width + margin) / cellSize));
    const top = Math.max(0, Math.floor((obstacle.y - margin) / cellSize));
    const bottom = Math.min(rows - 1, Math.ceil((obstacle.y + obstacle.height + margin) / cellSize));
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) blocked.add(cellKey(x, y));
    }
  }

  function route(start, end) {
    const startCell = {
      x: Math.max(1, Math.min(columns - 2, Math.round(start.x / cellSize))),
      y: Math.max(1, Math.min(rows - 2, Math.round(start.y / cellSize))),
    };
    const endCell = {
      x: Math.max(1, Math.min(columns - 2, Math.round(end.x / cellSize))),
      y: Math.max(1, Math.min(rows - 2, Math.round(end.y / cellSize))),
    };
    blocked.delete(cellKey(startCell.x, startCell.y));
    blocked.delete(cellKey(endCell.x, endCell.y));

    const moves = [
      { dx: 1, dy: 0, direction: 'R' },
      { dx: -1, dy: 0, direction: 'L' },
      { dx: 0, dy: 1, direction: 'D' },
      { dx: 0, dy: -1, direction: 'U' },
    ];
    const heap = new MinHeap();
    const best = new Map();
    const previous = new Map();
    const initialKey = pointKey(startCell.x, startCell.y, 'N');
    best.set(initialKey, 0);
    heap.push({ ...startCell, direction: 'N', cost: 0, score: 0, key: initialKey });
    let final = null;

    while (true) {
      const current = heap.pop();
      if (!current) break;
      if (current.cost !== best.get(current.key)) continue;
      if (current.x === endCell.x && current.y === endCell.y) {
        final = current;
        break;
      }
      for (const move of moves) {
        const x = current.x + move.dx;
        const y = current.y + move.dy;
        if (x <= 0 || y <= 0 || x >= columns - 1 || y >= rows - 1) continue;
        const cell = cellKey(x, y);
        if (blocked.has(cell) && !(x === endCell.x && y === endCell.y)) continue;
        const turnPenalty = current.direction !== 'N' && current.direction !== move.direction ? 0.7 : 0;
        const occupancyPenalty = (occupied.get(cell) || 0) * 2.5;
        const cost = current.cost + 1 + turnPenalty + occupancyPenalty;
        const key = pointKey(x, y, move.direction);
        if (cost >= (best.get(key) ?? Number.POSITIVE_INFINITY)) continue;
        best.set(key, cost);
        previous.set(key, current.key);
        const heuristic = Math.abs(endCell.x - x) + Math.abs(endCell.y - y);
        heap.push({ x, y, direction: move.direction, cost, score: cost + heuristic, key });
      }
    }

    if (!final) {
      return [start, { x: start.x, y: end.y }, end];
    }

    const cells = [];
    let cursor = final.key;
    while (cursor) {
      const [x, y] = cursor.split(':').map(Number);
      cells.push({ x, y });
      cursor = previous.get(cursor);
    }
    cells.reverse();
    for (const cell of cells) {
      const key = cellKey(cell.x, cell.y);
      occupied.set(key, (occupied.get(key) || 0) + 1);
    }
    const points = [
      start,
      ...cells.slice(1, -1).map(cell => ({ x: cell.x * cellSize, y: cell.y * cellSize })),
      end,
    ];
    return compress(points);
  }

  return { route };
}
