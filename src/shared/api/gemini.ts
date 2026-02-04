import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '@/shared/config';

const genAI = new GoogleGenerativeAI(env.geminiApiKey);

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
});

export interface TopicExploration {
  title: string;
  content: string;
  relatedTopics: string[];
}

const EXPLORATION_PROMPT = `You are a knowledge exploration assistant. Given a topic, provide:
1. A clear, concise explanation (2-3 paragraphs)
2. 4-6 related topics that would be interesting to explore next

Respond in JSON format:
{
  "title": "Topic title",
  "content": "Detailed explanation...",
  "relatedTopics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4"]
}

Important:
- Keep explanations engaging and accessible
- Related topics should be specific and interesting, not generic
- Respond in the same language as the input topic`;

export async function exploreTopic(topic: string): Promise<TopicExploration> {
  const result = await model.generateContent([
    EXPLORATION_PROMPT,
    `Topic to explore: ${topic}`,
  ]);

  const response = result.response.text();

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid response format');
  }

  return JSON.parse(jsonMatch[0]) as TopicExploration;
}
