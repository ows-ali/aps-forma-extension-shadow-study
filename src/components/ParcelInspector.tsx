import { useState } from "preact/hooks";
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

  const handleStartDrawing = async () => {
    setIsDrawing(true);
    try {
      const result = await FormaSceneService.inspectDrawnParcel(
        baselineMeanC,
        relativeHumidity,
      );
      if (result) {
        setInspection(result);
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
          <span>📐</span> Parcel & Building Inspector
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
          Click below and draw a polygon in the Forma 3D canvas to evaluate microclimate heat exposure for a specific building roof, courtyard, or parcel.
        </p>

        <button
          type="button"
          class={`draw-parcel-btn ${isDrawing ? "drawing-active" : ""}`}
          onClick={handleStartDrawing}
          disabled={isDrawing}
        >
          {isDrawing ? "✏️ Drawing in 3D Viewport... (Click points to finish)" : "🎯 Draw & Inspect Parcel in 3D"}
        </button>

        {inspection && (
          <div class="inspection-results">
            <div class="result-header">
              <span class="parcel-area-tag">Area: {inspection.areaSqMeters.toLocaleString()} m²</span>
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
              <div class="rec-title">🌿 Targeted Cooling Interventions:</div>
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
