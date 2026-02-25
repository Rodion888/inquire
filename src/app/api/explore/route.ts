import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ContentBlock {
  type: 'text' | 'heading' | 'list' | 'code';
  content?: string;
  items?: string[];
  language?: string;
}

interface TopicExploration {
  title: string;
  content: string;
  blocks: ContentBlock[];
  relatedTopics: string[];
}

interface RawExploration {
  title: string;
  blocks?: ContentBlock[];
  content?: string;
  relatedTopics: string[];
}

const EXPLORATION_PROMPT = `You are a knowledge exploration assistant. Given a topic, provide a detailed explanation structured as content blocks, plus 4-6 related topics.

Respond in JSON format:
{
  "title": "Topic title",
  "blocks": [
    { "type": "heading", "content": "Section Title" },
    { "type": "text", "content": "Paragraph of explanation. Use **bold** for key terms and *italic* for emphasis." },
    { "type": "list", "items": ["First point", "Second point", "Third point"] },
    { "type": "code", "content": "const x = 1;", "language": "javascript" }
  ],
  "relatedTopics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4"]
}

Block types:
- "heading": section title (content field)
- "text": paragraph (content field). Use **bold** for key terms, *italic* for emphasis
- "list": bullet list (items array). Each item is a string, can use **bold** and *italic*
- "code": code snippet (content field, language field)

Rules:
- Structure into 2-4 sections, each starting with a heading block
- Do NOT use markdown syntax like ## or - in text blocks, use proper block types instead
- Keep explanations engaging, detailed and accessible
- Related topics should be specific and interesting, not generic
- Respond in the same language as the input topic`;

function blocksToPlainText(blocks: ContentBlock[]): string {
  return blocks.map(b => {
    if (b.type === 'list') return (b.items ?? []).join('\n');
    return b.content ?? '';
  }).join('\n\n');
}

function normalizeResponse(raw: RawExploration): TopicExploration {
  const blocks = raw.blocks ?? [];
  const content = blocks.length > 0
    ? blocksToPlainText(blocks)
    : (raw.content ?? '');

  return {
    title: raw.title,
    content,
    blocks,
    relatedTopics: raw.relatedTopics,
  };
}

function parseResponse(text: string): TopicExploration {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid response format');
  }
  const sanitized = jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, (ch) => {
    if (ch === '\n') return '\\n';
    if (ch === '\r') return '\\r';
    if (ch === '\t') return '\\t';
    return '';
  });
  return normalizeResponse(JSON.parse(sanitized) as RawExploration);
}

async function exploreWithGroq(topic: string): Promise<TopicExploration> {
  const apiKey = process.env.GROQ_API_KEY ?? process.env.NEXT_PUBLIC_GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: EXPLORATION_PROMPT },
        { role: 'user', content: `Topic to explore: ${topic}` },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return normalizeResponse(JSON.parse(data.choices[0].message.content) as RawExploration);
}

async function exploreWithGemini(topic: string): Promise<TopicExploration> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent([
    EXPLORATION_PROMPT,
    `Topic to explore: ${topic}`,
  ]);
  return parseResponse(result.response.text());
}

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    if (topic.length > 500) {
      return NextResponse.json({ error: 'Topic too long' }, { status: 400 });
    }

    let result: TopicExploration;
    try {
      result = await exploreWithGroq(topic);
    } catch {
      result = await exploreWithGemini(topic);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Explore API error:', error);
    return NextResponse.json(
      { error: 'Failed to explore topic' },
      { status: 500 }
    );
  }
}
