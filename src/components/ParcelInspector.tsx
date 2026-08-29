import { useState, useEffect } from "preact/hooks";
import { Forma } from "forma-embedded-view-sdk/auto";
import { ParcelInspectionResult } from "../services/types";
import { FormaSceneService } from "../services/formaScene";
import { celsiusToFahrenheit } from "../services/mockData";

interface ParcelInspectorProps {
  baselineMeanC: number;
  relativeHumidity?: number;
  unit?: "C" | "F";
}

export default function ParcelInspector({
  baselineMeanC,
  relativeHumidity = 48,
  unit = "C",
}: ParcelInspectorProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [inspection, setInspection] = useState<ParcelInspectionResult | null>(null);
  const [inspectSource, setInspectSource] = useState<"building" | "draw">("draw");

  // Auto-inspect when a user clicks/selects any 3D Building in Forma
  useEffect(() => {
    let isMounted = true;
    let unsubCallback: (() => void) | undefined;

    const setupSelectionListener = async () => {
      try {
        const sub = await Forma.selection.subscribe(async ({ paths }) => {
          if (!isMounted || !paths || paths.length === 0) return;
          const path = paths[0];
          const result = await FormaSceneService.inspectBuildingPath(
            path,
            baselineMeanC,
            relativeHumidity,
          );
          if (result && isMounted) {
            setInspection(result);
            setInspectSource("building");
          }
        });
        unsubCallback = sub?.unsubscribe;
      } catch (err) {
        console.warn("Forma selection listener could not be registered:", err);
      }
    };

    setupSelectionListener();

    return () => {
      isMounted = false;
      unsubCallback?.();
    };
  }, [baselineMeanC, relativeHumidity]);

  const handleStartDrawing = async () => {
    setIsDrawing(true);
    try {
      const result = await FormaSceneService.inspectDrawnParcel(
        baselineMeanC,
        relativeHumidity,
      );
      if (result) {
        setInspection(result);
        setInspectSource("draw");
      }
    } finally {
      setIsDrawing(false);
    }
  };

  const getRiskBadgeClass = (risk: ParcelInspectionResult["riskCategory"]) => {
    switch (risk) {
      case "Critical":
        return "badge-red";
      case "High":
        return "badge-orange";
      case "Moderate":
        return "badge-yellow";
      case "Low":
        return "badge-green";
    }
  };

  const formatTemp = (c: number) => {
    return unit === "C" ? `${c.toFixed(1)}°C` : `${celsiusToFahrenheit(c).toFixed(1)}°F`;
  };

  const formatDelta = (c: number) => {
    return unit === "C" ? `-${c.toFixed(1)}°C` : `-${(c * 1.8).toFixed(1)}°F`;
  };

  // Localized Wet-Bulb Safety status
  const getWetBulbBadge = (twbC: number) => {
    if (twbC >= 29) return { label: "Extreme Danger", cls: "badge-red" };
    if (twbC >= 27) return { label: "Caution", cls: "badge-yellow" };
    return { label: "Safe", cls: "badge-green" };
  };

  return (
    <div class="parcel-card">
      <div class="parcel-header">
        <div class="parcel-title">
          <span>🏢</span> Building & Parcel Microclimate Inspector
        </div>
        {inspection && (
          <button
            type="button"
            class="parcel-clear-btn"
            onClick={() => setInspection(null)}
          >
            Clear
          </button>
        )}
      </div>

      <div class="parcel-body">
        <p class="parcel-desc">
          Click any <strong>3D Building in scene</strong> to inspect its roof heat, or draw a polygon on the ground for plazas and courtyards.
        </p>

        <button
          type="button"
          class={`draw-parcel-btn ${isDrawing ? "drawing-active" : ""}`}
          onClick={handleStartDrawing}
          disabled={isDrawing}
        >
          {isDrawing ? "✏️ Drawing in 3D Viewport... (Click points to finish)" : "🎯 Draw & Inspect Ground Polygon"}
        </button>

        {inspection && (
          <div class="inspection-results">
            <div class="result-header">
              <span class="parcel-area-tag">
                {inspectSource === "building"
                  ? `🏢 3D Building (${inspection.buildingHeightMeters ?? 18}m / ~${inspection.floorCount ?? 5} fl) • Roof: ${inspection.areaSqMeters.toLocaleString()} m²`
                  : `📐 Ground Area: ${inspection.areaSqMeters.toLocaleString()} m²`}
              </span>
              <span class={`status-badge ${getRiskBadgeClass(inspection.riskCategory)}`}>
                {inspection.riskCategory} Heat Risk
              </span>
            </div>

            {/* 4-Column Microclimate Grid */}
            <div class="result-metrics-row result-grid-4">
              <div class="sub-metric">
                <span class="sub-label">Surface Temp</span>
                <span class="sub-val">{formatTemp(inspection.meanTemperatureC)}</span>
                <span class="sub-sub-label">Peak: {formatTemp(inspection.maxTemperatureC)}</span>
              </div>
              <div class="sub-metric">
                <span class="sub-label">Local Heat Index</span>
                <span class="sub-val text-orange">{formatTemp(inspection.localHeatIndexC)}</span>
                <span class="sub-sub-label">Feels Like</span>
              </div>
              <div class="sub-metric">
                <span class="sub-label">Local Wet-Bulb</span>
                <span class="sub-val text-purple">{formatTemp(inspection.localWetBulbC)}</span>
                <span class={`sub-status-tag ${getWetBulbBadge(inspection.localWetBulbC).cls}`}>
                  {getWetBulbBadge(inspection.localWetBulbC).label}
                </span>
              </div>
              <div class="sub-metric">
                <span class="sub-label">Cooling Target</span>
                <span class="sub-val text-blue">{formatDelta(Math.max(0, inspection.coolingDeficit))}</span>
                <span class="sub-sub-label">to reach 24°C</span>
              </div>
            </div>

            <div class="recommendations-box">
              <div class="rec-title">
                {inspectSource === "building" ? "🏗️ Building & Roof Cooling Interventions:" : "🌿 Ground & Landscape Cooling Interventions:"}
              </div>
              <ul class="rec-list">
                {inspection.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
