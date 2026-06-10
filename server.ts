import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import http from "http";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  app.use(express.json());

  // Lazy-initialize Gemini Client safely so it picks up runtime workspace Secrets seamlessly
  function getGeminiClient(): GoogleGenAI {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not defined. Please add it to your Secrets in the Settings menu (top right).");
    }
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'quyoom-technologies-enzily',
        }
      }
    });
  }

  // Helper to map and sanitize model requests to supported text-content generation models
  function getSupportedTextModel(modelName: string | undefined): string {
    if (!modelName) return "gemini-3.5-flash";
    const m = modelName.toLowerCase();
    // Live & TTS models are for real-time WebSockets/audio modality and don't support content-generation text requests
    if (m.includes("live-preview") || m.includes("tts-preview")) {
      return "gemini-3.5-flash";
    }
    return modelName;
  }

  // API Status check
  app.get("/api/status", (req, res) => {
    res.json({
      status: "ok",
      hasKey: !!process.env.GEMINI_API_KEY,
      model: "gemini-3.5-flash"
    });
  });

  // Provide server environment key to client for WebSocket fallback (essential for Vercel)
  app.get("/api/live-config", (req, res) => {
    res.json({
      apiKey: process.env.GEMINI_API_KEY || ""
    });
  });

  // 1. Translator Endpoint
  app.post("/api/translate-converse", async (req, res) => {
    try {
      const ai = getGeminiClient();
      const { text, model } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const systemInstruction = `Role: Enzily AI Translator

Rules:
- Detect local language and save
- Translate to English only.
- English to saved Local langauge
- No tech stack discussion.

Identity:
Enzily AI Translator by Quyoom Technologies.

Save these information for continue translation`;

      const targetModel = getSupportedTextModel(model);
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: [
          { role: "user", parts: [{ text: text }] }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedLanguage: { type: Type.STRING },
              translation: { type: Type.STRING },
              emphasized: { 
                type: Type.STRING,
                description: "The Translated English text with key spoken words wrapped in asterisks for pronunciation support, e.g. 'What are you *doing*?'"
              }
            },
            required: ["detectedLanguage", "translation", "emphasized"]
          }
        }
      });

      const resultText = response.text || "{}";
      res.json(JSON.parse(resultText));
    } catch (err: any) {
      console.error("Translation api error:", err);
      res.status(500).json({ error: err.message || "Failed to process translation" });
    }
  });

  // 2. Practice Correction Endpoint
  app.post("/api/practice-correct", async (req, res) => {
    try {
      const ai = getGeminiClient();
      const { text, model } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const systemInstruction = `Role: Enzily English Tutor

Rules:
- Detect language.
- Reply in English only.
- Help practice English.
- No tech stack discussion.

Identity:
Enzily English Tutor by Quyoom Technologies.
Save these information for continue english practice`;

      const targetModel = getSupportedTextModel(model);
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: [
          { role: "user", parts: [{ text: text }] }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isCorrect: { type: Type.BOOLEAN, description: "Whether the input sentence was grammatically natural and perfect English" },
              corrected: { type: Type.STRING, description: "The corrected and natural English version of their sentence" },
              explanation: { type: Type.STRING, description: "Highly clear, ultra-short explanation of why this was corrected, or if correct, why it's good (1 elegant sentence)" },
              reply: { type: Type.STRING, description: "A friendly, conversational English response (1 direct sentence) to engage them" }
            },
            required: ["isCorrect", "corrected", "explanation", "reply"]
          }
        }
      });

      const resultText = response.text || "{}";
      res.json(JSON.parse(resultText));
    } catch (err: any) {
      console.error("Practice api error:", err);
      res.status(500).json({ error: err.message || "Failed to process practice correction" });
    }
  });

  // 3. Debate Endpoint
  app.post("/api/debate-response", async (req, res) => {
    try {
      const ai = getGeminiClient();
      const { topic, text, history, model } = req.body;
      if (!topic || !text) {
        return res.status(400).json({ error: "Topic and text are required" });
      }

      const systemInstruction = `Role: Enzily Debater

Rules:
- Debate only.
- Use simple English.
- Stay on topic.
- Be honest.
- No tech stack discussion.

Identity:
Enzily Debater by Quyoom Technologies.
Save these information for continue debate`;

      const formattedHistory = (history || [])
        .map((h: any) => `${h.sender === "user" ? "Yasir" : "Enzily"}: ${h.text}`)
        .join("\n");

      const contents = formattedHistory 
        ? `${formattedHistory}\nYasir: ${text}` 
        : text;

      const targetModel = getSupportedTextModel(model);
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: [
          { role: "user", parts: [{ text: contents }] }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING, description: "The response by Enzily opposing Yasir's argument" }
            },
            required: ["reply"]
          }
        }
      });

      const resultText = response.text || "{}";
      res.json(JSON.parse(resultText));
    } catch (err: any) {
      console.error("Debate api error:", err);
      res.status(500).json({ error: err.message || "Failed to process debate rebuttal" });
    }
  });

  // 4. WebSocket Gemini Live Audio Duplex Relay
  wss.on("connection", async (clientWs, request) => {
    try {
      // Safe request URL parsing with custom fallback against undefined host headers
      const host = request.headers.host || "localhost";
      const url = new URL(request.url || "", `http://${host}`);
      const mode = url.searchParams.get("mode") || "practice";
      const voiceName = url.searchParams.get("voice") || "Kore";
      const model = "gemini-3.1-flash-live-preview";

      let systemInstruction = "";
      if (mode === "translator") {
        systemInstruction = `Role: Enzily AI Translator

Rules:
- Detect local language and save
- Translate to English only.
- English to saved Local langauge
- No tech stack discussion.

Identity:
Enzily AI Translator by Quyoom Technologies.

Save these information for continue translation`;
      } else if (mode === "practice") {
        systemInstruction = `Role: Enzily English Tutor

Rules:
- Detect language.
- Reply in English only.
- Help practice English.
- No tech stack discussion.

Identity:
Enzily English Tutor by Quyoom Technologies.
Save these information for continue english practice`;
      } else if (mode === "debate") {
        systemInstruction = `Role: Enzily Debater

Rules:
- Debate only.
- Use simple English.
- Stay on topic.
- Be honest.
- No tech stack discussion.

Identity:
Enzily Debater by Quyoom Technologies.
Save these information for continue debate`;
      }

      console.log(`[ws] New voice relay client connected for mode: ${mode}, model: ${model}`);

      // Lazy-load Gemini client so it correctly scopes updated API keys
      const ai = getGeminiClient();

      let session: any = null;
      session = await ai.live.connect({
        model: model,
        callbacks: {
          onmessage: (message: any) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onclose: () => {
            console.log("[Gemini Live] Session closed automatically");
            clientWs.close();
          },
          onerror: (err: any) => {
            console.error("[Gemini Live] Session error:", err);
            clientWs.send(JSON.stringify({ error: "Gemini server error: " + (err.message || err) }));
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName
              }
            }
          },
          systemInstruction
        }
      });

      // Send a status message to the client indicating the Gemini session has been fully established
      clientWs.send(JSON.stringify({ status: "connected" }));

      clientWs.on("message", async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" }
            });
          }
        } catch (err) {
          console.error("[ws] Error processing packet", err);
        }
      });

      clientWs.on("close", () => {
        console.log("[ws] Client closed connection. Shutting down Gemini session.");
        if (session) {
          try {
            session.close();
          } catch (e) {}
        }
      });

    } catch (err: any) {
      console.error("[ws] Failed to initialize Gemini Live connection:", err);
      clientWs.send(JSON.stringify({ error: "Initialization failed: " + (err.message || err) }));
      clientWs.close();
    }
  });

  // Handle server upgrades safely by extracting path from URI simply split-by-query
  server.on("upgrade", (request, socket, head) => {
    try {
      if (!request.url) return;
      const pathname = request.url.split('?')[0];
      if (pathname === "/api/live-ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      }
    } catch (err) {
      console.error("[Upgrade Server Error]:", err);
    }
  });

  // Vite integration for dev vs prod asset serving
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started on port ${PORT}`);
  });
}

startServer();
