import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import ytdl from "@distube/ytdl-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // Enable JSON body parsing for POST requests
  app.use(express.json());

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
