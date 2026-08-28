import { useState } from "preact/hooks";
import { celsiusToFahrenheit } from "../services/mockData";

interface ComparisonViewProps {
  baselineTempC: number;
  unit?: "C" | "F";
}

interface Intervention {
  id: string;
  name: string;
  category: string;
  icon: string;
  coolingDeltaC: number;
  description: string;
}

const AVAILABLE_INTERVENTIONS: Intervention[] = [
  {
    id: "cool_roofs",
    name: "High-Albedo Cool Roof (SRI > 82)",
    category: "Building Envelope",
    icon: "🏛️",
    coolingDeltaC: 2.4,
    description: "Reflective roof membrane reflects 85%+ incident solar heat",
  },
  {
    id: "tree_canopy",
    name: "30%+ Tree Canopy Shading",
    category: "Landscape & Nature",
    icon: "🌳",
    coolingDeltaC: 3.1,
    description: "Dense deciduous canopies block direct solar exposure & evapocool",
  },
  {
    id: "permeable_paving",
    name: "Permeable Turf & Grid Pavements",
    category: "Ground Materials",
    icon: "🧱",
    coolingDeltaC: 1.5,
    description: "Replaces heat-trapping asphalt with evaporative permeable pavers",
  },
  {
    id: "breezeway_orientation",
    name: "Wind Corridor & Breezeways",
    category: "Urban Massing",
    icon: "💨",
    coolingDeltaC: 1.8,
    description: "Channels natural prevailing wind to flush trapped heat canyons",
  },
];

export default function ComparisonView({
  baselineTempC,
  unit = "C",
}: ComparisonViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "cool_roofs",
    "tree_canopy",
  ]);

  const toggleIntervention = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Calculate total cooling delta
  const totalCoolingDeltaC = AVAILABLE_INTERVENTIONS.filter((i) =>
    selectedIds.includes(i.id),
  ).reduce((sum, item) => sum + item.coolingDeltaC, 0);

  const mitigatedTempC = Number((baselineTempC - totalCoolingDeltaC).toFixed(1));
  const reductionPercent = Math.min(
    100,
    Math.round((totalCoolingDeltaC / baselineTempC) * 100),
  );
  const estHvacSavings = Math.min(35, Math.round(totalCoolingDeltaC * 2.8));

  const formatTemp = (c: number) => {
    return unit === "C" ? `${c.toFixed(1)}°C` : `${celsiusToFahrenheit(c).toFixed(1)}°F`;
  };

  const formatDelta = (c: number) => {
    return unit === "C" ? `-${c.toFixed(1)}°C` : `-${(c * 1.8).toFixed(1)}°F`;
  };

  return (
    <div class="comparison-card">
      {/* Header */}
      <div class="comparison-header">
        <div class="comparison-title">
          <span>🌱</span> Cooling & Mitigation Simulator
        </div>
        <span class="badge-blue">Simulation</span>
      </div>

      <p class="comparison-desc">
        Select cooling strategies below to simulate how much heat you can reduce compared to your baseline site.
      </p>

      {/* Step 1: Side-by-Side Comparison */}
      <div class="comparison-grid">
        {/* Baseline */}
        <div class="comp-col comp-baseline">
          <div class="comp-tag tag-baseline">Baseline (Unmitigated)</div>
          <div class="comp-temp text-red">{formatTemp(baselineTempC)}</div>
          <div class="comp-sub">Standard Materials</div>
        </div>

        {/* Mitigated */}
        <div class="comp-col comp-mitigated">
          <div class="comp-tag tag-mitigated">Mitigated (Proposed)</div>
          <div class="comp-temp text-green">{formatTemp(mitigatedTempC)}</div>
          <div class="comp-sub">{selectedIds.length} Strategies Active</div>
        </div>
      </div>

      {/* Step 2: Impact Summary Banner */}
      <div class="impact-stats-banner">
        <div class="impact-stat">
          <span class="impact-stat-label">Heat Reduction</span>
          <span class="impact-stat-val text-green">
            {formatDelta(totalCoolingDeltaC)} ({reductionPercent > 0 ? `-${reductionPercent}%` : "0%"})
          </span>
        </div>
        <div class="impact-stat-divider"></div>
        <div class="impact-stat">
          <span class="impact-stat-label">Est. HVAC Energy Savings</span>
          <span class="impact-stat-val text-blue">~{estHvacSavings}%</span>
        </div>
      </div>

      {/* Step 3: Interactive Intervention Cards */}
      <div class="interventions-container">
        <div class="interventions-header-row">
          <span class="interventions-title">Click to Test Cooling Strategies:</span>
          <span class="interventions-counter">
            {selectedIds.length}/{AVAILABLE_INTERVENTIONS.length} Active
          </span>
        </div>

        <div class="interventions-list">
          {AVAILABLE_INTERVENTIONS.map((item) => {
            const isChecked = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                class={`intervention-item ${isChecked ? "item-active" : ""}`}
                onClick={() => toggleIntervention(item.id)}
              >
                <div class="item-checkbox">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
                <div class="item-body">
                  <div class="item-top">
                    <span class="item-name">
                      {item.icon} {item.name}
                    </span>
                    <span class="item-delta-tag">
                      {formatDelta(item.coolingDeltaC)}
                    </span>
                  </div>
                  <div class="item-desc">{item.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
