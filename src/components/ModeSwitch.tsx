import { useState } from "preact/hooks";
import { FortyGuardService, OperationMode } from "../services/fortyguardService";

interface ModeSwitchProps {
  mode: OperationMode;
  onToggleMode: (newMode: OperationMode) => void;
  notice?: string;
}

export default function ModeSwitch({ mode, onToggleMode, notice }: ModeSwitchProps) {
  const isMock = mode === "mock";
  const [showKeyDrawer, setShowKeyDrawer] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(FortyGuardService.getApiKey());
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveKey = () => {
    FortyGuardService.setApiKey(apiKeyInput);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const hasKey = Boolean(FortyGuardService.getApiKey());

  return (
    <div class="mode-switch-card">
      <div class="mode-switch-header">
        <div class="mode-title-group">
          <span class="mode-icon">{isMock ? "🛡️" : "⚡"}</span>
          <div>
            <div class="mode-label">
              {isMock ? "Demo / Mock Mode" : "Live FortyGuard API"}
            </div>
            <div class="mode-sublabel">
              {isMock
                ? "Zero API Credits Used (Cached & Procedural)"
                : "Connecting to api.fortyguard.com"}
            </div>
          </div>
        </div>

        <div class="mode-header-actions">
          <button
            type="button"
            class={`key-drawer-btn ${hasKey ? "key-configured" : ""}`}
            onClick={() => setShowKeyDrawer(!showKeyDrawer)}
            title="Configure custom FortyGuard API Key stored locally in browser"
          >
            {hasKey ? "🔑 Key Saved" : "🔑 Set Key"}
          </button>
          <button
            type="button"
            class={`mode-toggle-btn ${isMock ? "btn-mock" : "btn-live"}`}
            onClick={() => onToggleMode(isMock ? "live" : "mock")}
            title="Click to switch between Demo mode and Live FortyGuard API"
          >
            {isMock ? "Switch to Live" : "Switch to Mock"}
          </button>
        </div>
      </div>

      {/* Expandable FortyGuard API Key Input */}
      {showKeyDrawer && (
        <div class="api-key-drawer">
          <div class="key-drawer-header">
            <span>🔑 FortyGuard API Key (Stored in Browser Only)</span>
          </div>
          <div class="key-input-row">
            <input
              type="password"
              placeholder="Paste your FortyGuard API Key here..."
              value={apiKeyInput}
              onInput={(e) => setApiKeyInput((e.target as HTMLInputElement).value)}
              class="key-text-input"
            />
            <button type="button" class="key-save-btn" onClick={handleSaveKey}>
              {isSaved ? "✓ Saved" : "Save"}
            </button>
          </div>
          <div class="key-help-sub">
            Key is stored locally in your browser (never pushed to any git or server).
          </div>
        </div>
      )}

      {notice && (
        <div class={`mode-notice ${isMock ? "notice-mock" : "notice-live"}`}>
          ℹ️ {notice}
        </div>
      )}
    </div>
  );
}
