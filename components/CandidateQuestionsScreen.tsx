"use client";
import { useState } from "react";

interface Props {
  onSubmit: (questions: string) => void;
  onSkip: () => void;
}

export default function CandidateQuestionsScreen({ onSubmit, onSkip }: Props) {
  const [text, setText] = useState("");

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>Your Questions for the Interviewer</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>
          In a real interview, you&apos;d now have a chance to ask the interviewer questions. What would you ask? This is factored into your final assessment.
        </p>
        <div className="form-group">
          <textarea
            rows={5}
            placeholder="E.g., How does the team approach responsible AI? What does success look like in the first 90 days?…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={() => onSubmit(text.trim())}
            disabled={!text.trim()}
          >
            Submit Questions →
          </button>
          <button className="btn btn-outline" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
