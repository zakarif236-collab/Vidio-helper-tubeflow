import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import ytdl from "@distube/ytdl-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

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
        ytdl(videoUrl, {
          filter: 'audioonly',
          quality: 'highestaudio',
        }).pipe(res);
      } else {
        res.setHeader('Content-Disposition', `attachment; filename="${userName}_${title}.mp4"`);
        res.setHeader('Content-Type', 'video/mp4');
        ytdl(videoUrl, {
          filter: 'audioandvideo',
          quality: 'highest',
        }).pipe(res);
      }

      // Handle stream errors
      res.on('error', (err) => {
        console.error('Stream error:', err);
      });

    } catch (error) {
      console.error('Download error:', error);
      res.status(500).send("Failed to process video download. YouTube might be blocking the request.");
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
