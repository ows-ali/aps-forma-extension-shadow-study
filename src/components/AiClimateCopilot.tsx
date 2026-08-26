import { useState } from "preact/hooks";
import { FortyGuardEnvParamsResult, FortyGuardHeatmapResult } from "../services/types";
import { fahrenheitToCelsius } from "../services/mockData";

interface AiClimateCopilotProps {
  heatmap: FortyGuardHeatmapResult;
  envParams: FortyGuardEnvParamsResult;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

export default function AiClimateCopilot({ heatmap, envParams }: AiClimateCopilotProps) {
  const rawMean = heatmap.stats_data.mean ?? 85;
  const isRawFahrenheit = heatmap.stats_data.units !== "celsius";
  const meanTempC = isRawFahrenheit ? fahrenheitToCelsius(rawMean) : rawMean;
  const wetBulbC = envParams.wet_bulb_temperature_celsius ?? 24.5;
  const solarIrr = envParams.solar_irradiance ?? 850;
  const aqi = envParams["air_quality:idx"] ?? 42;

  const [inputQuery, setInputQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_1",
      sender: "ai",
      text: `Hello! I am your AI Climate Copilot. I'm connected to your active Forma design scene and FortyGuard thermal metrics (Site Mean: ${meanTempC}°C, Wet-Bulb: ${wetBulbC}°C, Solar: ${solarIrr} W/m²). How can I help optimize your urban resilience?`,
      timestamp: "Just now",
    },
  ]);

  const quickPrompts = [
    "🌴 Suggest 3 cooling interventions for this site",
    "☀️ How does solar irradiance impact south facades?",
    "💧 Evaluate wet-bulb worker safety limits",
    "🏢 Recommend optimal building massing for heat reduction",
  ];

  const generateAiResponse = (query: string): string => {
    const q = query.toLowerCase();

    if (q.includes("cooling") || q.includes("intervention") || q.includes("reduce heat")) {
      return `Based on FortyGuard's current thermal scan (${meanTempC}°C ambient, ${solarIrr} W/m² solar load), here are 3 high-impact interventions:
1. **Targeted Tree Canopy Buffer**: Planting high-transpiration deciduous trees along western & southern exposures can reduce ambient surface heat by 3.2°C to 5.5°C.
2. **High-Albedo Cool Roofs**: Specifying roofing membranes with Solar Reflectance Index (SRI) > 82 will mitigate peak heat accumulation on upper residential floors.
3. **Permeable Ground Pavements**: Replacing impervious asphalt parking zones with permeable turf-grid pavers to improve evaporative cooling.`;
    }

    if (q.includes("solar") || q.includes("facade") || q.includes("sun")) {
      return `At ${solarIrr} W/m² incident solar irradiance, unshaded vertical facades absorb substantial thermal load. 
- **Recommendation**: Integrate dynamic exterior brise-soleil or horizontal overhangs calibrated to Forma's summer sun angles to block direct rays while admitting winter daylight.`;
    }

    if (q.includes("wet-bulb") || q.includes("safety") || q.includes("worker") || q.includes("health")) {
      const status = wetBulbC < 27 ? "within safe limits" : "approaching caution thresholds";
      return `FortyGuard Wet-Bulb reading for this site is **${wetBulbC}°C**, which is currently **${status}** (OSHA heat danger begins > 28°C). 
- For outdoor residential courtyards, ensure continuous shaded pedestrian walkways and integrate evaporative water features or misting pergolas.`;
    }

    if (q.includes("orientation") || q.includes("massing") || q.includes("compare")) {
      return `For this site's climate profile (${meanTempC}°C baseline), orienting long building facades along the East-West axis minimizes direct low-angle solar exposure on eastern/western walls. 
- Creating open ground-level breezeways aligned with prevailing summer winds will enhance natural air circulation and lower localized temperatures by ~2°C.`;
    }

    return `Analyzing FortyGuard microclimate layers for your query...
- **Site Baseline**: ${meanTempC}°C mean temperature, ${solarIrr} W/m² solar irradiance, AQI ${aqi}.
- **Resilience Insight**: To counteract localized thermal hotspots in your current Forma model, prioritize reflective building envelopes (cool roofs), shaded pedestrian courtyards, and native vegetative green buffers.`;
  };

  const handleSend = (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text,
      timestamp: "Just now",
    };

    const aiMsg: ChatMessage = {
      id: `ai_${Date.now() + 1}`,
      sender: "ai",
      text: generateAiResponse(text),
      timestamp: "Just now",
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInputQuery("");
  };

  return (
    <div class="ai-copilot-card">
      <div class="ai-header">
        <div class="ai-title">
          <span>🤖</span> AI Climate Copilot
        </div>
        <span class="ai-badge">FortyGuard Context-Aware</span>
      </div>

      {/* Quick Prompts */}
      <div class="quick-prompts-container">
        {quickPrompts.map((p, i) => (
          <button
            key={i}
            type="button"
            class="prompt-chip"
            onClick={() => handleSend(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      <div class="chat-messages-container">
        {messages.map((m) => (
          <div key={m.id} class={`chat-msg ${m.sender === "ai" ? "msg-ai" : "msg-user"}`}>
            <div class="msg-bubble">
              <div class="msg-sender">{m.sender === "ai" ? "🌿 Climate AI" : "You"}</div>
              <div class="msg-text">{m.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chat Input */}
      <form
        class="chat-input-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          type="text"
          placeholder="Ask a design, heat, or cooling question..."
          value={inputQuery}
          onInput={(e) => setInputQuery((e.target as HTMLInputElement).value)}
          class="chat-text-input"
        />
        <button type="submit" class="chat-send-btn" disabled={!inputQuery.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
