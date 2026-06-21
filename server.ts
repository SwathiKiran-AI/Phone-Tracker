import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up large JSON payload limit for audio files
app.use(express.json({ limit: "50mb" }));

// Initialize the Google GenAI SDK
const key = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (ai) return ai;
  if (!key) {
    console.warn("WARNING: GEMINI_API_KEY environment variable is not defined.");
  }
  ai = new GoogleGenAI({
    apiKey: key || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  return ai;
}

// Ensure the client tries to initialize on startup to log warnings if missing
try {
  getGeminiClient();
} catch (e) {
  console.error("Error initializing Gemini Client:", e);
}

// API Endpoints
app.post("/api/track-phone", (req, res) => {
  const { phoneNumber, ownerName, carrier, deviceModel: customDeviceModel } = req.body;

  if (!phoneNumber || !ownerName) {
    return res.status(400).json({ error: "Phone number and owner name are required values." });
  }

  // Pre-calculate randomized but consistent mock tracking coordinates based on phone number seed
  const numSeed = phoneNumber.split("").reduce((acc: number, char: string) => acc + (parseInt(char, 10) || 0), 0);
  
  // Base coordinates around a general central city or random area
  const baseLat = 37.7749 + (numSeed % 100) * 0.001 - 0.05;
  const baseLng = -122.4194 + (numSeed % 150) * 0.001 - 0.05;

  const mockCarrier = carrier || ["Verizon Wireless", "AT&T Mobililty", "T-Mobile US", "Vodafone", "Airtel"][numSeed % 5];
  const mockBattery = 15 + (numSeed % 76); // Between 15% and 90%
  const mockAccuracy = 3 + (numSeed % 12); // accurate between 3m and 15m
  const connectionType = mockBattery < 20 ? "Power Save Standby" : ["5G Ultra Wideband", "LTE Advanced", "Active Wi-Fi Link"][numSeed % 3];

  const operatingSystem = "";
  const finalDeviceModel = customDeviceModel || (numSeed % 2 === 0 
    ? ["Samsung Galaxy S24 Ultra", "Google Pixel 8 Pro", "OnePlus 12"][numSeed % 3]
    : ["iPhone 15 Pro Max", "iPhone 14 Pro", "iPhone 15 Plus"][numSeed % 3]);

  const responsePayload = {
    status: "active_tracking",
    ownerName,
    phoneNumber,
    location: {
      latitude: baseLat,
      longitude: baseLng,
      accuracyMeters: mockAccuracy,
      altitudeMeters: 45 + (numSeed % 120),
      timestamp: new Date().toISOString(),
    },
    telemetry: {
      batteryLevel: mockBattery,
      batteryState: mockBattery < 20 ? "Critical" : "Stable",
      carrier: mockCarrier,
      networkStrengthDbm: -75 - (numSeed % 30), // e.g. -75 to -105 dBM
      connectionType,
      imei: `35${numSeed}09281${numSeed % 10}57201`,
      simSerial: `890141032${numSeed % 9}46729184`,
      tempCelsius: 28 + (numSeed % 10),
      operatingSystem,
      deviceModel: finalDeviceModel,
    },
    history: [
      { timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), address: "Near local communication hub", latitude: baseLat + 0.0012, longitude: baseLng - 0.0008 },
      { timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), address: "Standard cellular intersection node", latitude: baseLat - 0.002, longitude: baseLng + 0.0015 },
      { timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), address: "Primary registered owner residence", latitude: baseLat + 0.0004, longitude: baseLng + 0.0001 }
    ]
  };

  return res.json(responsePayload);
});

app.post("/api/tracker-chat", async (req, res) => {
  try {
    const { prompt, trackingInfo } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt value." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini API key is not configured on the server. Please verify Secrets panel setup.",
      });
    }

    const client = getGeminiClient();

    let telemetryContext = "";
    if (trackingInfo) {
      telemetryContext = `
You are tracking a phone with these specifics:
- Owner Name: ${trackingInfo.ownerName}
- Phone Number: ${trackingInfo.phoneNumber}
- Carrier: ${trackingInfo.telemetry?.carrier}
- Battery: ${trackingInfo.telemetry?.batteryLevel}% (${trackingInfo.telemetry?.batteryState})
- Latitude: ${trackingInfo.location?.latitude}, Longitude: ${trackingInfo.location?.longitude}
- Battery Temp: ${trackingInfo.telemetry?.tempCelsius}°C
- Accuracy: ${trackingInfo.location?.accuracyMeters} meters
`;
    }

    const systemInstructions = `
You are the Gemini Phone Tracking and Recovery Specialist. Help the user salvage or retrieve their lost device.
Using the tracking parameters provided (if any), give advice on safety, next-best physical steps (e.g. going to police, triggering remote ring, locking devices, remote wiped safeguards), and explaining technical tracking jargon simply.
Never promise real physical recovery yourself. Act like a helpful built-in security assistant. Be professional, direct, concise, and helpful. Keep recommendations realistic.
`;

    const chatResponse = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: systemInstructions + "\n" + telemetryContext + "\nUser asks: " + prompt }] }
      ]
    });

    return res.json({ response: chatResponse.text || "Could not generate guidance. Please try again." });
  } catch (error: any) {
    console.error("Tracker Advisor Chat error:", error);
    return res.status(500).json({
      error: error.message || "An unexpected error occurred during security consultation.",
    });
  }
});

app.post("/api/transcribe", async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "Missing audio data in request body." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini API key is not configured on the server. Please check your Secret keys.",
      });
    }

    const client = getGeminiClient();

    // Prepare content part with the base64 encoded audio
    const audioPart = {
      inlineData: {
        mimeType: mimeType || "audio/webm",
        data: audioBase64,
      },
    };

    const promptText = "Transcribe this audio file verbatim. Do not summarize, summarize or explain. Output ONLY the transcription. If there is no audible speech in the audio, respond with an empty transcription or (No clear speech detected).";

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [audioPart, promptText],
    });

    const transcription = response.text || "";

    return res.json({ transcription: transcription.trim() });
  } catch (error: any) {
    console.error("Error transcribing audio:", error);
    return res.status(500).json({
      error: error.message || "An unexpected error occurred during transcription.",
    });
  }
});

// Configure Vite or Static Assets based on environment
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite integration...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error("Failed to start full-stack server setup:", err);
});
