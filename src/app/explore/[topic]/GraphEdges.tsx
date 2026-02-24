'use client';

import { useMemo } from 'react';
import { GraphNode } from './types';
import styles from './GraphEdges.module.css';

interface GraphEdgesProps {
  nodes: GraphNode[];
  hoveredNodeId: string | null;
  nodeHeights?: Map<string, number>;
  cardWidth?: number;
}

const DEFAULT_CARD_WIDTH = 400;
const DEFAULT_CARD_HEIGHT = 350;
const COLLAPSED_CARD_HEIGHT = 46;

function getAncestorPath(nodes: GraphNode[], nodeId: string): Set<string> {
  const edgeKeys = new Set<string>();
  let current = nodes.find((n) => n.id === nodeId);

  while (current?.parentId) {
    const parent = nodes.find((n) => n.id === current!.parentId);
    if (!parent) break;
    edgeKeys.add(`${parent.id}-${current.id}`);
    current = parent;
  }

  return edgeKeys;
}

export function GraphEdges({ nodes, hoveredNodeId, nodeHeights, cardWidth = DEFAULT_CARD_WIDTH }: GraphEdgesProps) {
  const edges: { from: GraphNode; to: GraphNode }[] = [];

  nodes.forEach((node) => {
    if (node.parentId) {
      const parent = nodes.find((n) => n.id === node.parentId);
      if (parent) {
        edges.push({ from: parent, to: node });
      }
    }
  });

  const highlightedEdges = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    return getAncestorPath(nodes, hoveredNodeId);
  }, [nodes, hoveredNodeId]);

  return (
    <svg className={styles.svg}>
      {edges.map(({ from, to }) => {
        const fromHeight = nodeHeights?.get(from.id) ?? (from.isExpanded ? DEFAULT_CARD_HEIGHT : COLLAPSED_CARD_HEIGHT);
        const toHeight = nodeHeights?.get(to.id) ?? (to.isExpanded ? DEFAULT_CARD_HEIGHT : COLLAPSED_CARD_HEIGHT);

        // Use actual card width for expanded, estimate for collapsed pills
        const fromWidth = from.isExpanded ? cardWidth : Math.min(cardWidth, 200);

        const x1 = from.position.x + fromWidth;
        const y1 = from.position.y + fromHeight / 2;
        const x2 = to.position.x;
        const y2 = to.position.y + toHeight / 2;

        // Ensure control points create smooth curves even for small gaps
        const dx = x2 - x1;
        const offset = Math.max(60, dx * 0.5);

        const isDashed = !to.isExpanded;
        const isHighlighted = highlightedEdges.has(`${from.id}-${to.id}`);

        return (
          <path
            key={`${from.id}-${to.id}`}
            d={`M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`}
            className={`${styles.edge} ${isDashed ? styles.dashed : ''} ${isHighlighted ? styles.highlighted : ''}`}
          />
        );
      })}
    </svg>
  );
}
