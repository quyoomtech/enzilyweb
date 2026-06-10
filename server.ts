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

      const prompt = `You are a language translator. Detect the language of the following spoken text, translate it into natural conversational English, and highlight key or important words with asterisks (like *doing* or *are*) for pronunciation focus.
      
Text: "${text}"

Provide the response in the specified JSON format. Ensure detectedLanguage is a clear capitalized word (e.g. Urdu, Russian, Spanish, Arabic, Hindi, French, etc.).`;

      const targetModel = getSupportedTextModel(model);
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
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

      const prompt = `You are Enzily, a friendly AI English partner. Evaluate this sentence spoken by an English learner: "${text}".
If the user made grammatical, syntax, verb tense, or vocabulary mistakes, correct it gracefully.
If the sentence is completely natural and correct, encourage them and comment on it.
Formulate a conversational, friendly reply to keep the practice session going.

Provide the response in the specified JSON format.`;

      const targetModel = getSupportedTextModel(model);
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
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

      const formattedHistory = (history || [])
        .map((h: any) => `${h.sender === "user" ? "Yasir" : "Enzily"}: ${h.text}`)
        .join("\n");

      const prompt = `We are in a formal academic debate on the topic: "${topic}".
User (Yasir) and AI (Enzily) are opposing debaters.

Here is the dialogue history of this debate:
${formattedHistory}

Yasir's latest statement: "${text}"

Respond as Enzily (your opponent). Challenge Yasir's latest point with a sharp, respectful, and intelligence counter-argument. Keep it strictly encapsulated inside 1 to 2 direct, polite, powerful sentences so it's punchy.

Provide response in JSON format.`;

      const targetModel = getSupportedTextModel(model);
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
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
        systemInstruction = `You are an automated direct speech-to-speech translator.
Keep your modality strictly to spoken audio.
Whenever the user speaks, detect the language they are speaking.
If the language is English, translate it immediately into clear and natural Spanish, and speak ONLY the translation back.
If the language is anything other than English, translate it immediately into natural and clear conversational English, and say only the translation back.
CRITICAL: Do NOT say any other words, conversational comments, or explanations. Only speak back the direct translation. For example: if they say something equivalent to 'How are you?', you must say ONLY 'How are you?' back.`;
      } else if (mode === "practice") {
        systemInstruction = `You are Enzily, a friendly and warm AI English practice partner.
We are engaging in friendly, natural spoken conversation.
If the user makes any grammatical errors, pronunciation awkwardness, or tense issues, first point it out and gently correct them in 1 warm sentence of audio.
Then, say 1-2 friendly conversational sentences to answer them and support them, followed by a warm question to keep the practice going.
If they speak perfectly, congratulate them warmly and continue the conversation naturally in 1-2 sentences with a friendly follow-up question. Say nothing else.`;
      } else if (mode === "debate") {
        systemInstruction = `You are Enzily, an extremely clever, eloquent, and highly logical academic debate opponent.
Since we are starting a fresh debate, always start the conversation by asking the user which topic they want to debate on, or suggest a highly engaging topic (such as 'Is AI a threat to human creativity?' or 'Should we prioritize space colonization?') to kick off.
Once the topic is decided or if the user starts arguing a point, engage in a friendly but highly sharp, articulate, and academically persuasive debate.
You should defend the opposite side of whatever stance the User takes. Keep your responses concise (1-3 sentences) to maintain a fast-paced debate. Let's begin!`;
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
