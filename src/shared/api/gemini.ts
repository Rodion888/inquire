import type { ContentBlock, TopicCategory } from '@/shared/types';

export interface TopicExploration {
  title: string;
  content: string;
  blocks: ContentBlock[];
  category?: TopicCategory;
  relatedTopics: string[];
}

export interface BranchNode {
  topic: string;
  title: string;
  category?: TopicCategory;
}

export interface ExploreContext {
  branchChain?: BranchNode[];
  parentContent?: string;
  existingTopics?: string[];
}

export async function exploreTopic(topic: string, context?: ExploreContext): Promise<TopicExploration> {
  const response = await fetch('/api/explore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, context }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}
