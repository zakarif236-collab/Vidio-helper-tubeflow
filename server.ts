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

async function expandIdeaWithHuggingFace(idea: string, sections?: IdeaDraftRequestBody['sections']): Promise<string | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const model = process.env.HUGGINGFACE_MODEL || "google/flan-t5-large";

  if (!apiKey) {
    return null;
  }

  const prompt = [
    "Expand this short video idea into a structured draft for a creator.",
    "Return plain text only.",
    "Include a hook, intro, development beats, climax, resolution, immersive visual cues, sound cues, and a call to action.",
    `Idea: ${idea}`,
    `Introduction notes: ${sections?.introduction || 'none provided'}`,
    `Development notes: ${sections?.development || 'none provided'}`,
    `Climax notes: ${sections?.climax || 'none provided'}`,
    `Resolution notes: ${sections?.resolution || 'none provided'}`,
  ].join("\n");

  try {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 280,
          temperature: 0.7,
          return_full_text: false,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("Hugging Face idea expansion failed:", errorText);
      return null;
    }

    const data = await response.json();

    if (Array.isArray(data) && typeof data[0]?.generated_text === "string") {
      return data[0].generated_text.trim();
    }

    if (typeof data?.generated_text === "string") {
      return data.generated_text.trim();
    }

    return null;
  } catch (error) {
    console.warn("Hugging Face idea expansion request failed:", error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

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

      const expandedIdea = await expandIdeaWithHuggingFace(idea, sections);
      const result = buildIdeaScriptDraft(
        idea,
        sections,
        expandedIdea ?? undefined,
        expandedIdea ? 'huggingface' : 'local-nlp'
      );

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
