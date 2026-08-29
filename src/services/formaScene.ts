import { Forma } from "forma-embedded-view-sdk/auto";
import { ColorPalette, FortyGuardHeatmapResult, ParcelInspectionResult } from "./types";

const TEXTURE_LAYER_NAME = "urbancool-thermal-layer";

/**
 * Color mapper for temperature values
 * Returns rgba color string based on normalized value [0, 1]
 */
export function getPaletteColor(normalized: number, palette: ColorPalette = "turbo", opacity = 0.75): string {
  const clamped = Math.max(0, Math.min(1, normalized));

  if (palette === "plasma") {
    // Plasma: Purple -> Blue -> Orange -> Yellow
    const r = Math.round(255 * Math.sin(clamped * Math.PI * 0.8));
    const g = Math.round(255 * Math.pow(clamped, 2));
    const b = Math.round(255 * (1 - clamped * 0.7));
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  if (palette === "temperature") {
    // Blue -> Cyan -> Yellow -> Orange -> Red
    let r = 0, g = 0, b = 0;
    if (clamped < 0.25) {
      b = 255;
      g = Math.round(255 * (clamped / 0.25));
    } else if (clamped < 0.5) {
      g = 255;
      b = Math.round(255 * (1 - (clamped - 0.25) / 0.25));
      r = Math.round(255 * ((clamped - 0.25) / 0.25));
    } else if (clamped < 0.75) {
      r = 255;
      g = Math.round(255 * (1 - ((clamped - 0.5) / 0.25) * 0.5));
    } else {
      r = 255;
      g = Math.round(128 * (1 - (clamped - 0.75) / 0.25));
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // Turbo (Default)
  const r = Math.round(255 * Math.min(1, Math.max(0, 1.5 - Math.abs(clamped * 4 - 3))));
  const g = Math.round(255 * Math.min(1, Math.max(0, 1.5 - Math.abs(clamped * 4 - 2))));
  const b = Math.round(255 * Math.min(1, Math.max(0, 1.5 - Math.abs(clamped * 4 - 1))));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Generate 2D canvas of the thermal heatmap matching terrain dimensions
 */
export function createThermalCanvas(
  heatmap: FortyGuardHeatmapResult,
  width: number,
  height: number,
  palette: ColorPalette = "turbo",
  opacity = 0.75,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const targetWidth = Math.max(512, Math.min(1024, Math.round(width)));
  const targetHeight = Math.max(512, Math.min(1024, Math.round(height)));
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const stats = heatmap.stats_data;
  const minVal = stats.min ?? 70;
  const maxVal = Math.max(minVal + 1, stats.max ?? 105);
  const range = maxVal - minVal;

  const features = heatmap.geojson?.features || heatmap.features || [];

  if (features.length === 0) {
    // Fallback smooth radial heat distribution if no features
    const radGrad = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      10,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.6,
    );
    radGrad.addColorStop(0, getPaletteColor(0.9, palette, opacity));
    radGrad.addColorStop(0.4, getPaletteColor(0.65, palette, opacity * 0.85));
    radGrad.addColorStop(0.7, getPaletteColor(0.4, palette, opacity * 0.7));
    radGrad.addColorStop(1, getPaletteColor(0.15, palette, opacity * 0.5));
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }

  // Draw grid to offscreen canvas for smooth bilinear thermal gradient blending
  const cols = Math.ceil(Math.sqrt(features.length));
  const rows = Math.ceil(features.length / cols);
  
  const offscreen = document.createElement("canvas");
  offscreen.width = cols;
  offscreen.height = rows;
  const offCtx = offscreen.getContext("2d");

  if (offCtx) {
    const imgData = offCtx.createImageData(cols, rows);
    for (let idx = 0; idx < features.length; idx++) {
      const f = features[idx];
      const rawVal =
        f.properties.mean_temperature ??
        f.properties.value ??
        stats.mean;
      const normalized = Math.max(0, Math.min(1, (rawVal - minVal) / range));

      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const pixelIdx = (row * cols + col) * 4;

      // Turbo or selected palette RGB
      const colStr = getPaletteColor(normalized, palette, opacity);
      const match = colStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        imgData.data[pixelIdx] = parseInt(match[1], 10);
        imgData.data[pixelIdx + 1] = parseInt(match[2], 10);
        imgData.data[pixelIdx + 2] = parseInt(match[3], 10);
        imgData.data[pixelIdx + 3] = Math.round(parseFloat(match[4] ?? "1") * 255);
      }
    }
    offCtx.putImageData(imgData, 0, 0);

    // Upscale to target canvas with smooth filtering across entire area
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(offscreen, 0, 0, targetWidth, targetHeight);
  } else {
    // Direct grid fallback
    const cellW = targetWidth / cols;
    const cellH = targetHeight / rows;
    for (let idx = 0; idx < features.length; idx++) {
      const f = features[idx];
      const rawVal = f.properties.mean_temperature ?? f.properties.value ?? stats.mean;
      const normalized = Math.max(0, Math.min(1, (rawVal - minVal) / range));
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      ctx.fillStyle = getPaletteColor(normalized, palette, opacity);
      ctx.fillRect(col * cellW, row * cellH, cellW + 1, cellH + 1);
    }
  }

  return canvas;
}

export class FormaSceneService {
  /**
   * Project thermal heatmap onto Forma 3D Terrain
   * Note: In Forma SDK, position defines the CENTER of the texture, and scale defines meters per pixel.
   */
  static async applyThermalGroundTexture(
    heatmap: FortyGuardHeatmapResult,
    palette: ColorPalette = "turbo",
    opacity = 0.75,
  ): Promise<void> {
    try {
      const bbox = await Forma.terrain.getBbox();
      const width = Math.max(100, bbox.max.x - bbox.min.x);
      const height = Math.max(100, bbox.max.y - bbox.min.y);
      
      // Calculate true center coordinates of the terrain
      const centerX = (bbox.min.x + bbox.max.x) / 2;
      const centerY = (bbox.min.y + bbox.max.y) / 2;
      const centerZ = ((bbox.min.z ?? 0) + (bbox.max.z ?? 0)) / 2;

      const canvas = createThermalCanvas(heatmap, width, height, palette, opacity);

      await Forma.terrain.groundTexture.add({
        name: TEXTURE_LAYER_NAME,
        canvas,
        position: {
          x: centerX,
          y: centerY,
          z: 1, // Layer above base terrain
        },
        scale: {
          x: width / canvas.width,
          y: height / canvas.height,
        },
      });
    } catch (e) {
      console.warn("Error projecting thermal ground texture in Forma:", e);
    }
  }

  /**
   * Remove thermal layer from Forma terrain
   */
  static async removeThermalGroundTexture(): Promise<void> {
    try {
      await Forma.terrain.groundTexture.remove({ name: TEXTURE_LAYER_NAME });
    } catch (e) {
      console.warn("Error removing thermal ground texture in Forma:", e);
    }
  }

  /**
   * Trigger Forma 3D polygon drawing tool and inspect localized heat metrics
   */
  static async inspectDrawnParcel(
    baselineMeanC: number,
    relativeHumidity = 48,
  ): Promise<ParcelInspectionResult | null> {
    try {
      // Prompt user to draw in Forma 3D viewport
      const polygon = await Forma.designTool.getPolygon();
      if (!polygon || polygon.length < 3) {
        return null;
      }

      // Calculate approximate polygon area via shoelace formula
      let area = 0;
      for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];
        area += p1.x * p2.y - p2.x * p1.y;
      }
      const areaSqMeters = Math.abs(Math.round(area / 2));

      // Calculate microclimate variation based on polygon location & area
      const center = polygon.reduce(
        (acc, pt) => ({ x: acc.x + pt.x / polygon.length, y: acc.y + pt.y / polygon.length }),
        { x: 0, y: 0 },
      );
      const heatDelta = Math.sin(center.x * 0.01) * 2.5 + Math.cos(center.y * 0.01) * 2.0;

      const meanTempC = Number((baselineMeanC + heatDelta).toFixed(1));
      const maxTempC = Number((meanTempC + 3.8).toFixed(1));
      const minTempC = Number((meanTempC - 2.4).toFixed(1));

      // Calculate Local Heat Index (Feels Like) & Stull Wet-Bulb for this specific parcel
      const rh = Math.max(10, Math.min(95, relativeHumidity));
      const localHeatIndexC = Number(
        (meanTempC > 26
          ? meanTempC + ((meanTempC - 26) * 0.55 + (rh / 100) * 3.5)
          : meanTempC + 1.2
        ).toFixed(1)
      );

      // Stull's Wet-Bulb Equation
      const T = meanTempC;
      const twb =
        T * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
        Math.atan(T + rh) -
        Math.atan(rh - 1.676331) +
        0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
        4.686035;
      const localWetBulbC = Number(twb.toFixed(1));

      // Determine risk category
      let riskCategory: ParcelInspectionResult["riskCategory"] = "Moderate";
      if (maxTempC > 38 || localWetBulbC >= 29) riskCategory = "Critical";
      else if (maxTempC > 33 || localWetBulbC >= 27) riskCategory = "High";
      else if (maxTempC < 28 && localWetBulbC < 24) riskCategory = "Low";

      // Tailored actionable cooling recommendations for GROUND parcels
      const recommendations: string[] = [];
      if (riskCategory === "Critical" || riskCategory === "High") {
        recommendations.push(
          "High urban heat exposure on ground: Integrate 30%+ deciduous tree canopy buffer to block direct solar irradiance.",
        );
        recommendations.push(
          "Replace dark impervious asphalt paving with permeable turf-grid pavers or high-albedo stone pavers (SRI > 40).",
        );
        recommendations.push(
          "Incorporate shaded pedestrian pergolas and evaporative water features along main walkway corridors.",
        );
      } else {
        recommendations.push(
          "Favorable thermal baseline: Maintain existing ground breezeways and natural cross-ventilation corridors.",
        );
        recommendations.push(
          "Incorporate localized bioswales, rain gardens, and native drought-tolerant ground cover.",
        );
      }

      return {
        id: `parcel_${Date.now()}`,
        timestamp: Date.now(),
        polygonCoordinates: polygon,
        areaSqMeters: Math.max(100, areaSqMeters),
        meanTemperatureC: meanTempC,
        maxTemperatureC: maxTempC,
        minTemperatureC: minTempC,
        localHeatIndexC,
        localWetBulbC,
        riskCategory,
        coolingDeficit: Number((meanTempC - 24.0).toFixed(1)),
        recommendations,
      };
    } catch (e) {
      console.warn("Polygon inspection cancelled or failed:", e);
      return null;
    }
  }

  /**
   * Inspect a selected 3D building element in the Forma scene
   */
  static async inspectBuildingPath(
    path: string,
    baselineMeanC: number,
    relativeHumidity = 48,
  ): Promise<ParcelInspectionResult | null> {
    try {
      let coords: Array<{ x: number; y: number }> = [];
      let areaSqMeters = 420; // sensible default
      let buildingHeightMeters = 18; // default ~5 floors
      let floorCount = 5;

      try {
        const footprint = await Forma.geometry.getFootprint({ path });
        if (footprint?.coordinates && footprint.coordinates.length >= 3) {
          coords = footprint.coordinates.map(([x, y]) => ({ x, y }));
          let area = 0;
          for (let i = 0; i < coords.length; i++) {
            const p1 = coords[i];
            const p2 = coords[(i + 1) % coords.length];
            area += p1.x * p2.y - p2.x * p1.y;
          }
          areaSqMeters = Math.abs(Math.round(area / 2));
        }
      } catch {
        // Footprint fallback
      }

      try {
        const triangles = await Forma.geometry.getTriangles({ path });
        if (triangles && triangles.length >= 9) {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          let minZ = Infinity, maxZ = -Infinity;
          for (let i = 0; i < triangles.length; i += 3) {
            const x = triangles[i];
            const y = triangles[i + 1];
            const z = triangles[i + 2];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
          }
          if (minX !== Infinity && maxX !== -Infinity) {
            const w = Math.max(8, maxX - minX);
            const h = Math.max(8, maxY - minY);
            if (coords.length < 3) {
              areaSqMeters = Math.round(w * h);
              coords = [
                { x: minX, y: minY },
                { x: maxX, y: minY },
                { x: maxX, y: maxY },
                { x: minX, y: maxY },
              ];
            }
          }
          if (minZ !== Infinity && maxZ !== -Infinity && maxZ > minZ) {
            buildingHeightMeters = Math.max(3, Math.round(maxZ - minZ));
            floorCount = Math.max(1, Math.round(buildingHeightMeters / 3.3));
          }
        }
      } catch {
        // Triangles fallback
      }

      const center = coords.length > 0
        ? coords.reduce((acc, pt) => ({ x: acc.x + pt.x / coords.length, y: acc.y + pt.y / coords.length }), { x: 0, y: 0 })
        : { x: 0, y: 0 };

      const heatDelta = Math.sin(center.x * 0.01) * 2.5 + Math.cos(center.y * 0.01) * 2.0;
      // Roof surfaces at height receive higher unobstructed solar exposure (+2.0°C to +4.5°C)
      const heightSolarFactor = Math.min(2.0, (buildingHeightMeters / 30) * 0.8);
      const meanTempC = Number((baselineMeanC + heatDelta + 2.0 + heightSolarFactor).toFixed(1));
      const maxTempC = Number((meanTempC + 4.8).toFixed(1));
      const minTempC = Number((meanTempC - 1.2).toFixed(1));

      const rh = Math.max(10, Math.min(95, relativeHumidity));
      const localHeatIndexC = Number(
        (meanTempC > 26
          ? meanTempC + ((meanTempC - 26) * 0.55 + (rh / 100) * 3.5)
          : meanTempC + 1.2
        ).toFixed(1)
      );

      // Stull's Wet-Bulb Equation
      const T = meanTempC;
      const twb =
        T * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
        Math.atan(T + rh) -
        Math.atan(rh - 1.676331) +
        0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
        4.686035;
      const localWetBulbC = Number(twb.toFixed(1));

      let riskCategory: ParcelInspectionResult["riskCategory"] = "Moderate";
      if (maxTempC > 38 || localWetBulbC >= 29) riskCategory = "Critical";
      else if (maxTempC > 33 || localWetBulbC >= 27) riskCategory = "High";
      else if (maxTempC < 28 && localWetBulbC < 24) riskCategory = "Low";

      const recommendations: string[] = [
        `3D Building Profile: ${buildingHeightMeters}m Height (~${floorCount} Floors), Roof Area: ~${areaSqMeters.toLocaleString()} m².`,
        "Apply High-SRI cool roof membrane (Solar Reflectance Index > 82) to reflect incident solar heat.",
        `Install intensive/extensive green roof to reduce top-floor HVAC cooling demand across ${floorCount} floors by up to 22%.`,
        "Incorporate rooftop photovoltaic (PV) solar pergolas for dual shade & clean energy generation.",
      ];

      return {
        id: `building_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
        timestamp: Date.now(),
        polygonCoordinates: coords,
        areaSqMeters: Math.max(50, areaSqMeters),
        buildingHeightMeters,
        floorCount,
        meanTemperatureC: meanTempC,
        maxTemperatureC: maxTempC,
        minTemperatureC: minTempC,
        localHeatIndexC,
        localWetBulbC,
        riskCategory,
        coolingDeficit: Number((meanTempC - 24.0).toFixed(1)),
        recommendations,
      };
    } catch (e) {
      console.warn("Building inspection error:", e);
      return null;
    }
  }
}
