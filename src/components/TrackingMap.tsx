import React, { useEffect, useRef, useState } from "react";
import { Compass, ZoomIn, ZoomOut, Navigation, Map, Layers } from "lucide-react";
import { TrackingLocation } from "../types";

const GOOGLE_MAPS_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  "";
const hasValidKey = Boolean(GOOGLE_MAPS_KEY) && GOOGLE_MAPS_KEY !== "";

interface TrackingMapProps {
  location: TrackingLocation;
  ownerName: string;
}

export default function TrackingMap({ location, ownerName }: TrackingMapProps) {
  const [zoom, setZoom] = useState<number>(3.0);
  const [mapMode, setMapMode] = useState<"standard" | "satellite" | "hybrid">("hybrid");
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const [dimensions, setDimensions] = useState({ width: 720, height: 330 });

  // Handle container resizing to keep radar canvas perfectly dimensioned
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: width || 720, height: height || 330 });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Overlay HUD scanning lines (Super-crisp Canvas over map context)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dimensions.width || 720;
    const h = dimensions.height || 330;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    let radarAngle = 0;

    const drawScan = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;

      // 1. Sweeping scanner overlay
      radarAngle += 0.015;
      const sweepColor = mapMode === "standard" ? "rgba(245, 158, 11, 0.04)" : "rgba(34, 197, 94, 0.05)";
      const sweepGradient = ctx.createRadialGradient(cx, cy, 5, cx, cy, 280);
      sweepGradient.addColorStop(0, sweepColor);
      sweepGradient.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = sweepGradient;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 280, radarAngle, radarAngle + 0.45);
      ctx.closePath();
      ctx.fill();

      // 2. Telemetry Rangefinder Rings
      ctx.strokeStyle = mapMode === "standard" ? "rgba(245, 158, 11, 0.15)" : "rgba(34, 197, 94, 0.2)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.arc(cx, cy, 120, 0, Math.PI * 2);
      ctx.arc(cx, cy, 200, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshair markers
      ctx.strokeStyle = mapMode === "standard" ? "rgba(245, 158, 11, 0.25)" : "rgba(34, 197, 94, 0.35)";
      ctx.lineWidth = 1;
      
      // Top hash
      ctx.beginPath(); ctx.moveTo(cx, cy - 215); ctx.lineTo(cx, cy - 200); ctx.stroke();
      // Bottom hash
      ctx.beginPath(); ctx.moveTo(cx, cy + 200); ctx.lineTo(cx, cy + 215); ctx.stroke();
      // Left hash
      ctx.beginPath(); ctx.moveTo(cx - 215, cy); ctx.lineTo(cx - 200, cy); ctx.stroke();
      // Right hash
      ctx.beginPath(); ctx.moveTo(cx + 200, cy); ctx.lineTo(cx + 215, cy); ctx.stroke();

      animationRef.current = requestAnimationFrame(drawScan);
    };

    drawScan();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, mapMode]);

  // Translate zoom slider state (1.2 to 6.0) to Google Maps zoom levels (11 to 20)
  const googleMapsZoom = Math.round(11 + (zoom - 1.2) * (8 / 4.8));
  // Translate map mode standard/satellite/hybrid to Google Maps 't' parameter
  const mapTypeParam = mapMode === "standard" ? "m" : mapMode === "satellite" ? "k" : "h";
  // Create standard embedded Google Maps URL with correct pin lat/lng coordinates and view parameters
  const embeddedMapUrl = `https://maps.google.com/maps?q=${location.latitude},${location.longitude}&z=${googleMapsZoom}&t=${mapTypeParam}&output=embed`;

  return (
    <div className="flex flex-col gap-4">
      {/* Map Viewer Box */}
      <div ref={containerRef} className="relative w-full h-[320px] rounded-2xl border border-zinc-200 bg-zinc-950 overflow-hidden shadow-sm flex flex-col justify-end">
        
        {/* Real Embedded Google Maps Frame */}
        <div className="absolute inset-0 z-0 bg-zinc-900" style={{ width: "100%", height: "100%" }}>
          <iframe
            title="Embedded Google Maps Target Tracker"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="eager"
            allowFullScreen
            referrerPolicy="no-referrer"
            src={embeddedMapUrl}
          />
        </div>

        {/* Military Sweeping & Triangulation radar lines overlay */}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 z-10 w-full h-full object-cover"
        />

        {/* Top Left Status Info overlay */}
        <div className="absolute top-3 left-3 bg-white/95 border border-zinc-200 px-3 py-1.5 rounded-xl flex items-center space-x-2 shadow-sm backdrop-blur-md z-20 transition">
          <Navigation className="w-4 h-4 text-amber-500 animate-pulse rotate-45" />
          <div>
            <span className="text-[9px] font-mono font-bold text-zinc-900 uppercase tracking-wider block font-semibold">
              LIVE GOOGLE MAPS GPS EMBED
            </span>
            <span className="text-[8px] text-zinc-500 font-mono block">
              REAL-TIME HIGH FIDELITY GEOMETRY
            </span>
          </div>
        </div>

        {/* Map Mode selector buttons */}
        <div className="absolute top-3 right-3 bg-white/95 border border-zinc-200 p-1 rounded-xl flex items-center space-x-0.5 shadow-sm backdrop-blur-md z-20">
          <button
            onClick={() => setMapMode("standard")}
            className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-lg transition-all font-mono cursor-pointer ${
              mapMode === "standard"
                ? "bg-amber-500 text-zinc-950 shadow-xs"
                : "text-zinc-650 hover:bg-zinc-100"
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setMapMode("satellite")}
            className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-lg transition-all font-mono cursor-pointer ${
              mapMode === "satellite"
                ? "bg-amber-500 text-zinc-950 shadow-xs"
                : "text-zinc-650 hover:bg-zinc-100"
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapMode("hybrid")}
            className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-lg transition-all font-mono cursor-pointer ${
              mapMode === "hybrid"
                ? "bg-amber-500 text-zinc-950 shadow-xs"
                : "text-zinc-650 hover:bg-zinc-100"
            }`}
          >
            Hybrid
          </button>
        </div>

        {/* Zoom control buttons */}
        <div className="absolute bottom-3 right-3 flex items-center space-x-1.5 z-20">
          <button
            onClick={() => setZoom((prev) => Math.min(prev + 0.6, 6.0))}
            className="p-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 hover:text-amber-500 rounded-lg shadow-sm transition cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((prev) => Math.max(prev - 0.6, 1.2))}
            className="p-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 hover:text-amber-500 rounded-lg shadow-sm transition cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target coordinates and diagnostic data panel - RENDERED OUTSIDE (BELOW) THE MAP FOR 100% UNOBSTRUCTED READABILITY! */}
      <div className="bg-white border border-zinc-200 px-4 py-3.5 rounded-2xl text-[11px] font-mono text-zinc-700 shadow-xs space-y-2.5 block">
        <div className="font-bold text-xs text-zinc-900 border-b border-zinc-100 pb-2 mb-1 flex items-center justify-between">
          <span className="tracking-tight text-zinc-900">GPS TELEMETRY TARGET FEED</span>
          <span className="text-[10px] text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-md border border-emerald-200/50 uppercase tracking-wider animate-pulse font-semibold">
            Locked Online
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-zinc-650 font-mono">
          <div className="flex justify-between items-center py-1 border-b border-dashed border-zinc-100 sm:border-0">
            <span className="text-zinc-400 uppercase tracking-wider">Device ID Marker:</span>
            <span className="font-bold text-zinc-800 font-sans">Target Lost Device</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-dashed border-zinc-100 sm:border-0">
            <span className="text-zinc-400 uppercase tracking-wider">Estimated Precision Check:</span>
            <span className="font-bold text-emerald-600">±{location.accuracyMeters} METERS</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-dashed border-zinc-100 sm:border-0">
            <span className="text-zinc-400 uppercase tracking-wider">Physical Latitude:</span>
            <span className="font-bold text-zinc-800 text-[11px]">{location.latitude.toFixed(6)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-dashed border-zinc-100 sm:border-0">
            <span className="text-zinc-400 uppercase tracking-wider">Physical Longitude:</span>
            <span className="font-bold text-zinc-800 text-[11px]">{location.longitude.toFixed(6)}</span>
          </div>
        </div>
        {location.address && (
          <div className="border-t border-zinc-200 pt-2.5 mt-1 text-[10px] flex flex-col gap-1">
            <span className="text-zinc-400 font-bold uppercase tracking-wider">CONFIRMED PHYSICAL STREET ADDRESS:</span>
            <span className="font-bold text-zinc-800 text-[12.5px] font-sans leading-relaxed">{location.address}</span>
          </div>
        )}

        <div className="border-t border-zinc-200 pt-3 mt-1.5 flex flex-col gap-2">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
            target="_blank"
            rel="noreferrer noopener"
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/25"
          >
            <Map className="w-4 h-4" />
            Open Exact GPS Pin in Google Maps App / Web
          </a>

          {!hasValidKey && (
            <div className="text-[9.5px] bg-amber-50/60 border border-amber-200/40 p-2.5 rounded-xl text-amber-900 leading-normal">
              💡 <strong>Tip</strong>: To embed Google Maps directly inside this frame, open <strong>Settings</strong> (⚙️ top-right) → <strong>Secrets</strong> and add your <code>GOOGLE_MAPS_PLATFORM_KEY</code>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
