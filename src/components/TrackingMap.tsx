import React, { useEffect, useRef, useState } from "react";
import { Compass, ZoomIn, ZoomOut, Navigation, Map, Layers } from "lucide-react";
import { TrackingLocation } from "../types";

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

  // Handle high quality ResizeObserver backing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: width || 720, height: height || 330 });
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set high-DPI scaling context for ultra crisp graphics
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    let pulseScale = 1;
    let pulseGrowing = true;
    let radarAngle = 0;

    const drawMap = () => {
      const w = dimensions.width;
      const h = dimensions.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // --- A. BACKGROUND & STATIC BASE ---
      if (mapMode === "standard") {
        ctx.fillStyle = "#edf2f7"; // Very soft light grey urban grid base
      } else if (mapMode === "satellite") {
        ctx.fillStyle = "#0c100d"; // Dark tactical earth base
      } else {
        ctx.fillStyle = "#111b15"; // Rich dark deep forest green hybrid background
      }
      ctx.fillRect(0, 0, w, h);

      // --- B. ZOOMABLE COORDINATE SPACE ---
      ctx.save();
      // Center transformation on the target's coordinates
      ctx.translate(cx, cy);
      // Perfect responsive scale modifier
      ctx.scale(zoom / 3.0, zoom / 3.0);

      if (mapMode === "standard") {
        // ==========================================
        // 1. STANDARD GRID MAP MODE (Shinjuku Tokyo style - image 3)
        // ==========================================

        // Solid soft-grey block structures representing city land plots
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;

        const blocks = [
          { x: -350, y: -260, w: 140, h: 110 },
          { x: -180, y: -260, w: 120, h: 100 },
          { x: -350, y: -125, w: 150, h: 130 },
          { x: -170, y: -10, w: 100, h: 90 },
          { x: 120, y: -280, w: 140, h: 120 },
          { x: 280, y: -280, w: 120, h: 110 },
          { x: 120, y: -140, w: 130, h: 130 },
          { x: 280, y: -150, w: 140, h: 140 },
          { x: -350, y: 150, w: 160, h: 130 },
          { x: -150, y: 160, w: 110, h: 115 },
          { x: 140, y: 150, w: 120, h: 130 },
          { x: 280, y: 150, w: 150, h: 140 }
        ];

        blocks.forEach(b => {
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(b.x, b.y, b.w, b.h, 6);
          } else {
            ctx.rect(b.x, b.y, b.w, b.h);
          }
          ctx.fill();
          ctx.stroke();
        });

        // Soft pale green city parks
        ctx.fillStyle = "#d4ebd0"; // beautiful pale green (image 3)
        ctx.strokeStyle = "#bad993";
        ctx.lineWidth = 1.2;

        const parks = [
          { x: -140, y: -120, r: 45 },
          { x: 70, y: 160, r: 75 } // Shinjuku Gyoen National Garden proxy
        ];

        parks.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw little trees inside park
          ctx.fillStyle = "#a8d67a";
          ctx.beginPath();
          ctx.arc(p.x - 10, p.y - 10, 4, 0, Math.PI * 2);
          ctx.arc(p.x + 15, p.y + 10, 5, 0, Math.PI * 2);
          ctx.arc(p.x - 5, p.y + 20, 4, 0, Math.PI * 2);
          ctx.fill();
        });

        // Subway / Railway lines (JR Yamanote and Chuo line color schemes)
        ctx.strokeStyle = "#bce4f2"; // Beautiful light-blue transit lane
        ctx.lineWidth = 6;
        ctx.lineCap = "round";

        // Curved transit line 1
        ctx.beginPath();
        ctx.moveTo(-110, -320);
        ctx.bezierCurveTo(-90, -100, -90, 100, -110, 320);
        ctx.stroke();

        // Overlay Yamanote black-white dashed effect (high production value!)
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Curved transit line 2 (Seibu Shinjuku line / Subway crossing)
        ctx.strokeStyle = "#cfe2fe";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-350, 40);
        ctx.quadraticCurveTo(0, 50, 350, -40);
        ctx.stroke();

        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // White Major Streets (Double bordered clean lines)
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 14;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Vertical Meiji-dori Avenue
        ctx.beginPath();
        ctx.moveTo(35, -350);
        ctx.lineTo(35, 350);
        ctx.stroke();

        // Horizontal Boulevard Yasukuni-dori
        ctx.beginPath();
        ctx.moveTo(-350, -60);
        ctx.lineTo(350, -60);
        ctx.stroke();

        // Secondary cross street
        ctx.beginPath();
        ctx.moveTo(-350, 110);
        ctx.lineTo(350, 110);
        ctx.stroke();

        // White inner fills for streets
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(35, -350);
        ctx.lineTo(35, 350);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-350, -60);
        ctx.lineTo(350, -60);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-350, 110);
        ctx.lineTo(350, 110);
        ctx.stroke();

        // Street labels and building tags
        ctx.fillStyle = "rgba(71, 85, 105, 0.9)";
        ctx.font = "bold 9px system-ui, -apple-system, sans-serif";
        ctx.fillText("Meiji-dori Ave", 45, -200);
        ctx.fillText("Yasukuni-dori Blvd", -260, -70);
        ctx.fillText("Okubo-dori", -220, 122);

        // Render Shinjuku Japanese landmarks (image 3 representation)
        ctx.fillStyle = "#1e3a8a"; // Deep primary blue for district labels
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillText("Shinjuku City 新宿区", 110, -10);

        ctx.fillStyle = "rgba(71, 85, 105, 0.75)";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.fillText("Wakamatsu-cho", 180, -210);
        ctx.fillText("Higashi-Shinjuku 東新宿", 70, -85);

        // Vector GPS pins (Tokyo POI style)
        const pois = [
          { x: -110, y: -45, color: "#eb4899", label: "Hotel Gracery Shinjuku", type: "hotel" },
          { x: 190, y: -80, color: "#eb4899", label: "Hotel Sunlite Shinjuku", type: "hotel" },
          { x: -240, y: -80, color: "#3b82f6", label: "FamilyMart 7-Eleven", type: "shop" },
          { x: -50, y: 190, color: "#3b82f6", label: "Lawson S Shinjuku", type: "shop" },
          { x: 140, y: 180, color: "#0ea5e9", label: "Tokyo Toy Museum", type: "cultural" }
        ];

        pois.forEach(poi => {
          drawCustomPin(ctx, poi.x, poi.y, poi.color);
          drawLabelBox(ctx, poi.x + 10, poi.y - 12, poi.label, poi.type);
        });

      } else if (mapMode === "satellite") {
        // ==========================================
        // 2. SATELLITE MAP MODE (Central Park NY style - image 2)
        // ==========================================

        // Split-view layout: Left portion is Central Park, right is Manhattan Grid
        const dividerX = -45;

        // Draw Central Park rich foliage gradient (Left)
        const parkGrad = ctx.createLinearGradient(-350, 0, dividerX, 0);
        parkGrad.addColorStop(0, "#0e2311"); // Rich dark forest evergreen
        parkGrad.addColorStop(0.7, "#142d17"); 
        parkGrad.addColorStop(1, "#1c3d1f"); 
        ctx.fillStyle = parkGrad;
        ctx.fillRect(-350, -350, dividerX + 350, 700);

        // Draw Central Park details inside organic zone
        // 1. Water reservoirs (deep navy blue lake)
        ctx.fillStyle = "#0c1b2c";
        ctx.strokeStyle = "#1a3a54";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(-140, -40, 60, 0, Math.PI * 2);
        ctx.rect(-240, -110, 110, 70);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "rgba(46, 125, 50, 0.85)"; // grass fields patches (baseball diamonds)
        const diamonds = [
          { x: -180, y: 120, r: 12 },
          { x: -150, y: 150, r: 10 },
          { x: -220, y: 80, r: 15 }
        ];
        diamonds.forEach(d => {
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
          // diamond outline
          ctx.strokeStyle = "rgba(255, 235, 120, 0.45)";
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // Draw Central Park organic dense overlapping tree canopies
        ctx.fillStyle = "rgba(24, 73, 31, 0.5)";
        for (let idx = 0; idx < 16; idx++) {
          const tx = -310 + (idx * 17) % 240;
          const ty = -290 + (idx * 39) % 550;
          ctx.beginPath();
          ctx.arc(tx, ty, 20 + (idx % 3) * 6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw Manhattan Grid layout on the right of dividerX
        ctx.fillStyle = "#16191b"; // Dark grey slate asphalt area
        ctx.fillRect(dividerX, -350, 450, 700);

        // Highly dense Manhattan cross blocks (grey building footprints and shadows)
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 0.5;

        for (let bx = 0; bx < 5; bx++) {
          for (let by = -4; by < 4; by++) {
            const posX = dividerX + 20 + bx * 75;
            const posY = by * 85 + 25;

            // Soft 3D shadow representing tall apartment skyscrapers (Central Park West style)
            ctx.fillStyle = "#0c0d10";
            ctx.fillRect(posX + 4, posY + 4, 52, 55);

            // Roof top tiles
            ctx.fillStyle = "#272a2e"; // Slate concrete roof top
            ctx.fillRect(posX, posY, 52, 55);
            ctx.strokeRect(posX, posY, 52, 55);

            // Elevator shaft shaft details & roof equipment
            ctx.fillStyle = "#3a4046";
            ctx.fillRect(posX + 15, posY + 15, 20, 20);
            ctx.fillStyle = "#1e2124";
            ctx.fillRect(posX + 20, posY + 20, 10, 10);
            
            // Faint yellow windows glowing inside skyscraper shafts
            ctx.fillStyle = "rgba(250, 204, 21, 0.95)";
            ctx.fillRect(posX + 5, posY + 5, 2.5, 2.5);
            ctx.fillRect(posX + 45, posY + 45, 2.5, 2.5);
          }
        }

        // High contrast crisp street corridors cutting between blocks (image 2)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2.5;

        // Vertical avenues (5th Ave, Madison Ave, Park Ave)
        const avenues = [dividerX, dividerX + 80, dividerX + 155, dividerX + 230, dividerX + 305];
        avenues.forEach(av => {
          ctx.beginPath();
          ctx.moveTo(av, -350);
          ctx.lineTo(av, 350);
          ctx.stroke();
        });

        // Horizontal cross streets
        for (let ys = -340; ys < 350; ys += 85) {
          ctx.beginPath();
          ctx.moveTo(dividerX, ys);
          ctx.lineTo(380, ys);
          ctx.stroke();
        }

        // Overlay transparent telemetry coordinate gridlines (tactical satellite signature)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.055)";
        ctx.lineWidth = 1;
        const satStep = 40;
        for (let gx = -350; gx < 350; gx += satStep) {
          ctx.beginPath();
          ctx.moveTo(gx, -350);
          ctx.lineTo(gx, 350);
          ctx.stroke();
        }
        for (let gy = -350; gy < 350; gy += satStep) {
          ctx.beginPath();
          ctx.moveTo(-350, gy);
          ctx.lineTo(350, gy);
          ctx.stroke();
        }

        // Key geographic tags
        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillText("Central Park", -260, -220);
        ctx.fillText("NYU Institute", 120, -240);

        ctx.fillStyle = "rgba(244, 244, 245, 0.7)";
        ctx.font = "bold 8px monospace";
        ctx.fillText("5TH AVE", dividerX + 5, -310);
        ctx.fillText("MADISON AVE", dividerX + 85, -310);
        ctx.fillText("E 72ND ST", dividerX + 90, -160);

      } else {
        // ==========================================
        // 3. HYBRID MAP MODE (Princes Hwy Australian Suburbs - image 1)
        // ==========================================

        // Base green lawns and forest canopies
        ctx.fillStyle = "#112616"; 
        ctx.fillRect(-350, -350, 700, 700);

        // Render detailed residential blocks with cozy green cottages, lawns & red roofs
        const parcelSizeX = 90;
        const parcelSizeY = 95;

        for (let rx = -4; rx < 4; rx++) {
          for (let ry = -4; ry < 4; ry++) {
            // Leave target area coordinate at (0,0) uncluttered
            if (Math.abs(rx) <= 0 && Math.abs(ry) <= 0) continue;

            const px = rx * parcelSizeX - 25;
            const py = ry * parcelSizeY + 15;

            // Draw lawn courtyard backyard
            ctx.fillStyle = (rx + ry) % 2 === 0 ? "#19351e" : "#142e1a";
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(px, py, 65, 70, 4);
            } else {
              ctx.rect(px, py, 65, 70);
            }
            ctx.fill();

            // Neighboring fence trees
            ctx.fillStyle = "rgba(22, 101, 52, 0.6)";
            ctx.beginPath();
            ctx.arc(px + 8, py + 8, 8, 0, Math.PI * 2);
            ctx.arc(px + 55, py + 55, 9, 0, Math.PI * 2);
            ctx.fill();

            // Render cottage building roofs (red tiles, charcoal metal sheet and sand)
            const roofColors = ["#ac3922", "#475569", "#d4cdbc"]; // brick red / tile charcoal / sand metal sheet
            const selectRoof = roofColors[Math.abs(rx + ry) % 3];

            // Primary house body shadow
            ctx.fillStyle = "rgba(0,0,0,0.45)";
            ctx.fillRect(px + 18, py + 18, 32, 34);

            // 3D Roof structure
            ctx.fillStyle = selectRoof;
            ctx.fillRect(px + 15, py + 15, 32, 34);

            // Gable highlights
            ctx.fillStyle = "rgba(255,255,255,0.18)";
            ctx.beginPath();
            ctx.moveTo(px + 15, py + 15);
            ctx.lineTo(px + 31, py + 32);
            ctx.lineTo(px + 47, py + 15);
            ctx.fill();

            // Little chimney structure
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(px + 36, py + 20, 4, 4);
          }
        }

        // Draw curved double-lane Major Freeway (Princes Hwy - image 1)
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 26;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const drawPrincesHwyPath = (context: CanvasRenderingContext2D) => {
          context.beginPath();
          context.moveTo(-350, -180);
          context.bezierCurveTo(-150, -120, -50, 60, 110, 320);
        };

        // Dark road shadow border
        drawPrincesHwyPath(ctx);
        ctx.stroke();

        ctx.strokeStyle = "#475569"; // Asphalt gray surface
        ctx.lineWidth = 18;
        drawPrincesHwyPath(ctx);
        ctx.stroke();

        ctx.strokeStyle = "#10b981"; // Radiant neon green glowing highway lanes (image 1)
        ctx.lineWidth = 12;
        drawPrincesHwyPath(ctx);
        ctx.stroke();

        ctx.strokeStyle = "#059669"; // Inner forest green divider
        ctx.lineWidth = 2.5;
        drawPrincesHwyPath(ctx);
        ctx.stroke();

        // White solid edge margins
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([0]);
        drawPrincesHwyPath(ctx);
        ctx.stroke();

        // Double yellow dashes lane split center
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 0.8;
        ctx.setLineDash([5, 5]);
        drawPrincesHwyPath(ctx);
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash

        // Overlapping residential local asphalt streets of Clarke St, Marine Dr, Tilba Ln
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 13;

        const drawLocalStreets = (context: CanvasRenderingContext2D) => {
          // Clarke St running horizontally
          context.beginPath();
          context.moveTo(-350, -20);
          context.lineTo(350, -75);
          context.stroke();

          // Marine Dr crossing under Hwy
          context.beginPath();
          context.moveTo(-320, 185);
          context.lineTo(310, 160);
          context.stroke();

          // Tilba Ln running vertically
          context.beginPath();
          context.moveTo(110, -320);
          context.lineTo(50, 320);
          context.stroke();
          
          // Farncomb Ave
          context.beginPath();
          context.moveTo(-350, 130);
          context.lineTo(-50, 100);
          context.stroke();
        };

        // Draw background outlines for local streets
        drawLocalStreets(ctx);

        ctx.strokeStyle = "#5f6c7a"; // slate gray asphalt surface
        ctx.lineWidth = 9;
        drawLocalStreets(ctx);

        // Fine white center lane dashes for suburb lanes
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        drawLocalStreets(ctx);
        ctx.setLineDash([]); // Reset

        // Cozy Street labels perfectly matching image 1
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
        // White stroke around text for maximum readability on green satellite imagery
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 3.5;
        ctx.miterLimit = 2;

        const streetLabels = [
          { text: "Princes Hwy", x: -140, y: -45, angle: 0.17 },
          { text: "Clarke St", x: 140, y: -80, angle: -0.07 },
          { text: "Tilba Ln", x: 110, y: -190, angle: 1.6 },
          { text: "Marine Dr", x: 180, y: 145, angle: -0.04 },
          { text: "Farncomb Ave", x: -240, y: 135, angle: -0.03 },
          { text: "Collins Cres", x: -180, y: 240, angle: 1.55 },
          { text: "Foster St", x: 235, y: -160, angle: 1.6 }
        ];

        streetLabels.forEach(label => {
          ctx.save();
          ctx.translate(label.x, label.y);
          ctx.rotate(label.angle);
          ctx.strokeText(label.text, 0, 0);
          ctx.fillText(label.text, 0, 0);
          ctx.restore();
        });

        // A1 Highway Shield badge
        ctx.save();
        ctx.translate(-5, 90);
        ctx.fillStyle = "#166534"; // shield green
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-10, -10, 20, 16, 3);
        } else {
          ctx.rect(-10, -10, 20, 16);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("A1", 0, 1);
        ctx.restore();

        // Yellow-Orange Busy Area Badge (top center of Hwy - image 1)
        ctx.save();
        ctx.translate(35, -170);
        // Orange neon pill shadow
        ctx.shadowColor = "rgba(249, 115, 22, 0.4)";
        ctx.shadowBlur = 6;

        ctx.fillStyle = "#faf5ff";
        ctx.strokeStyle = "#f97316"; // Bright orange
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-35, -12, 70, 22, 11);
        } else {
          ctx.rect(-35, -12, 70, 22);
        }
        ctx.fill();
        ctx.stroke();

        // draw orange circle signal bar icon
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.arc(-22, -1, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff"; // mini inner bar lines
        ctx.fillRect(-24, 0, 1.2, -2);
        ctx.fillRect(-22.2, 1, 1.2, -3.5);
        ctx.fillRect(-20.4, 2, 1.2, -5);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.fillText("Busy area", -10, 3);
        ctx.restore();

        // Accommodations pink icon bed
        drawCustomPin(ctx, -240, 60, "#db2777");

      }

      // 2. RADAR SWEEPING SCANNER LAYER (Shared tracking effect)
      radarAngle += 0.012;
      const themeColor = mapMode === "standard" ? "245, 158, 11" : "34, 197, 94";
      const sweepColor = mapMode === "standard" ? "rgba(245, 158, 11, 0.05)" : "rgba(34, 197, 94, 0.06)";

      const radarGradient = ctx.createRadialGradient(0, 0, 3, 0, 0, 240);
      radarGradient.addColorStop(0, sweepColor);
      radarGradient.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = radarGradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 240, radarAngle, radarAngle + 0.5);
      ctx.closePath();
      ctx.fill();

      // Concentric signal range reference rings
      ctx.strokeStyle = mapMode === "standard" ? "rgba(245, 158, 11, 0.15)" : "rgba(34, 197, 94, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, Math.PI * 2);
      ctx.arc(0, 0, 130, 0, Math.PI * 2);
      ctx.arc(0, 0, 200, 0, Math.PI * 2);
      ctx.stroke();

      // Cellular triangulation antennas zooming naturally
      const towers = [
        { x: -140, y: -90, id: "TOWER-09A" },
        { x: 180, y: -50, id: "TOWER-12D" },
        { x: -110, y: 110, id: "TOWER-44K" }
      ];

      towers.forEach(tower => {
        // Redraw beacon coordinates
        ctx.fillStyle = mapMode === "standard" ? "#d97706" : "#22c55e";
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Connect trace lines
        ctx.strokeStyle = mapMode === "standard" ? "rgba(245, 158, 11, 0.12)" : "rgba(34, 197, 94, 0.16)";
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tower.x, tower.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label name
        ctx.fillStyle = mapMode === "standard" ? "rgba(71, 85, 105, 0.85)" : "rgba(244, 244, 245, 0.7)";
        ctx.font = "bold 8px monospace";
        ctx.fillText(tower.id, tower.x + 8, tower.y + 3);
      });

      // Accuracy Ring around center target zooming dynamically
      if (pulseGrowing) {
        pulseScale += 0.01;
        if (pulseScale > 1.35) pulseGrowing = false;
      } else {
        pulseScale -= 0.01;
        if (pulseScale < 0.9) pulseGrowing = true;
      }

      ctx.fillStyle = mapMode === "standard" ? "rgba(245, 158, 11, 0.08)" : "rgba(34, 197, 94, 0.11)";
      ctx.strokeStyle = mapMode === "standard" ? "rgba(217, 119, 6, 0.35)" : "rgba(34, 197, 94, 0.45)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, location.accuracyMeters * pulseScale * 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // --- C. END ZOOMABLE TRANSFORMATION ---
      ctx.restore();

      // --- D. DRAW CRISP STATIC OVERLAYS Outside Scale space (Center Target dot stays sharp!) ---
      ctx.fillStyle = "#eab308"; // Glowing golden yellow locator dot
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;

      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 6;

      ctx.beginPath();
      ctx.arc(cx, cy, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0; // Reset canvas shadows

      // White inner core
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Text tracking label overlay
      ctx.fillStyle = mapMode === "standard" ? "#0f172a" : "#ffffff";
      ctx.font = "bold 11.5px system-ui, -apple-system, sans-serif";
      ctx.shadowColor = mapMode === "standard" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.85)";
      ctx.shadowBlur = mapMode === "standard" ? 2 : 4;
      ctx.fillText(`${ownerName}'s Phone`, cx + 15, cy - 7);

      ctx.fillStyle = mapMode === "standard" ? "#475569" : "rgba(244, 244, 245, 0.88)";
      ctx.font = "8px monospace";
      ctx.fillText(`COORDINATES LOCATED WITH ±${location.accuracyMeters}M PRECISION`, cx + 15, cy + 6);
      ctx.fillText(`GPS: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`, cx + 15, cy + 16);
      ctx.shadowBlur = 0; // clear

      animationRef.current = requestAnimationFrame(drawMap);
    };

    drawMap();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [location, zoom, ownerName, mapMode, dimensions]);

  // Helper function to draw custom pins
  const drawCustomPin = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-4, -5, -6.5, -9, -6.5, -12);
    ctx.arc(0, -12, 6.5, Math.PI, 0, false);
    ctx.bezierCurveTo(6.5, -9, 4, -5, 0, 0);
    ctx.closePath();
    ctx.fill();

    // White inner core
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, -12, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Helper function to draw labels on standard/hybrid maps
  const drawLabelBox = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    type: string
  ) => {
    ctx.save();
    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(text);
    const w = metrics.width + 8;
    const h = 14;

    ctx.fillStyle = type === "hotel" ? "#fdf2f8" : type === "shop" ? "#eff6ff" : "#f1f5f9";
    ctx.strokeStyle = type === "hotel" ? "#fbcfe8" : type === "shop" ? "#bfdbfe" : "#cbd5e1";
    ctx.lineWidth = 1;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y - h / 2, w, h, 3);
    } else {
      ctx.rect(x, y - h / 2, w, h);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = type === "hotel" ? "#9d174d" : type === "shop" ? "#1d4ed8" : "#334155";
    ctx.fillText(text, x + 4, y);
    ctx.restore();
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.6, 6.0));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.6, 1.2));
  };

  return (
    <div ref={containerRef} className="relative w-full h-[330px] rounded-2xl border border-zinc-200 bg-zinc-50 overflow-hidden shadow-sm flex flex-col justify-end">
      
      {/* Top Left Status Info overlay */}
      <div className="absolute top-3 left-3 bg-white/95 border border-zinc-200 px-3 py-1.5 rounded-xl flex items-center space-x-2 shadow-sm backdrop-blur-md z-10 transition">
        <Navigation className="w-4 h-4 text-amber-500 animate-pulse rotate-45" />
        <div>
          <span className="text-[9px] font-mono font-bold text-zinc-800 uppercase tracking-wider block">
            {mapMode === "standard" ? "TOKYO VECTOR MAP GRID" : mapMode === "satellite" ? "MANHATTAN SATELLITE RADAR" : "HYBRID SUBURBAN CARRIER FEED"}
          </span>
          <span className="text-[8px] text-zinc-500 font-mono block">SIGNAL MAPPED VIA CELLULAR TRILATERATION</span>
        </div>
      </div>

      {/* Map Mode selector buttons */}
      <div className="absolute top-3 right-3 bg-white/95 border border-zinc-200 p-1 rounded-xl flex items-center space-x-0.5 shadow-sm backdrop-blur-md z-10">
        <button
          onClick={() => setMapMode("standard")}
          className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-lg transition-all font-mono ${
            mapMode === "standard"
              ? "bg-amber-500 text-zinc-950 shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          Grid
        </button>
        <button
          onClick={() => setMapMode("satellite")}
          className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-lg transition-all font-mono ${
            mapMode === "satellite"
              ? "bg-amber-500 text-zinc-950 shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          Satellite
        </button>
        <button
          onClick={() => setMapMode("hybrid")}
          className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-lg transition-all font-mono ${
            mapMode === "hybrid"
              ? "bg-amber-500 text-zinc-950 shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          Hybrid
        </button>
      </div>

      {/* Main Canvas view */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover cursor-crosshair"
      />

      {/* Zoom Overlay Controls bottom right */}
      <div className="absolute bottom-3 right-3 flex items-center space-x-1.5 z-10">
        <button
          onClick={handleZoomIn}
          className="p-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 hover:text-amber-500 rounded-lg shadow-sm transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 hover:text-amber-500 rounded-lg shadow-sm transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute bottom-3 left-3 bg-white/90 border border-zinc-200 px-2.5 py-1 rounded-lg text-[9px] font-mono text-zinc-600 shadow-sm">
        SCALE: 1 cm ≈ {Math.round(40 / zoom)} meters
      </div>
    </div>
  );
}
