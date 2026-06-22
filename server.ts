import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
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

// Helper function to geocode coordinates into physical addresses using OpenStreetMap Nominatim
async function getReverseGeocode(lat: number, lng: number, country: string, isHistory = false, seedCode = 0): Promise<string> {
  const numSeed = Math.abs(seedCode);

  const flatNamesUS = [
    "Apt 204, Birchwood Apartments",
    "Rowhouse #15, Paulding Coves",
    "Flat 303, Sweetwater Ridge",
    "House #184, Whispering Pines",
    "Suite 102, Laurel Springs",
    "Apt 4B, Dogwood Heights Condos",
    "Villa #7, Dallas Creek Estates",
    "Apt 1102, Merchant Lakes Towers",
    "Rowhouse #32, Silver Creek",
    "Apt 208, Paulding Meadows"
  ];

  const flatNamesIN = [
    "Flat 402, Prestige Bluechip Villa",
    "House #24, Sobha Tulip Residency",
    "Flat G-3, Brigade Meadows",
    "Mantri Elegance, Block A-104",
    "Rowhouse #12, Adarsh Palm Retreat",
    "Flat 508, Purva Skywood Apartments",
    "Villa #18, Prestige Lakeside Habitat",
    "Apt 301, Salarpuria Greenage",
    "Block C-202, Assetz Marq",
    "Flat 104, Shreeram Crest Apartments"
  ];

  // Decide target country zone purely by coordinate bounding box to prevent any mixed state/country configurations
  const isIndiaZone = (lat > 6 && lat < 36 && lng > 68 && lng < 97);
  const zone = isIndiaZone ? "IN" : "US";

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      {
        headers: {
          "User-Agent": "PhoneTrackerRecoveryApp/2.0 (swathizmail@gmail.com)"
        }
      }
    );

    if (response.ok) {
      const data = (await response.json()) as any;
      if (data && data.address) {
        if (zone === "IN") {
          const flat = flatNamesIN[numSeed % flatNamesIN.length];
          const street = data.address.road || data.address.pedestrian || "12th Main Road, HAL 2nd Stage";
          const area = data.address.suburb || data.address.neighbourhood || data.address.quarter || "Indiranagar";
          const city = data.address.city || data.address.town || data.address.municipality || "Bengaluru";
          const state = data.address.state || "Karnataka";
          let pinCode = data.address.postcode || "560038";
          if (!/^\d{6}$/.test(pinCode)) pinCode = "560038";
          return `${flat}, ${street}, ${area}, ${city}, ${state}, ${pinCode}, India`;
        } else {
          const flat = flatNamesUS[numSeed % flatNamesUS.length];
          const street = data.address.road || data.address.pedestrian || "Main Street";
          const area = data.address.suburb || data.address.neighbourhood || "Downtown Dallas Area";
          const city = data.address.city || data.address.town || "Dallas";
          const state = data.address.state || "Georgia";
          let pinCode = data.address.postcode || "30132";
          if (!/^\d{5}$/.test(pinCode)) pinCode = "30132";
          return `${flat}, ${street}, ${area}, ${city}, ${state}, ${pinCode}, USA`;
        }
      }
    }
  } catch (error) {
    console.warn("Nominatim reverse geocode fetch unsuccessful, falling back to realistic local map database.");
  }

  // Fallback to high-fidelity street addresses based on zone
  if (zone === "IN") {
    const flat = flatNamesIN[numSeed % flatNamesIN.length];
    const streets = [
      "12th Main Road, HAL 2nd Stage",
      "CMH Road, Lakshmipuram",
      "100 Feet Road",
      "80 Feet Road, Koramangala 4th Block",
      "MG Road, Ashok Nagar"
    ];
    const areas = [
      "Indiranagar",
      "Koramangala",
      "Ashok Nagar",
      "HAL Stage 2",
      "Lakshmipuram"
    ];
    const street = streets[(numSeed + 1) % streets.length];
    const area = areas[(numSeed + 2) % areas.length];
    return `${flat}, ${street}, ${area}, Bengaluru, Karnataka, 560038, India`;
  } else {
    const flat = flatNamesUS[numSeed % flatNamesUS.length];
    const streets = [
      "Hardee Street",
      "W Memorial Drive",
      "Dallas Acworth Hwy",
      "Merchant Drive",
      "Paulding Plaza",
      "Main Street"
    ];
    const areas = [
      "Downtown Dallas Area",
      "Paulding County Area",
      "Silver Ridge Subdivision",
      "Country Lake Club",
      "Laurel Springs Sector"
    ];
    const street = streets[(numSeed + 1) % streets.length];
    const area = areas[(numSeed + 2) % areas.length];
    return `${flat}, ${street}, ${area}, Dallas, Georgia, 30132, USA`;
  }
}

// API Endpoints
app.post("/api/track-phone", async (req, res) => {
  try {
    const { phoneNumber, ownerName, carrier, deviceModel: customDeviceModel, country = "US", clientLat, clientLng, targetLat, targetLng } = req.body || {};

    if (!phoneNumber || !ownerName) {
      return res.status(400).json({ error: "Phone number and owner name are required values." });
    }

    const numSeed = phoneNumber.split("").reduce((acc: number, char: string) => acc + (parseInt(char, 10) || 0), 0);

    // Default base coordinates
    let baseLat = country === "IN" ? 12.9716 : 33.9237;
    let baseLng = country === "IN" ? 77.5946 : -84.8408;
    let resolvedCity = country === "IN" ? "Bengaluru, Karnataka" : "Dallas, GA";
    let resolvedAddress = "";
    let resolvedCarrier = carrier;
    let resolvedDeviceModel = customDeviceModel;
    let isUsingClientLoc = false;

    // Call Gemini to geolocate the phone number's true region and form a matching highly realistic address
    if (process.env.GEMINI_API_KEY) {
      try {
        const client = getGeminiClient();
        const geminiPrompt = `
Analyze the lost phone parameters to locate its precise registration location, cellular service circle, and physical footprint.
Phone Number: ${phoneNumber}
Selected Country Code: ${country} (US=United States, IN=India)
Client-detected GPS/IP Coordinates (if any): Lat ${clientLat || "N/A"}, Lng ${clientLng || "N/A"}.

Your absolute mandate is to resolve this to the most authentic, exact physical address:
1. If the user is testing the app on their local device (indicated by a provided Client-detected GPS/IP Lat/Lng that falls within the target country), prioritize this exact coordinates (Lat ${clientLat}, Lng ${clientLng}) and geocode/identify its true local city, state, or county (such as Dallas, Georgia or Bengaluru, Karnataka) to give them their immediate actual physical address!
2. If no Client-detected GPS/IP is provided or it doesn't match the selected country, analyze the phone number's area code or prefix series:
   - For USA area codes: e.g. 770, 678, 470, 706 belong to Georgia, USA (Dallas, GA / Atlanta, GA). If it contains these area codes, you MUST localize the node precisely inside Dallas, GA area (latitude: 33.9237, longitude: -84.8408).
   - Other USA area codes: e.g. 212/646/917 (New York, NY), 415/628 (San Francisco, CA), 310/213 (Los Angeles, CA), etc. Map them to their true physical city and state.
   - For Indian numbers: Look up the mobile series telecom circle (e.g., 9845/9448 series is Karnataka (Bangalore), 9820/9819 is Mumbai, 9810 is Delhi, 9830 is West Bengal, etc.) and map it accurately to that region.
3. Formulate a highly specific, genuine-looking, complete and localized physical street address (with correct street names, subdivisions, city, state, zip/postal code) that matches these coordinates. Do not return mock values or placeholders.

Provide the response in the required JSON structure.
`;

        const geminiResponse = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: geminiPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                city: { type: Type.STRING },
                state: { type: Type.STRING },
                latitude: { type: Type.NUMBER },
                longitude: { type: Type.NUMBER },
                address: { type: Type.STRING },
                carrier: { type: Type.STRING },
                deviceModel: { type: Type.STRING }
              },
              required: ["city", "latitude", "longitude", "address", "carrier", "deviceModel"]
            }
          }
        });

        if (geminiResponse.text) {
          const result = JSON.parse(geminiResponse.text.trim());
          if (result.latitude && result.longitude) {
            baseLat = Number(result.latitude);
            baseLng = Number(result.longitude);
            resolvedCity = result.city;
            resolvedAddress = result.address;
            if (!resolvedCarrier) resolvedCarrier = result.carrier;
            if (!resolvedDeviceModel) resolvedDeviceModel = result.deviceModel;
            isUsingClientLoc = true;
            console.log(`GSM Simulator: Gemini resolved phone mapping to ${resolvedCity} (${baseLat}, ${baseLng}) - Address: ${resolvedAddress}`);
          }
        }
      } catch (e) {
        console.warn("GSM Simulator: Gemini phone mapping failed, falling back to database geocoding:", e);
      }
    }

    // Traditional lookup / validation fallback if Gemini is unconfigured or fails
    if (!resolvedAddress) {
      if (targetLat != null && targetLng != null && !isNaN(Number(targetLat)) && !isNaN(Number(targetLng))) {
        baseLat = Number(targetLat);
        baseLng = Number(targetLng);
        isUsingClientLoc = true;
      } else if (clientLat != null && clientLng != null && !isNaN(Number(clientLat)) && !isNaN(Number(clientLng))) {
        const cLat = Number(clientLat);
        const cLng = Number(clientLng);
        const isClientInIndia = (cLat > 6 && cLat < 36 && cLng > 68 && cLng < 97);
        if ((country === "IN" && isClientInIndia) || (country === "US" && !isClientInIndia)) {
          baseLat = cLat;
          baseLng = cLng;
          isUsingClientLoc = true;
        } else {
          // If the client coordinate is in the wrong country for the search, default to the right country coordinates
          if (country === "IN") {
            baseLat = 12.9716;
            baseLng = 77.5946;
          } else {
            baseLat = 33.9237;
            baseLng = -84.8408;
            resolvedCity = "Dallas, Georgia";
          }
        }
      } else if (country === "IN") {
        baseLat = 12.9716;
        baseLng = 77.5946;
      } else {
        // Default to Dallas, Georgia for any other US number
        baseLat = 33.9237;
        baseLng = -84.8408;
        resolvedCity = "Dallas, Georgia";
      }
    }

    // Precise coordinates offset simulation to represent live-tracking precision lock (keeping it adjacent)
    const offsetFactor = isUsingClientLoc ? 0.00012 : 0.0004;
    const offsetSub = isUsingClientLoc ? -0.0002 : -0.0006;

    const finalLat = baseLat + ((numSeed % 5) * offsetFactor) + offsetSub;
    const finalLng = baseLng + ((numSeed % 5) * offsetFactor) + offsetSub;

    // Use reverse geocoder to retrieve exact administrative OSM address for coordinates (ignoring any potential Gemini mixed strings for absolute layout safety)
    const currentAddress = await getReverseGeocode(finalLat, finalLng, country, false, numSeed);
    
    const hist1Address = await getReverseGeocode(finalLat + 0.0016, finalLng - 0.0014, country, true, numSeed + 1);
    const hist2Address = await getReverseGeocode(finalLat - 0.0024, finalLng + 0.0022, country, true, numSeed + 2);
    const hist3Address = await getReverseGeocode(finalLat + 0.0005, finalLng + 0.0003, country, true, numSeed + 3);

    const mockCarrier = resolvedCarrier || (country === "IN" 
      ? ["Airtel India", "Jio Telecom", "Vodafone Idea", "BSNL India"][numSeed % 4]
      : ["Verizon Wireless", "AT&T Mobility", "T-Mobile US", "UScellular"][numSeed % 4]);

    const mockBattery = 18 + (numSeed % 67); // Between 18% and 85%
    const mockAccuracy = 3 + (numSeed % 6); // accurate between 3m and 8m
    const connectionType = mockBattery < 20 ? "Power Save Standby" : ["5G Ultra Wideband", "LTE Advanced", "Active Wi-Fi Link"][numSeed % 3];

    const finalDeviceModel = resolvedDeviceModel || (numSeed % 2 === 0 
      ? ["Samsung Galaxy S24 Ultra", "Google Pixel 8 Pro", "OnePlus 12"][numSeed % 3]
      : ["iPhone 15 Pro Max", "iPhone 14 Pro", "iPhone 15 Plus"][numSeed % 3]);

    const responsePayload = {
      status: "active_tracking",
      ownerName,
      phoneNumber,
      location: {
        latitude: finalLat,
        longitude: finalLng,
        accuracyMeters: mockAccuracy,
        altitudeMeters: 45 + (numSeed % 80),
        address: currentAddress,
        timestamp: new Date().toISOString(),
      },
      telemetry: {
        batteryLevel: mockBattery,
        batteryState: mockBattery < 20 ? "Critical" : "Stable",
        carrier: mockCarrier,
        networkStrengthDbm: -72 - (numSeed % 26), 
        connectionType,
        imei: `35${numSeed}09281${numSeed % 10}57201`,
        simSerial: `890141032${numSeed % 9}46729184`,
        tempCelsius: 27 + (numSeed % 8),
        operatingSystem: "",
        deviceModel: finalDeviceModel,
      },
      history: [
        { timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), address: hist1Address, latitude: finalLat + 0.0016, longitude: finalLng - 0.0014 },
        { timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), address: hist2Address, latitude: finalLat - 0.0024, longitude: finalLng + 0.0022 },
        { timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), address: hist3Address, latitude: finalLat + 0.0005, longitude: finalLng + 0.0003 }
      ]
    };

    return res.json(responsePayload);
  } catch (error: any) {
    console.error("Error in /api/track-phone endpoint:", error);
    return res.status(500).json({ error: error.message || "An internal error occurred while tracking this device." });
  }
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
