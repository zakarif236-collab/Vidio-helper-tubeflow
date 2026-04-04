import dotenv from "dotenv";
dotenv.config();

import express from "express";
import validateSections from "./sectionValidation.js";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import ytdl from "@distube/ytdl-core";
import { processContent, addTimestampsToScript, buildIdeaScriptDraft } from "./contentProcessor.js";

interface IdeaDraftRequestBody {
  idea?: string;
  sections?: {
    introduction?: string;
    development?: string;
    climax?: string;
    resolution?: string;
    targetMinutes?: number;
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IDEA_DURATION_OPTIONS = [8, 10, 15, 20] as const;

function normalizeTargetMinutes(totalMinutes: number | undefined): 8 | 10 | 15 | 20 {
  if (typeof totalMinutes !== 'number' || !Number.isFinite(totalMinutes)) {
    return 15;
  }

  let bestMatch: 8 | 10 | 15 | 20 = 15;
  let bestDistance = Number.POSITIVE_INFINITY;

  IDEA_DURATION_OPTIONS.forEach((candidate) => {
    const distance = Math.abs(candidate - totalMinutes);
    if (distance < bestDistance) {
      bestMatch = candidate;
      bestDistance = distance;
    }
  });

  return bestMatch;
}

function buildPhaseMinutePlan(totalMinutes: number | undefined) {
  const normalizedMinutes = normalizeTargetMinutes(totalMinutes);
  const exact = {
    introduction: normalizedMinutes * 0.1,
    development: normalizedMinutes * 0.35,
    climax: normalizedMinutes * 0.35,
    resolution: normalizedMinutes * 0.2,
  };

  const plan = {
    introduction: Math.max(1, Math.floor(exact.introduction)),
    development: Math.max(1, Math.floor(exact.development)),
    climax: Math.max(1, Math.floor(exact.climax)),
    resolution: Math.max(1, Math.floor(exact.resolution)),
  };

  let assigned = plan.introduction + plan.development + plan.climax + plan.resolution;
  const order = [
    ['development', exact.development - Math.floor(exact.development)],
    ['climax', exact.climax - Math.floor(exact.climax)],
    ['resolution', exact.resolution - Math.floor(exact.resolution)],
    ['introduction', exact.introduction - Math.floor(exact.introduction)],
  ] as const;

  let index = 0;
  while (assigned < normalizedMinutes) {
    const phase = order[index % order.length][0];
    plan[phase] += 1;
    assigned += 1;
    index += 1;
  }

  return plan;
}

function getTargetWordCount(totalMinutes: number | undefined): number {
  const normalizedMinutes = normalizeTargetMinutes(totalMinutes);
  if (normalizedMinutes === 8) {
    return 1100;
  }
  if (normalizedMinutes === 10) {
    return 1300;
  }
  if (normalizedMinutes === 20) {
    return 2400;
  }
  return 1900;
}

function getTargetWordRange(totalMinutes: number | undefined): { min: number; max: number } {
  const normalizedMinutes = normalizeTargetMinutes(totalMinutes);

  if (normalizedMinutes === 8) {
    return { min: 1000, max: 1200 };
  }

  if (normalizedMinutes === 10) {
    return { min: 1200, max: 1400 };
  }

  if (normalizedMinutes === 20) {
    return { min: 2300, max: 2500 };
  }

  return { min: 1800, max: 2000 };
}

function getPhaseWordRange(totalMinutes: number | undefined, phase: 'introduction' | 'development' | 'climax' | 'resolution') {
  const normalizedMinutes = normalizeTargetMinutes(totalMinutes);

  const ranges = {
    8: {
      introduction: { min: 100, max: 120 },
      development: { min: 350, max: 420 },
      climax: { min: 350, max: 420 },
      resolution: { min: 200, max: 240 },
    },
    10: {
      introduction: { min: 150, max: 200 },
      development: { min: 400, max: 600 },
      climax: { min: 400, max: 600 },
      resolution: { min: 250, max: 350 },
    },
    15: {
      introduction: { min: 200, max: 300 },
      development: { min: 600, max: 800 },
      climax: { min: 600, max: 800 },
      resolution: { min: 350, max: 450 },
    },
    20: {
      introduction: { min: 300, max: 400 },
      development: { min: 800, max: 1000 },
      climax: { min: 800, max: 1000 },
      resolution: { min: 450, max: 600 },
    },
  } as const;

  return ranges[normalizedMinutes][phase];
}

function formatApproxMinutes(minutes: number): string {
  return Number.isInteger(minutes) ? `${minutes}` : minutes.toFixed(1);
}

function getAvailableIdeaDraftProvider(): 'gemini' | 'huggingface' | null {
  if (process.env.GEMINI_API_KEY) {
    return 'gemini';
  }

  if (process.env.HUGGINGFACE_API_KEY) {
    return 'huggingface';
  }

  return null;
}

function getIdeaDraftProviderLabel(provider: 'gemini' | 'huggingface' | null): string {
  if (provider === 'gemini') {
    return 'Gemini';
  }

  if (provider === 'huggingface') {
    return 'Hugging Face';
  }

  return 'none';
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getMinimumAcceptedWordCount(totalMinutes: number | undefined): number {
  return Math.floor(getTargetWordCount(totalMinutes) * 0.9);
}

function normalizeGeneratedIdeaDraft(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^\s*[*_#`>-]+\s*(Initial Concept|Develop Story|Key Moment|Wrap Up)\s*[*_#`:-]*\s*$/gim, '$1')
    .replace(/\*\*(Initial Concept|Develop Story|Key Moment|Wrap Up)\*\*/gi, '\n$1\n\n')
    .replace(/^\s*#+\s*(Initial Concept|Develop Story|Key Moment|Wrap Up)\s*$/gim, '$1')
    .replace(/^\s*(Initial Concept|Develop Story|Key Moment|Wrap Up)\s*[:\-–—]\s*/gim, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function shouldRetryIdeaDraft(text: string, totalMinutes: number | undefined): boolean {
  return countWords(text) < getMinimumAcceptedWordCount(totalMinutes);
}

function buildIdeaDraftPrompt(
  idea: string,
  sections?: IdeaDraftRequestBody['sections'],
  retryOptions?: { minimumWords: number; previousWordCount: number; existingDraft?: string }
): string {
  const targetMinutes = normalizeTargetMinutes(sections?.targetMinutes);
  const targetWords = getTargetWordCount(targetMinutes);
  const minimumWords = retryOptions?.minimumWords ?? getMinimumAcceptedWordCount(targetMinutes);
  const introductionWordRange = getPhaseWordRange(targetMinutes, 'introduction');
  const developmentWordRange = getPhaseWordRange(targetMinutes, 'development');
  const climaxWordRange = getPhaseWordRange(targetMinutes, 'climax');
  const resolutionWordRange = getPhaseWordRange(targetMinutes, 'resolution');

  return [
    'You are a professional scriptwriter.',
    'Expand the following idea into a full spoken script.',
    `Adjust the phase lengths based on the total duration selected: ${targetMinutes} minutes.`,
    '',
    'Structure:',
    '',
    `- Initial Concept (~10% of total time): Hook, context, and promise. Write ${introductionWordRange.min}-${introductionWordRange.max} words.`,
    `- Develop Story (~35% of total time): Provide 3-4 examples, dialogue beats, and practical context. Write ${developmentWordRange.min}-${developmentWordRange.max} words.`,
    `- Key Moment (~35% of total time): Reveal the turning point, strongest insight, or emotional peak. Write ${climaxWordRange.min}-${climaxWordRange.max} words.`,
    `- Wrap Up (~20% of total time): End with a clear takeaway and call to action. Write ${resolutionWordRange.min}-${resolutionWordRange.max} words.`,
    '',
    'Rules:',
    '- Write in natural spoken style, not bullet points.',
    '- Use transitions between sections.',
    '- Avoid repeating the idea verbatim; expand it into full sentences.',
    `- Target total length: about ${targetWords} words for a ${targetMinutes}-minute script.`,
    `- Aim for roughly ${targetWords} words overall, but do not go below ${minimumWords} words.`,
    `- Minimum acceptable length: ${minimumWords} words. Do not stop early.`,
    '- Do not use markdown, bullet lists, or bold formatting anywhere in the output.',
    '- Use these exact section headings on their own lines: Initial Concept, Develop Story, Key Moment, Wrap Up.',
    '- Return plain text only.',
    '',
    `Subject: ${idea}`,
    `Initial Concept notes: ${sections?.introduction || 'none provided'}`,
    `Develop Story notes: ${sections?.development || 'none provided'}`,
    `Key Moment notes: ${sections?.climax || 'none provided'}`,
    `Wrap Up notes: ${sections?.resolution || 'none provided'}`,
    retryOptions
      ? `Rewrite the draft so it is significantly fuller than the previous ${retryOptions.previousWordCount}-word attempt. Expand further to reach ${targetWords} words while keeping the same four-section structure.`
      : '',
    retryOptions?.existingDraft
      ? ['Current draft to expand and improve:', retryOptions.existingDraft].join('\n\n')
      : '',
  ].join('\n');
}

async function expandIdeaWithGemini(
  idea: string,
  sections?: IdeaDraftRequestBody['sections'],
  retryOptions?: { minimumWords: number; previousWordCount: number; existingDraft?: string }
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildIdeaDraftPrompt(idea, sections, retryOptions) }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: normalizeTargetMinutes(sections?.targetMinutes) === 20 ? 6000 : normalizeTargetMinutes(sections?.targetMinutes) === 15 ? 4500 : 3500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('Gemini idea expansion failed:', errorText);
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part?.text || '')
      .join('')
      .trim();

    return text || null;
  } catch (error) {
    console.warn('Gemini idea expansion request failed:', error);
    return null;
  }
}

async function expandIdeaWithHuggingFace(
  idea: string,
  sections?: IdeaDraftRequestBody['sections'],
  retryOptions?: { minimumWords: number; previousWordCount: number; existingDraft?: string }
): Promise<string | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const model = process.env.HUGGINGFACE_MODEL || "openai/gpt-oss-120b:fastest";

  if (!apiKey) {
    return null;
  }

  const prompt = buildIdeaDraftPrompt(idea, sections, retryOptions);

  try {
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: normalizeTargetMinutes(sections?.targetMinutes) === 20 ? 4800 : normalizeTargetMinutes(sections?.targetMinutes) === 15 ? 3800 : normalizeTargetMinutes(sections?.targetMinutes) === 10 ? 2800 : 2200,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("Hugging Face idea expansion failed:", errorText);
      return null;
    }

    const data = await response.json();

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      const joined = content
        .map((part: { text?: string; type?: string }) => typeof part?.text === 'string' ? part.text : '')
        .join('')
        .trim();

      if (joined) {
        return joined;
      }
    }

    return null;
  } catch (error) {
    console.warn("Hugging Face idea expansion request failed:", error);
    return null;
  }
}

async function generateIdeaDraftWithProvider(
  provider: 'gemini' | 'huggingface',
  idea: string,
  sections?: IdeaDraftRequestBody['sections']
): Promise<string | null> {
  const minimumWords = getMinimumAcceptedWordCount(sections?.targetMinutes);
  const maxAttempts = 3;
  let currentDraft: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const retryOptions = attempt === 1 || !currentDraft
      ? undefined
      : {
          minimumWords,
          previousWordCount: countWords(currentDraft),
          existingDraft: currentDraft,
        };

    const generatedDraft = provider === 'gemini'
      ? await expandIdeaWithGemini(idea, sections, retryOptions)
      : await expandIdeaWithHuggingFace(idea, sections, retryOptions);

    if (!generatedDraft) {
      if (attempt > 1) {
        console.warn(`Idea-draft retry ${attempt - 1} failed to return content for ${provider}.`);
      }
      continue;
    }

    currentDraft = normalizeGeneratedIdeaDraft(generatedDraft);
    const currentWordCount = countWords(currentDraft);

    if (attempt === 1) {
      console.log(`Idea-draft initial word count (${provider}): ${currentWordCount}`);
    } else {
      console.log(`Idea-draft retry ${attempt - 1} word count (${provider}): ${currentWordCount}`);
    }

    if (!shouldRetryIdeaDraft(currentDraft, sections?.targetMinutes)) {
      return currentDraft;
    }
  }

  return currentDraft;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const activeIdeaDraftProvider = getAvailableIdeaDraftProvider();

  console.log(`Idea-draft provider: ${getIdeaDraftProviderLabel(activeIdeaDraftProvider)}${activeIdeaDraftProvider ? ' (active)' : ' (not configured)'}`);

  // Enable JSON body parsing for POST requests
  app.use(express.json({ limit: '50mb' }));

  // API Route for YouTube Download
  app.get("/api/download", async (req, res) => {
    const videoUrl = req.query.url as string;
    const type = req.query.type as string; // 'audio' or 'video'

    if (!videoUrl) {
      return res.status(400).send("URL is required");
    }

    try {
      console.log(`Starting download for: ${videoUrl} (${type})`);
      
      const info = await ytdl.getInfo(videoUrl);
      const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
      const userName = "ZASCK";
      
      if (type === 'audio') {
        res.setHeader('Content-Disposition', `attachment; filename="${userName}_${title}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');
        ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' }).pipe(res);
      } else {
        res.setHeader('Content-Disposition', `attachment; filename="${userName}_${title}.mp4"`);
        res.setHeader('Content-Type', 'video/mp4');
        ytdl(videoUrl, { filter: 'audioandvideo', quality: 'highest' }).pipe(res);
      }

      res.on('error', (err) => {
        console.error('Stream error:', err);
      });

    } catch (error) {
      console.error('Download error:', error);
      res.status(500).send("Failed to process video download. YouTube might be blocking the request.");
    }
  });


  // ===== SECTION VALIDATION ENDPOINT =====
  app.post("/api/validate-sections", validateSections, (req, res) => {
    res.json({ message: "Sections are valid." });
  });

  // ===== NEW CONTENT PROCESSING ENDPOINTS =====

  /**
   * Process YouTube Transcript
   * Input: YouTube transcript (obtained separately)
   * Output: Full content package with chapters, summary, SEO, captions
   */
  app.post("/api/process/youtube-transcript", async (req, res) => {
    try {
      const { transcript, subject } = req.body;

      if (!transcript || typeof transcript !== 'string') {
        return res.status(400).json({ error: "Transcript is required" });
      }

      const result = processContent({
        type: 'youtube',
        data: {
          transcript,
          subject: subject || 'Video Content'
        }
      });

      res.json(result);
    } catch (error) {
      console.error('YouTube processing error:', error);
      res.status(500).json({ error: 'Failed to process YouTube transcript' });
    }
  });

  /**
   * Process User-Uploaded Script
   * Input: Text script
   * Output: Chapters, summary, SEO, captions (no transcription needed)
   */
  app.post("/api/process/script", async (req, res) => {
    try {
      const { script, subject } = req.body;

      if (!script || typeof script !== 'string') {
        return res.status(400).json({ error: "Script is required" });
      }

      const result = processContent({
        type: 'script',
        data: {
          script,
          subject: subject || 'Video Content'
        }
      });

      res.json(result);
    } catch (error) {
      console.error('Script processing error:', error);
      res.status(500).json({ error: 'Failed to process script' });
    }
  });

  app.post("/api/process/idea-draft", async (req, res) => {
    try {
      const { idea, sections } = req.body as IdeaDraftRequestBody;

      if (!idea || typeof idea !== 'string') {
        return res.status(400).json({ error: 'Idea is required' });
      }

      const provider = getAvailableIdeaDraftProvider();
      if (!provider) {
        return res.status(503).json({
          error: 'Missing AI API key. Set GEMINI_API_KEY or HUGGINGFACE_API_KEY in your environment or .env, then restart the server.',
        });
      }

      let resultProvider: 'gemini' | 'huggingface' = provider;
      let expandedIdea = provider === 'gemini'
        ? await generateIdeaDraftWithProvider('gemini', idea, sections)
        : null;

      if (!expandedIdea && provider === 'gemini') {
        resultProvider = 'huggingface';
      }

      if (!expandedIdea) {
        expandedIdea = await generateIdeaDraftWithProvider('huggingface', idea, sections);
      }

      const result = buildIdeaScriptDraft(
        idea,
        sections,
        expandedIdea ?? undefined,
        expandedIdea ? resultProvider : provider
      );

      if (!expandedIdea) {
        return res.status(502).json({
          error: `Failed to generate an idea draft using ${provider}. Verify the API key and provider access, then try again.`,
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Idea draft processing error:', error);
      res.status(500).json({ error: 'Failed to generate idea draft' });
    }
  });

  /**
   * Process Idea into Full Video Package
   * Input: Subject idea + AI-generated script
   * Output: Complete package (script + transcript + chapters + summary + SEO + captions)
   */
  app.post("/api/process/idea", async (req, res) => {
    try {
      const { subject, script } = req.body;

      if (!subject || typeof subject !== 'string') {
        return res.status(400).json({ error: "Subject is required" });
      }

      if (!script || typeof script !== 'string') {
        return res.status(400).json({ error: "Script is required (AI-generated)" });
      }

      // Add timestamps to script to create formatted transcript
      const transcript = addTimestampsToScript(script);

      const result = processContent({
        type: 'idea',
        data: {
          script: transcript,
          subject
        }
      });

      // Include original script in results
      const fullResult = {
        ...result,
        OriginalScript: script,
        Transcript: transcript
      };

      res.json(fullResult);
    } catch (error) {
      console.error('Idea processing error:', error);
      res.status(500).json({ error: 'Failed to process idea' });
    }
  });

  // ✅ API Route for Gemini AI (separate, not nested)
  app.post("/api/gemini", async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).send("Prompt is required");
    }

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          }),
        }
      );

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Gemini API error:", error);
      res.status(500).send("Failed to connect to Gemini API");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (error) => {
    if ((error as any).code === 'EADDRINUSE') {
      const fallbackPort = PORT + 1;
      console.warn(`Port ${PORT} is in use. Trying fallback port ${fallbackPort}...`);
      app.listen(fallbackPort, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${fallbackPort}`);
      });
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });
}

startServer();
