import type { GraphNode, HeightMap } from '@/shared/types';
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  COLLAPSED_HEIGHT,
  VERTICAL_GAP,
} from '../model/constants';

export function getNodeHeight(node: GraphNode, heights?: HeightMap): number {
  if (!node.isExpanded) return COLLAPSED_HEIGHT;
  return heights?.get(node.id) ?? CARD_HEIGHT;
}

export function hasCollision(
  pos: { x: number; y: number },
  height: number,
  existingNodes: GraphNode[],
  heights?: HeightMap,
  cardWidth: number = CARD_WIDTH
): boolean {
  for (const node of existingNodes) {
    const nodeH = getNodeHeight(node, heights);
    const overlapX = Math.abs(pos.x - node.position.x) < cardWidth + 20;
    const overlapY =
      pos.y < node.position.y + nodeH + VERTICAL_GAP &&
      pos.y + height + VERTICAL_GAP > node.position.y;
    if (overlapX && overlapY) return true;
  }
  return false;
}

export function resolveCollisions(nodes: GraphNode[], heights?: HeightMap): GraphNode[] {
  const result = nodes.map((n) => ({ ...n, position: { ...n.position } }));

  const childrenByParent = new Map<string, number[]>();
  result.forEach((node, idx) => {
    if (node.parentId) {
      if (!childrenByParent.has(node.parentId)) childrenByParent.set(node.parentId, []);
      childrenByParent.get(node.parentId)!.push(idx);
    }
  });

  childrenByParent.forEach((childIndices, parentId) => {
    const parent = result.find((n) => n.id === parentId);
    if (!parent) return;

    const parentCenterY = parent.position.y + getNodeHeight(parent, heights) / 2;
    childIndices.sort((a, b) => result[a].position.y - result[b].position.y);

    let totalHeight = 0;
    for (const idx of childIndices) {
      totalHeight += getNodeHeight(result[idx], heights);
    }
    totalHeight += (childIndices.length - 1) * VERTICAL_GAP;

    let currentY = parentCenterY - totalHeight / 2;
    for (const idx of childIndices) {
      result[idx].position.y = currentY;
      currentY += getNodeHeight(result[idx], heights) + VERTICAL_GAP;
    }
  });

  const columns = new Map<number, number[]>();
  result.forEach((node, idx) => {
    const col = Math.round(node.position.x / 100) * 100;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(idx);
  });

  let changed = true;
  let passes = 0;
  while (changed && passes < 10) {
    changed = false;
    passes++;

    columns.forEach((indices) => {
      indices.sort((a, b) => result[a].position.y - result[b].position.y);

      for (let i = 1; i < indices.length; i++) {
        const prev = result[indices[i - 1]];
        const curr = result[indices[i]];
        const prevHeight = getNodeHeight(prev, heights);
        const minY = prev.position.y + prevHeight + VERTICAL_GAP;

        if (curr.position.y < minY) {
          curr.position.y = minY;
          changed = true;
        }
      }
    });
  }

  return result;
}

export function fitAllNodes(
  allNodes: GraphNode[],
  viewportW: number,
  viewportH: number,
  cardWidth: number,
  heights?: HeightMap
): { zoom: number; pan: { x: number; y: number } } {
  if (allNodes.length === 0) return { zoom: 1, pan: { x: 0, y: 0 } };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of allNodes) {
    const w = node.isExpanded ? cardWidth : cardWidth * 0.55;
    const h = getNodeHeight(node, heights);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + w);
    maxY = Math.max(maxY, node.position.y + h);
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const pad = 60;
  const zoomX = (viewportW - pad * 2) / contentW;
  const zoomY = (viewportH - pad * 2) / contentH;
  const zoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.15), 1);

  const pan = {
    x: viewportW / 2 / zoom - centerX,
    y: viewportH / 2 / zoom - centerY,
  };

  return { zoom, pan };
}

export function calculateChildPositions(
  parentNode: GraphNode,
  count: number,
  existingNodes: GraphNode[],
  heights?: HeightMap,
  hGap: number = 540,
  cardWidth: number = CARD_WIDTH
): { x: number; y: number }[] {
  const x = parentNode.position.x + hGap;
  const parentCenterY = parentNode.position.y + getNodeHeight(parentNode, heights) / 2;

  const totalHeight = count * COLLAPSED_HEIGHT + (count - 1) * VERTICAL_GAP;
  const startY = parentCenterY - totalHeight / 2;

  const positions: { x: number; y: number }[] = [];

  for (let i = 0; i < count; i++) {
    const y = startY + i * (COLLAPSED_HEIGHT + VERTICAL_GAP);
    const pos = { x, y };

    const allToCheck = [
      ...existingNodes,
      ...positions.map((p) => ({
        position: p,
        isExpanded: false,
      } as GraphNode)),
    ];

    let attempts = 0;
    while (hasCollision(pos, COLLAPSED_HEIGHT, allToCheck, heights, cardWidth) && attempts < 50) {
      pos.y += COLLAPSED_HEIGHT + VERTICAL_GAP;
      attempts++;
    }

    positions.push({ x: pos.x, y: pos.y });
  }

  return positions;
}
