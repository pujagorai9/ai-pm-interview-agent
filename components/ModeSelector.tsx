"use client";
import { useState } from "react";

interface Props {
  onSelect: (mode: "chat" | "voice", voicePermission: "granted" | "denied" | "unavailable" | "unknown") => void;
  onBack: () => void;
}

export default function ModeSelector({ onSelect, onBack }: Props) {
  const [requesting, setRequesting] = useState(false);
  const [permError, setPermError] = useState("");

  const speechAvailable = typeof window !== "undefined" && "SpeechRecognition" in window || "webkitSpeechRecognition" in (window ?? {});

  async function handleVoice() {
    if (!speechAvailable) {
      setPermError("Your browser does not support the Web Speech API. Using chat mode instead.");
      onSelect("chat", "unavailable");
      return;
    }
    setRequesting(true);
    setPermError("");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      onSelect("voice", "granted");
    } catch {
      setPermError("Microphone permission denied. Falling back to chat mode. Your assessment will note that voice flow could not be tested.");
      onSelect("chat", "denied");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="container">
      <h1 style={{ marginBottom: 4 }}>Choose Interview Mode</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
        How would you like to answer interview questions?
      </p>

      {permError && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          <span>⚠️</span> {permError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div
          className="card"
          style={{ cursor: "pointer", border: "2px solid var(--primary)" }}
          onClick={() => onSelect("chat", "unknown")}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>⌨️</div>
          <h2>Chat Mode</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Type your answers. Reliable on all browsers. Recommended for most users.
          </p>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); onSelect("chat", "unknown"); }}>
              Start in Chat Mode
            </button>
          </div>
        </div>

        <div
          className="card"
          style={{ cursor: speechAvailable ? "pointer" : "not-allowed", opacity: speechAvailable ? 1 : 0.6 }}
          onClick={speechAvailable ? handleVoice : undefined}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎙️</div>
          <h2>Voice Mode <span className="badge badge-yellow" style={{ fontSize: 11 }}>Beta</span></h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Speak your answers using your microphone. Requires browser mic permission. Falls back to chat if unavailable.
          </p>
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-outline"
              onClick={(e) => { e.stopPropagation(); handleVoice(); }}
              disabled={requesting || !speechAvailable}
            >
              {requesting ? "Requesting mic…" : "Start in Voice Mode"}
            </button>
          </div>
        </div>
      </div>

      <button className="btn btn-outline btn-sm" onClick={onBack}>← Back</button>
    </div>
  );
}
