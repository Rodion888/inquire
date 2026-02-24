import { ContentBlock } from '@/app/explore/[topic]/types';

export interface TopicExploration {
  title: string;
  content: string;
  blocks: ContentBlock[];
  relatedTopics: string[];
}

export async function exploreTopic(topic: string): Promise<TopicExploration> {
  const response = await fetch('/api/explore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}
