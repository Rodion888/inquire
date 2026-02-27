'use client';

import { useEffect, useRef } from 'react';

interface UseTouchOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  initialized: boolean;
}

export function useTouch({
  canvasRef,
  zoom,
  pan,
  setZoom,
  setPan,
  initialized,
}: UseTouchOptions) {
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const touchRef = useRef<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    pinchDist: number;
    pinchZoom: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getDistance = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        touchRef.current = {
          startX: 0, startY: 0,
          startPanX: panRef.current.x, startPanY: panRef.current.y,
          pinchDist: dist, pinchZoom: zoomRef.current,
        };
      } else if (e.touches.length === 1) {
        const target = e.target as HTMLElement;
        if (target.closest('[data-card-content]')) return;
        if (target.closest('article')) return;

        e.preventDefault();
        touchRef.current = {
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          startPanX: panRef.current.x, startPanY: panRef.current.y,
          pinchDist: 0, pinchZoom: 0,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchRef.current) return;

      if (e.touches.length === 2 && touchRef.current.pinchDist > 0) {
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        const scale = dist / touchRef.current.pinchDist;
        const newZoom = Math.min(Math.max(touchRef.current.pinchZoom * scale, 0.1), 2);

        const rect = canvas.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        const oldZoom = zoomRef.current;
        const worldX = midX / oldZoom - panRef.current.x;
        const worldY = midY / oldZoom - panRef.current.y;

        setZoom(newZoom);
        setPan({ x: midX / newZoom - worldX, y: midY / newZoom - worldY });
      } else if (e.touches.length === 1 && touchRef.current.pinchDist === 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - touchRef.current.startX;
        const dy = e.touches[0].clientY - touchRef.current.startY;
        setPan({
          x: touchRef.current.startPanX + dx / zoomRef.current,
          y: touchRef.current.startPanY + dy / zoomRef.current,
        });
      }
    };

    const handleTouchEnd = () => {
      touchRef.current = null;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [initialized, canvasRef, setZoom, setPan]);
}
