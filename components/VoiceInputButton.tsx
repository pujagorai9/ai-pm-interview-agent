"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// Web Speech API types
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
}

interface ISpeechRecognitionEvent {
  results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionResultList {
  length: number;
  [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionResult {
  [index: number]: { transcript: string };
}

type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => ISpeechRecognition;
  webkitSpeechRecognition?: new () => ISpeechRecognition;
};

export default function VoiceInputButton({ onTranscript, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState("");
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      if (draft) onTranscript(draft);
      return;
    }

    const win = window as WindowWithSpeech;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: ISpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setDraft(transcript);
    };

    rec.onend = () => {
      setListening(false);
      if (draft) {
        onTranscript(draft);
        setDraft("");
      }
    };

    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    setDraft("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        className={`btn ${listening ? "btn-danger" : "btn-outline"}`}
        onClick={toggle}
        disabled={disabled}
        title={listening ? "Stop recording" : "Start voice input"}
      >
        {listening ? "⏹ Stop Recording" : "🎙 Speak Answer"}
      </button>
      {draft && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "4px 8px", background: "var(--bg)", borderRadius: 4 }}>
          {draft}
        </div>
      )}
    </div>
  );
}
