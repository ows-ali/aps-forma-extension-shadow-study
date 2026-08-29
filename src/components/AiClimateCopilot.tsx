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
  const meanTempC = Number((isRawFahrenheit ? fahrenheitToCelsius(rawMean) : rawMean).toFixed(1));
  const rawMax = heatmap.stats_data.max ?? (rawMean + 12);
  const maxTempC = Number((isRawFahrenheit ? fahrenheitToCelsius(rawMax) : rawMax).toFixed(1));
  const rawMin = heatmap.stats_data.min ?? (rawMean - 8);
  const minTempC = Number((isRawFahrenheit ? fahrenheitToCelsius(rawMin) : rawMin).toFixed(1));
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
      text: `Hello! I am your FortyGuard Climate Copilot. I'm connected to your active Forma design canvas and FortyGuard site data (Mean: ${meanTempC}°C, Coolest: ${minTempC}°C, Peak: ${maxTempC}°C, Wet-Bulb: ${wetBulbC}°C, Solar: ${solarIrr} W/m²). How can I help optimize your urban cooling?`,
      timestamp: "Just now",
    },
  ]);

  const [testStatus, setTestStatus] = useState<string | null>(null);

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

  const handleResetToDefault = (reAnswerPrompt?: string) => {
    setApiKey("");
    localStorage.removeItem(LLM_KEY_STORAGE);
    setTestStatus("🌿 Switched to built-in FortyGuard intelligence mode.");
    if (reAnswerPrompt) {
      setTimeout(() => {
        const aiMsg: ChatMessage = {
          id: `ai_${Date.now()}`,
          sender: "ai",
          text: generateBuiltinResponse(reAnswerPrompt),
          timestamp: "Just now",
        };
        setMessages((prev) => [...prev, aiMsg]);
      }, 100);
    }
  };

  const handleTestKey = async () => {
    const key = apiKey.trim() || localStorage.getItem(LLM_KEY_STORAGE)?.trim() || "";
    if (!key) {
      setTestStatus("ℹ️ No key entered. Using built-in FortyGuard climate intelligence.");
      return;
    }
    setTestStatus("Testing key with provider... ⏳");
    try {
      if (provider === "gemini") {
        const resp = await fetch(
          `/api/gemini/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: "Hello" }] }],
            }),
          },
        );
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${resp.status}`);
        }
        setTestStatus("✅ Gemini API Key is valid and connected!");
        handleSaveSettings();
      } else if (provider === "openai") {
        const resp = await fetch("/api/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "Hi" }],
            max_tokens: 10,
          }),
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${resp.status}`);
        }
        setTestStatus("✅ OpenAI API Key is valid and connected!");
        handleSaveSettings();
      } else if (provider === "groq") {
        // 1. Discover live available models for this specific Groq key
        let activeModels = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "gemma2-9b-it"];
        try {
          const modelsResp = await fetch("/api/groq/v1/models", {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (modelsResp.ok) {
            const modelsJson = await modelsResp.json();
            const list: string[] = (modelsJson?.data || [])
              .map((m: { id: string }) => m.id)
              .filter(
                (id: string) =>
                  !id.includes("whisper") &&
                  !id.includes("guard") &&
                  !id.includes("embed") &&
                  !id.includes("vision"),
              );
            if (list.length > 0) {
              activeModels = list;
            }
          }
        } catch {
          // fallback to defaults
        }

        let lastErr = "";
        let successModel = "";

        for (const model of activeModels) {
          try {
            const resp = await fetch("/api/groq/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({
                model,
                messages: [{ role: "user", content: "Hi" }],
                max_tokens: 10,
              }),
            });

            if (resp.ok) {
              successModel = model;
              localStorage.setItem("groq_active_model", model);
              break;
            } else {
              const errData = await resp.json().catch(() => ({}));
              lastErr = errData?.error?.message || `HTTP ${resp.status}`;
            }
          } catch (e) {
            lastErr = e instanceof Error ? e.message : "Connection error";
          }
        }

        if (successModel) {
          setTestStatus(`✅ Groq Connected! (Active Model: ${successModel})`);
          handleSaveSettings();
        } else {
          throw new Error(lastErr || "No accessible Groq chat models found for this key.");
        }
      }
    } catch (err) {
      setTestStatus(`❌ Invalid ${provider.toUpperCase()} Key: ${err instanceof Error ? err.message : "Error"}`);
    }
  };

  const quickPrompts = [
    "🌴 Suggest 3 cooling interventions for this site",
    "❄️ What is the coolest zone on the map?",
    "🔥 Where is the hottest thermal hotspot?",
    "💧 Evaluate wet-bulb worker safety limits",
  ];

  // Smart built-in response generator (instant fallback when no live LLM key)
  const generateBuiltinResponse = (query: string): string => {
    const q = query.toLowerCase();

    if (q.includes("coolest") || q.includes("coldest") || q.includes("lowest") || q.includes("minimum")) {
      return `The coolest part of this site is currently **${minTempC}°C** (compared to the site mean of ${meanTempC}°C and peak of ${maxTempC}°C):
- **Location**: Concentrated along **northern building shadow corridors** and **vegetated tree canopy zones**.
- **Reason**: Solar shading from building massings combined with natural evaporative cooling from vegetative ground cover.
- **Design Strategy**: Connect these natural cool pockets with shaded pedestrian pathways to create continuous low-heat walking corridors.`;
    }

    if (q.includes("hottest") || q.includes("warmest") || q.includes("highest") || q.includes("peak") || q.includes("hotspot")) {
      return `The hottest hotspot on this site reaches **${maxTempC}°C** (${(maxTempC - meanTempC).toFixed(1)}°C above the site mean):
- **Location**: Concentrated on **unshaded southern/western dark roofs** and **impervious asphalt surfaces**.
- **Reason**: Continuous unmitigated incident solar irradiance (${solarIrr} W/m²) and high heat capacity of dark building materials.
- **Priority Fix**: Apply High-SRI cool roof coatings (SRI > 82) and replace asphalt parking with permeable turf-grid pavers.`;
    }

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
- **Site Baseline**: ${meanTempC}°C mean temperature, ${minTempC}°C coolest sector, ${maxTempC}°C peak surface temp, ${solarIrr} W/m² solar irradiance, AQI ${aqi}.
- **Resilience Insight**: To counteract localized thermal hotspots in your current Forma model, prioritize reflective building envelopes (cool roofs), shaded pedestrian courtyards, and native vegetative green buffers.`;
  };

  // Live LLM caller (Gemini, OpenAI, or Groq)
  const callLiveLlm = async (userQuery: string): Promise<string> => {
    const key = apiKey.trim() || localStorage.getItem(LLM_KEY_STORAGE)?.trim() || "";
    if (!key) {
      return generateBuiltinResponse(userQuery);
    }

    const systemPrompt = `You are the FortyGuard AI Climate Copilot integrated inside Autodesk Forma. You are an expert urban microclimatologist and sustainable architect.
CURRENT FORTYGUARD SITE THERMAL METRICS & SPATIAL BREAKDOWN:
- Coolest Sector (Min Surface Temp): ${minTempC}°C (located in northern building shadows, vegetated courtyards, and tree canopy zones)
- Hottest Sector (Peak Surface Temp): ${maxTempC}°C (located in unshaded southern/western asphalt lots and dark flat roofs)
- Mean Site Baseline: ${meanTempC}°C
- Thermal Spread: ${(maxTempC - minTempC).toFixed(1)}°C delta across the site
- 2m Pedestrian Wet-Bulb: ${wetBulbC}°C
- Solar Irradiance: ${solarIrr} W/m²
- Air Quality Index (AQI): ${aqi}

Answer the user's architectural and climate mitigation question directly, concisely, with specific temperatures and spatial zones. Keep response under 150 words.`;

    try {
      if (provider === "gemini") {
        const resp = await fetch(
          `/api/gemini/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
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
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          const msg = errData?.error?.message || `HTTP ${resp.status} (${resp.statusText})`;
          throw new Error(msg);
        }
        const data = await resp.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || generateBuiltinResponse(userQuery);
      }

      if (provider === "openai") {
        const resp = await fetch("/api/openai/v1/chat/completions", {
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
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          const msg = errData?.error?.message || `HTTP ${resp.status} (${resp.statusText})`;
          throw new Error(msg);
        }
        const data = await resp.json();
        return data?.choices?.[0]?.message?.content || generateBuiltinResponse(userQuery);
      }

      if (provider === "groq") {
        const savedModel = localStorage.getItem("groq_active_model");
        const candidateModels = savedModel
          ? [savedModel, "llama-3.1-8b-instant", "llama-3.3-70b-versatile", "gemma2-9b-it"]
          : ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "gemma2-9b-it"];

        let lastErr = "";

        for (const model of candidateModels) {
          try {
            const resp = await fetch("/api/groq/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userQuery },
                ],
                max_tokens: 300,
              }),
            });

            if (resp.ok) {
              const data = await resp.json();
              localStorage.setItem("groq_active_model", model);
              return data?.choices?.[0]?.message?.content || generateBuiltinResponse(userQuery);
            } else {
              const errData = await resp.json().catch(() => ({}));
              lastErr = errData?.error?.message || `HTTP ${resp.status} (${resp.statusText})`;
            }
          } catch (e) {
            lastErr = e instanceof Error ? e.message : "Connection error";
          }
        }

        throw new Error(lastErr || "Groq models unavailable");
      }

      return generateBuiltinResponse(userQuery);
    } catch (e) {
      console.warn("Live LLM failed:", e);
      const errMsg = e instanceof Error ? e.message : "Authentication/Connection Error";
      return `❌ ${provider.toUpperCase()} API Error: ${errMsg}\n\n👉 Click below to switch to the fast built-in FortyGuard climate engine:`;
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
          <div class="drawer-header-row">
            <div class="drawer-title">🔑 Live LLM Connection (Stored in Browser)</div>
            {hasLiveKey && (
              <button
                type="button"
                class="use-default-btn"
                onClick={() => handleResetToDefault()}
                title="Switch back to Built-in Default FortyGuard Engine"
              >
                🌿 Reset to Default Mode
              </button>
            )}
          </div>

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
              onInput={(e) => {
                setApiKey((e.target as HTMLInputElement).value);
                setTestStatus(null);
              }}
              class="key-text-input"
            />
            <button type="button" class="key-save-btn" onClick={handleSaveSettings}>
              {isSaved ? "✓ Saved" : "Save"}
            </button>
            <button type="button" class="key-test-btn" onClick={handleTestKey}>
              Test Key
            </button>
          </div>
          {testStatus && (
            <div
              class={`drawer-status-msg ${
                testStatus.startsWith("✅")
                  ? "status-success"
                  : testStatus.startsWith("❌")
                  ? "status-error"
                  : "status-info"
              }`}
            >
              {testStatus}
            </div>
          )}
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
        {messages.map((m, idx) => (
          <div key={m.id} class={`chat-msg ${m.sender === "ai" ? "msg-ai" : "msg-user"}`}>
            <div class="msg-bubble">
              <div class="msg-sender">{m.sender === "ai" ? "🌿 Climate AI" : "You"}</div>
              <div class="msg-text">{m.text}</div>
              {/* If AI message is an error, show instant 1-click fallback button */}
              {m.sender === "ai" && m.text.startsWith("❌") && (
                <button
                  type="button"
                  class="chat-fallback-btn"
                  onClick={() => {
                    const prevUserMsg = messages[idx - 1]?.text;
                    handleResetToDefault(prevUserMsg);
                  }}
                >
                  🌿 Switch to Default Built-in Mode & Answer
                </button>
              )}
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
