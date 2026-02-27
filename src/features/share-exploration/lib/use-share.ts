'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/shared/lib';
import { setExplorationPublic } from '@/shared/api';

export function useShare(explorationId: string, initialTopic: string) {
  const { user } = useAuth();
  const [isPublic, setIsPublic] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const isOwner = !ownerId || (user?.uid === ownerId);

  const handleTogglePublic = useCallback(async () => {
    const newValue = !isPublic;
    await setExplorationPublic(explorationId, newValue);
    setIsPublic(newValue);
    if (newValue) {
      const url = `${window.location.origin}/explore/${encodeURIComponent(initialTopic)}?id=${explorationId}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }, [isPublic, explorationId, initialTopic]);

  return {
    isPublic,
    setIsPublic,
    ownerId,
    setOwnerId,
    linkCopied,
    isOwner,
    handleTogglePublic,
  };
}
