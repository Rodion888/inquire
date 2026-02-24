'use client';

import { useMemo } from 'react';
import { GraphNode } from './types';
import styles from './Minimap.module.css';

interface MinimapProps {
  nodes: GraphNode[];
  zoom: number;
  pan: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
  cardWidth: number;
  onNavigate: (x: number, y: number) => void;
}

const CARD_HEIGHT = 350;
const COLLAPSED_HEIGHT = 46;
const PILL_WIDTH_RATIO = 0.55;

export function Minimap({ nodes, zoom, pan, viewportWidth, viewportHeight, cardWidth, onNavigate }: MinimapProps) {
  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, width: 1000, height: 1000 };
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    nodes.forEach((node) => {
      const h = node.isExpanded ? CARD_HEIGHT : COLLAPSED_HEIGHT;
      const w = node.isExpanded ? cardWidth : cardWidth * PILL_WIDTH_RATIO;
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + w);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + h);
    });

    // Include viewport
    const vpL = -pan.x;
    const vpT = -pan.y;
    const vpR = vpL + viewportWidth / zoom;
    const vpB = vpT + viewportHeight / zoom;
    minX = Math.min(minX, vpL);
    maxX = Math.max(maxX, vpR);
    minY = Math.min(minY, vpT);
    maxY = Math.max(maxY, vpB);

    const pad = 40;
    return {
      minX: minX - pad,
      minY: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }, [nodes, pan, zoom, viewportWidth, viewportHeight, cardWidth]);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    // Use SVG's native coordinate transform for accuracy with preserveAspectRatio
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const worldPt = pt.matrixTransform(ctm.inverse());
    onNavigate(viewportWidth / 2 / zoom - worldPt.x, viewportHeight / 2 / zoom - worldPt.y);
  };

  // Desktop: compute width from aspect ratio for inline style
  const desktopWidth = Math.max(100, Math.min(220, Math.round(172 * bounds.width / bounds.height)));

  return (
    <div className={styles.minimap} style={{ width: desktopWidth }}>
      <svg
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        preserveAspectRatio="xMidYMid meet"
        className={styles.svg}
        onClick={handleClick}
      >
        {/* Edges */}
        {nodes.map((node) => {
          if (!node.parentId) return null;
          const parent = nodes.find((n) => n.id === node.parentId);
          if (!parent) return null;

          const pH = parent.isExpanded ? CARD_HEIGHT : COLLAPSED_HEIGHT;
          const pW = parent.isExpanded ? cardWidth : cardWidth * PILL_WIDTH_RATIO;
          const nH = node.isExpanded ? CARD_HEIGHT : COLLAPSED_HEIGHT;

          const x1 = parent.position.x + pW;
          const y1 = parent.position.y + pH / 2;
          const x2 = node.position.x;
          const y2 = node.position.y + nH / 2;
          const dx = x2 - x1;
          const off = Math.max(60, dx * 0.5);

          return (
            <path
              key={`e-${parent.id}-${node.id}`}
              d={`M ${x1} ${y1} C ${x1 + off} ${y1}, ${x2 - off} ${y2}, ${x2} ${y2}`}
              className={node.isExpanded ? styles.edgeSolid : styles.edge}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isExp = node.isExpanded;
          const h = isExp ? CARD_HEIGHT : COLLAPSED_HEIGHT;
          const w = isExp ? cardWidth : cardWidth * PILL_WIDTH_RATIO;
          const r = isExp ? 16 : h / 2;

          return (
            <rect
              key={node.id}
              x={node.position.x}
              y={node.position.y}
              width={w}
              height={h}
              rx={r}
              ry={r}
              className={isExp ? styles.nodeExpanded : styles.nodeCollapsed}
            />
          );
        })}

        {/* Viewport */}
        {viewportWidth > 0 && viewportHeight > 0 && (
          <rect
            x={-pan.x}
            y={-pan.y}
            width={viewportWidth / zoom}
            height={viewportHeight / zoom}
            rx={12}
            ry={12}
            className={styles.viewport}
          />
        )}
      </svg>
    </div>
  );
}
