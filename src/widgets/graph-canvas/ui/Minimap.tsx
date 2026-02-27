'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { GraphNode } from '@/shared/types';
import { CARD_HEIGHT, COLLAPSED_HEIGHT, PILL_WIDTH_RATIO } from '@/entities/graph';
import styles from './Minimap.module.css';

/* ===== Inline SVG icons ===== */

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function FitIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14h6v6" />
      <path d="M20 10h-6V4" />
      <path d="m14 10 7-7" />
      <path d="m3 21 7-7" />
    </svg>
  );
}

/* ===== Depth colors (matches anime.js marker palette) ===== */
const DEPTH_COLORS = ['#5ce0ff', '#4ade80', '#fbbf24', '#f472b6', '#a78bfa'];

/* ===== Component ===== */

interface MinimapProps {
  nodes: GraphNode[];
  zoom: number;
  pan: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
  cardWidth: number;
  initialTopic: string;
  onNavigate: (x: number, y: number) => void;
  onFitView: () => void;
  onCenterNode: (nodeId: string) => void;
}

export function Minimap({
  nodes, zoom, pan, viewportWidth, viewportHeight,
  cardWidth, initialTopic, onNavigate, onFitView, onCenterNode,
}: MinimapProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTopic);
  const [editValue, setEditValue] = useState(initialTopic);
  const inputRef = useRef<HTMLInputElement>(null);

  // Drag state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, offX: 0, offY: 0 });

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // --- Scale data: Y-position mapping, depth, viewport ---
  const scaleData = useMemo(() => {
    if (nodes.length === 0) return null;

    let yMin = Infinity, yMax = -Infinity;
    nodes.forEach(n => {
      const h = n.isExpanded ? CARD_HEIGHT : COLLAPSED_HEIGHT;
      yMin = Math.min(yMin, n.position.y);
      yMax = Math.max(yMax, n.position.y + h);
    });

    const vpT = -pan.y;
    const vpB = vpT + viewportHeight / zoom;
    yMin = Math.min(yMin, vpT) - 30;
    yMax = Math.max(yMax, vpB) + 30;

    const range = yMax - yMin || 1;
    const toP = (y: number) => Math.max(0, Math.min(100, ((y - yMin) / range) * 100));

    // Compute depths
    const depthMap = new Map<string, number>();
    const getDepth = (id: string): number => {
      if (depthMap.has(id)) return depthMap.get(id)!;
      const node = nodes.find(n => n.id === id);
      if (!node || node.parentId === null) { depthMap.set(id, 0); return 0; }
      const d = getDepth(node.parentId) + 1;
      depthMap.set(id, d);
      return d;
    };
    nodes.forEach(n => getDepth(n.id));

    const markers = nodes.map(n => {
      const h = n.isExpanded ? CARD_HEIGHT : COLLAPSED_HEIGHT;
      const depth = depthMap.get(n.id) ?? 0;
      return {
        id: n.id,
        title: n.title,
        depth,
        pct: toP(n.position.y + h / 2),
        isRoot: n.parentId === null,
        color: DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)],
      };
    }).sort((a, b) => a.pct - b.pct);

    return {
      markers,
      vpTop: toP(vpT),
      vpHeight: Math.max(2, toP(vpB) - toP(vpT)),
    };
  }, [nodes, pan, viewportHeight, zoom]);

  // --- SVG bounds for bottom minimap ---
  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, width: 1000, height: 1000 };

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach((node) => {
      const h = node.isExpanded ? CARD_HEIGHT : COLLAPSED_HEIGHT;
      const w = node.isExpanded ? cardWidth : cardWidth * PILL_WIDTH_RATIO;
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + w);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + h);
    });

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
      minX: minX - pad, minY: minY - pad,
      width: maxX - minX + pad * 2, height: maxY - minY + pad * 2,
    };
  }, [nodes, pan, zoom, viewportWidth, viewportHeight, cardWidth]);

  // --- SVG click to navigate ---
  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const worldPt = pt.matrixTransform(ctm.inverse());
    onNavigate(viewportWidth / 2 / zoom - worldPt.x, viewportHeight / 2 / zoom - worldPt.y);
  }, [onNavigate, viewportWidth, viewportHeight, zoom]);

  // --- Title editing ---
  const startEditing = useCallback(() => {
    setEditValue(title);
    setIsEditing(true);
  }, [title]);

  const saveTitle = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed) setTitle(trimmed);
    setIsEditing(false);
  }, [editValue]);

  const cancelEditing = useCallback(() => {
    setEditValue(title);
    setIsEditing(false);
  }, [title]);

  // --- Drag ---
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return;
    if ((e.target as HTMLElement).closest('button')) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, offX: dragOffset.x, offY: dragOffset.y };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      setDragOffset({
        x: dragStart.current.offX + (ev.clientX - dragStart.current.x),
        y: dragStart.current.offY + (ev.clientY - dragStart.current.y),
      });
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [isEditing, dragOffset]);

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const panelStyle = dragOffset.x !== 0 || dragOffset.y !== 0
    ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }
    : undefined;

  // --- Collapsed ---
  if (isCollapsed) {
    return (
      <div
        className={`${styles.minimap} ${styles.collapsed}`}
        style={panelStyle}
        onMouseDown={stopPropagation}
      >
        <div className={styles.collapsedInner}>
          <button className={styles.expandBtn} onClick={() => setIsCollapsed(false)} title="Expand">
            <ExpandIcon />
          </button>
          <span className={styles.collapsedLabel}>Map</span>
        </div>
      </div>
    );
  }

  // --- Expanded ---
  const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + '…' : s;

  return (
    <div
      className={styles.minimap}
      style={panelStyle}
      onMouseDown={stopPropagation}
    >
      {/* Header */}
      <header className={styles.header} onMouseDown={handleHeaderMouseDown}>
        {isEditing ? (
          <input
            ref={inputRef}
            className={styles.titleInput}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle();
              if (e.key === 'Escape') cancelEditing();
            }}
          />
        ) : (
          <span className={styles.titleDisplay}>{title}</span>
        )}
        <button className={styles.headerBtn} onClick={startEditing} title="Edit title">
          <PencilIcon />
        </button>
        <button className={styles.headerBtn} onClick={onFitView} title="Fit view">
          <FitIcon />
        </button>
        <button className={styles.headerBtn} onClick={() => setIsCollapsed(true)} title="Collapse">
          <CollapseIcon />
        </button>
      </header>

      {/* Scale area with markers */}
      <div className={styles.scaleArea}>
        <div className={styles.ruler} />

        {/* Viewport indicator */}
        {scaleData && (
          <div
            className={styles.vpBar}
            style={{ top: `${scaleData.vpTop}%`, height: `${scaleData.vpHeight}%` }}
          />
        )}

        {/* Node markers */}
        {scaleData?.markers.map(m => (
          <div
            key={m.id}
            className={styles.marker}
            style={{ top: `${m.pct}%`, '--c': m.color } as React.CSSProperties}
            onClick={() => onCenterNode(m.id)}
          >
            <span className={`${styles.markerDot} ${m.isRoot ? styles.markerDotRoot : ''}`} />
            <span className={styles.markerLine} />
            <span className={styles.markerLabel}>
              {m.depth} {truncate(m.title, 18)}
            </span>
          </div>
        ))}
      </div>

      {/* SVG minimap */}
      <div className={styles.svgSection}>
        <div className={styles.svgWrap}>
          <svg
            viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
            preserveAspectRatio="xMidYMid meet"
            className={styles.svg}
            onClick={handleSvgClick}
          >
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
      </div>
    </div>
  );
}
