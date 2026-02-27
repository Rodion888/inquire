'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GraphNode } from '@/shared/types';

interface UseCanvasInteractionsOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  nodes: GraphNode[];
  zoom: number;
  pan: { x: number; y: number };
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setNodes: React.Dispatch<React.SetStateAction<GraphNode[]>>;
  initialized: boolean;
  zoomContainerClass: string;
}

export function useCanvasInteractions({
  canvasRef,
  nodes,
  zoom,
  pan,
  setZoom,
  setPan,
  setNodes,
  initialized,
  zoomContainerClass,
}: UseCanvasInteractionsOptions) {
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const handleDragStart = useCallback((nodeId: string, clientX: number, clientY: number) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setDraggedNodeId(nodeId);
    dragOffset.current = {
      x: clientX / zoom - node.position.x - pan.x,
      y: clientY / zoom - node.position.y - pan.y,
    };
  }, [nodes, zoom, pan]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!draggedNodeId) return;

    setNodes((prev) =>
      prev.map((node) =>
        node.id === draggedNodeId
          ? {
              ...node,
              position: {
                x: clientX / zoom - dragOffset.current.x - pan.x,
                y: clientY / zoom - dragOffset.current.y - pan.y,
              },
            }
          : node
      )
    );
  }, [draggedNodeId, zoom, pan, setNodes]);

  const handleDragEnd = useCallback(() => {
    setDraggedNodeId(null);
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest(`.${zoomContainerClass}`) === e.target) {
      setIsPanning(true);
      panStart.current = {
        x: e.clientX - pan.x * zoom,
        y: e.clientY - pan.y * zoom,
      };
    }
  }, [pan, zoom, zoomContainerClass]);

  // Wheel/touchpad handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const cardContent = target.closest('[data-card-content]') as HTMLElement | null;
      if (cardContent && !e.ctrlKey && !e.metaKey) {
        const hasVerticalScroll = cardContent.scrollHeight > cardContent.clientHeight;
        const hScrollEl = target.closest('pre') as HTMLElement | null;
        const hasHorizontalScroll = hScrollEl && hScrollEl.scrollWidth > hScrollEl.clientWidth;

        if (hasVerticalScroll || hasHorizontalScroll) {
          e.preventDefault();
          if (hasVerticalScroll) cardContent.scrollTop += e.deltaY;
          if (hasHorizontalScroll) hScrollEl.scrollLeft += e.deltaX;
          return;
        }
      }

      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        const rect = canvas.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const oldZoom = zoomRef.current;
        const delta = -e.deltaY * 0.005;
        const newZoom = Math.min(Math.max(oldZoom + delta, 0.1), 2);

        const worldX = cursorX / oldZoom - panRef.current.x;
        const worldY = cursorY / oldZoom - panRef.current.y;

        const newPanX = cursorX / newZoom - worldX;
        const newPanY = cursorY / newZoom - worldY;

        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
      } else {
        setPan((p) => ({
          x: p.x - e.deltaX / zoomRef.current,
          y: p.y - e.deltaY / zoomRef.current,
        }));
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [initialized, canvasRef, setZoom, setPan]);

  // Global mouse handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggedNodeId) {
        handleDragMove(e.clientX, e.clientY);
      } else if (isPanning) {
        setPan({
          x: (e.clientX - panStart.current.x) / zoom,
          y: (e.clientY - panStart.current.y) / zoom,
        });
      }
    };

    const handleMouseUp = () => {
      handleDragEnd();
      setIsPanning(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (draggedNodeId && e.touches.length === 1) {
        e.preventDefault();
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => {
      if (draggedNodeId) handleDragEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [draggedNodeId, isPanning, handleDragMove, handleDragEnd, zoom, setPan]);

  return {
    draggedNodeId,
    isPanning,
    handleDragStart,
    handleCanvasMouseDown,
  };
}
