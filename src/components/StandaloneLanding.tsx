import { useState } from "preact/hooks";

export default function StandaloneLanding() {
  const [copied, setCopied] = useState(false);
  const extensionUrl = window.location.origin;

  const handleCopy = () => {
    navigator.clipboard.writeText(extensionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div class="landing-container">
      <div class="landing-card">
        {/* Header */}
        <div class="landing-header">
          <div class="landing-badge">⚡ FortyGuard × Autodesk Forma</div>
          <h1 class="landing-title">FortyForma 3D</h1>
          <p class="landing-subtitle">
            Microclimate Heat Intelligence & Thermal Digital Twin Extension
          </p>
          <div class="landing-status">
            <span class="status-dot"></span>
            <span>Extension Server Active on <strong>{window.location.host}</strong></span>
          </div>
        </div>

        {/* Step by Step Setup Box */}
        <div class="landing-setup-box">
          <h2 class="setup-title">🚀 How to Connect in Autodesk Forma</h2>
          <ol class="setup-steps">
            <li>
              Open your 3D design workspace at{" "}
              <a href="https://app.autodeskforma.eu" target="_blank" rel="noreferrer">
                app.autodeskforma.eu
              </a>
            </li>
            <li>
              Click <strong>Extensions</strong> in the sidebar &gt; <strong>+ Add Extension</strong>
            </li>
            <li>
              Paste Extension URL into Forma:
              <div class="url-copy-row">
                <code class="url-code">{extensionUrl}</code>
                <button type="button" class="copy-btn" onClick={handleCopy}>
                  {copied ? "✅ Copied!" : "📋 Copy URL"}
                </button>
              </div>
            </li>
            <li>Click <strong>Save & Open</strong> to see FortyForma inside your 3D analysis panel!</li>
          </ol>
        </div>

        {/* 3 Core Modules */}
        <div class="landing-features">
          <div class="feature-card">
            <div class="feature-icon">🌐</div>
            <div class="feature-name">Thermal Twin</div>
            <div class="feature-desc">
              3D ground heatmap projection, building roof heat inspection, and 2m OSHA wet-bulb safety.
            </div>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🌱</div>
            <div class="feature-name">Cooling Simulator</div>
            <div class="feature-desc">
              Interactive passive heat mitigation: high-albedo cool roofs, tree canopy greening, and HVAC energy savings.
            </div>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🤖</div>
            <div class="feature-name">Climate Copilot</div>
            <div class="feature-desc">
              Autonomous AI reasoning powered by Groq / Gemini / OpenAI fed by live FortyGuard spatial metrics.
            </div>
          </div>
        </div>

        {/* Actions & Links */}
        <div class="landing-actions">
          <a
            href="https://youtu.be/AXHmg-9oo78"
            target="_blank"
            rel="noreferrer"
            class="video-btn"
          >
            🎥 Watch Video Walkthrough (YouTube)
          </a>
        </div>

        {/* Footer */}
        <div class="landing-footer">
          FortyGuard Global AI Hackathon • Track 1: Resilient Cities & Infrastructure
        </div>
      </div>
    </div>
  );
}
