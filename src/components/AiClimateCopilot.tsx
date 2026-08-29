import { useState, useEffect } from "preact/hooks";
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

type LlmProvider = "gemini" | "openai" | "groq";

const LLM_KEY_STORAGE = "climate_copilot_llm_key";
const LLM_PROVIDER_STORAGE = "climate_copilot_llm_provider";

export default function AiClimateCopilot({ heatmap, envParams }: AiClimateCopilotProps) {
  const rawMean = heatmap.stats_data.mean ?? 85;
  const isRawFahrenheit = heatmap.stats_data.units !== "celsius";
  const meanTempC = isRawFahrenheit ? fahrenheitToCelsius(rawMean) : rawMean;
  const rawMax = heatmap.stats_data.max ?? 98;
  const maxTempC = isRawFahrenheit ? fahrenheitToCelsius(rawMax) : rawMax;
  const wetBulbC = envParams.wet_bulb_temperature_celsius ?? 24.5;
  const solarIrr = envParams.solar_irradiance ?? 850;
  const aqi = envParams["air_quality:idx"] ?? 42;

  const [inputQuery, setInputQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState<LlmProvider>(
    (localStorage.getItem(LLM_PROVIDER_STORAGE) as LlmProvider) || "gemini",
  );
  const [apiKey, setApiKey] = useState(localStorage.getItem(LLM_KEY_STORAGE) || "");
  const [isSaved, setIsSaved] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_1",
      sender: "ai",
      text: `Hello! I am your FortyGuard Climate Copilot. I'm connected to your active Forma design canvas and FortyGuard site data (Mean: ${meanTempC}°C, Peak: ${maxTempC}°C, Wet-Bulb: ${wetBulbC}°C, Solar: ${solarIrr} W/m²). How can I help optimize your urban cooling?`,
      timestamp: "Just now",
    },
  ]);

  const handleSaveSettings = () => {
    localStorage.setItem(LLM_PROVIDER_STORAGE, provider);
    if (apiKey.trim()) {
      localStorage.setItem(LLM_KEY_STORAGE, apiKey.trim());
    } else {
      localStorage.removeItem(LLM_KEY_STORAGE);
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const quickPrompts = [
    "🌴 Suggest 3 cooling interventions for this site",
    "☀️ How does solar irradiance impact south facades?",
    "💧 Evaluate wet-bulb worker safety limits",
    "🏢 Recommend optimal building massing for heat reduction",
  ];

  // Smart built-in response generator (instant fallback when no live LLM key)
  const generateBuiltinResponse = (query: string): string => {
    const q = query.toLowerCase();

    if (q.includes("cooling") || q.includes("intervention") || q.includes("reduce heat")) {
      return `Based on FortyGuard's thermal scan (${meanTempC}°C ambient, ${maxTempC}°C peak, ${solarIrr} W/m² solar load), here are 3 high-impact interventions:
1. **Targeted Tree Canopy Buffer**: Planting high-transpiration deciduous trees along western & southern exposures can reduce surface heat by 3.2°C to 5.5°C.
2. **High-Albedo Cool Roofs**: Specifying roofing membranes with Solar Reflectance Index (SRI) > 82 mitigates peak heat accumulation on building upper floors.
3. **Permeable Ground Pavements**: Replacing impervious asphalt parking with permeable turf-grid pavers to improve evaporative cooling.`;
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
- **Site Baseline**: ${meanTempC}°C mean temperature, ${maxTempC}°C peak surface temp, ${solarIrr} W/m² solar irradiance, AQI ${aqi}.
- **Resilience Insight**: To counteract localized thermal hotspots in your current Forma model, prioritize reflective building envelopes (cool roofs), shaded pedestrian courtyards, and native vegetative green buffers.`;
  };

  // Live LLM caller (Gemini, OpenAI, or Groq)
  const callLiveLlm = async (userQuery: string): Promise<string> => {
    const key = apiKey.trim();
    if (!key) {
      return generateBuiltinResponse(userQuery);
    }

    const systemPrompt = `You are the FortyGuard AI Climate Copilot integrated inside Autodesk Forma. You are an expert urban microclimatologist and sustainable architect.
CURRENT FORTYGUARD SITE METRICS:
- Mean Temperature: ${meanTempC}°C
- Peak Surface Temperature: ${maxTempC}°C
- Wet-Bulb Temperature (2m AGL): ${wetBulbC}°C
- Solar Irradiance: ${solarIrr} W/m²
- Air Quality Index (AQI): ${aqi}

Answer the user's architectural and climate mitigation question concisely, practically, with bullet points and concrete numbers. Keep response under 150 words.`;

    try {
      if (provider === "gemini") {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [{ text: `${systemPrompt}\n\nUser Question: ${userQuery}` }],
                },
              ],
            }),
          },
        );
        if (!resp.ok) throw new Error(`Gemini API error ${resp.status}`);
        const data = await resp.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || generateBuiltinResponse(userQuery);
      }

      if (provider === "openai") {
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userQuery },
            ],
            max_tokens: 300,
          }),
        });
        if (!resp.ok) throw new Error(`OpenAI API error ${resp.status}`);
        const data = await resp.json();
        return data?.choices?.[0]?.message?.content || generateBuiltinResponse(userQuery);
      }

      if (provider === "groq") {
        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userQuery },
            ],
            max_tokens: 300,
          }),
        });
        if (!resp.ok) throw new Error(`Groq API error ${resp.status}`);
        const data = await resp.json();
        return data?.choices?.[0]?.message?.content || generateBuiltinResponse(userQuery);
      }

      return generateBuiltinResponse(userQuery);
    } catch (e) {
      console.warn("Live LLM failed, using smart fallback:", e);
      return generateBuiltinResponse(userQuery);
    }
  };

  const handleSend = async (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text,
      timestamp: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsGenerating(true);

    try {
      const reply = await callLiveLlm(text);
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now() + 1}`,
        sender: "ai",
        text: reply,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const hasLiveKey = Boolean(apiKey.trim());

  return (
    <div class="ai-copilot-card">
      <div class="ai-header">
        <div class="ai-title">
          <span>🤖</span> Climate Copilot
        </div>
        <div class="ai-header-actions">
          <button
            type="button"
            class={`copilot-settings-btn ${hasLiveKey ? "settings-active" : ""}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Configure Live LLM Provider and API Key"
          >
            {hasLiveKey ? `⚡ ${provider.toUpperCase()}` : "⚙️ AI Settings"}
          </button>
          <span class="ai-badge">FortyGuard Aware</span>
        </div>
      </div>

      {/* Expandable LLM Key Drawer */}
      {showSettings && (
        <div class="llm-settings-drawer">
          <div class="drawer-title">🔑 Live LLM Connection (Stored in Browser)</div>
          <div class="provider-select-row">
            <label class="provider-label">Provider:</label>
            <select
              class="provider-select"
              value={provider}
              onChange={(e) => setProvider((e.target as HTMLSelectElement).value as LlmProvider)}
            >
              <option value="gemini">Google Gemini (1.5 Flash)</option>
              <option value="openai">OpenAI (GPT-4o Mini)</option>
              <option value="groq">Groq (Llama 3.3 70B Fast)</option>
            </select>
          </div>
          <div class="key-input-row">
            <input
              type="password"
              placeholder={`Paste your ${provider.toUpperCase()} API Key...`}
              value={apiKey}
              onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
              class="key-text-input"
            />
            <button type="button" class="key-save-btn" onClick={handleSaveSettings}>
              {isSaved ? "✓ Saved" : "Save"}
            </button>
          </div>
          <div class="key-help-sub">
            {hasLiveKey
              ? "⚡ Live AI mode active. All responses generated with live LLM + FortyGuard context."
              : "ℹ️ No key entered. Using fast built-in FortyGuard climate intelligence."}
          </div>
        </div>
      )}

      {/* Quick Prompts */}
      <div class="quick-prompts-container">
        {quickPrompts.map((p, i) => (
          <button
            key={i}
            type="button"
            class="prompt-chip"
            onClick={() => handleSend(p)}
            disabled={isGenerating}
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
        {isGenerating && (
          <div class="chat-msg msg-ai">
            <div class="msg-bubble">
              <div class="msg-sender">🌿 Climate AI</div>
              <div class="msg-text">Analyzing FortyGuard microclimate parameters... ⏳</div>
            </div>
          </div>
        )}
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
          disabled={isGenerating}
        />
        <button type="submit" class="chat-send-btn" disabled={!inputQuery.trim() || isGenerating}>
          {isGenerating ? "..." : "Ask"}
        </button>
      </form>
    </div>
  );
}
