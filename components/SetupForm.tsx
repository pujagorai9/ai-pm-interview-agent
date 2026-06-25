"use client";
import { useState, useRef } from "react";
import { InterviewStage, SessionState } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/prompts";

const STAGES: { value: InterviewStage; label: string }[] = Object.entries(STAGE_LABELS).map(
  ([value, label]) => ({ value: value as InterviewStage, label })
);

interface Props {
  onContinue: (data: Pick<SessionState, "resumeText" | "jdText" | "stage" | "targetLevel" | "importedPriorAssessment">) => void;
}

export default function SetupForm({ onContinue }: Props) {
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [stage, setStage] = useState<InterviewStage>("hm_screen");
  const [targetLevel, setTargetLevel] = useState<"PM" | "Senior PM">("Senior PM");
  const [importedPriorAssessment, setImportedPriorAssessment] = useState("");
  const [error, setError] = useState("");
  const resumeFileRef = useRef<HTMLInputElement>(null);

  function handleResumeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25000 * 3) {
      setError("Resume file is too large. Please paste text instead.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setResumeText(reader.result as string);
    reader.readAsText(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (resumeText.trim().length < 100) {
      setError("Please enter your resume text (at least 100 characters).");
      return;
    }
    if (jdText.trim().length < 100) {
      setError("Please paste the job description (at least 100 characters).");
      return;
    }
    onContinue({ resumeText: resumeText.trim(), jdText: jdText.trim(), stage, targetLevel, importedPriorAssessment: importedPriorAssessment.trim() || undefined });
  }

  return (
    <div className="container">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>AI PM Interview Agent</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Practice role-specific AI PM interview rounds and receive evidence-based feedback.
        </p>
      </div>

      {error && <div className="error-banner error"><span>⚠️</span>{error}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Resume <span className="req">*</span></label>
            <textarea
              rows={8}
              placeholder="Paste your resume text here…"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
            <div className="form-hint">
              Or upload a .txt file:{" "}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => resumeFileRef.current?.click()}>
                Upload .txt
              </button>
              <input ref={resumeFileRef} type="file" accept=".txt" style={{ display: "none" }} onChange={handleResumeFile} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Job Description <span className="req">*</span></label>
            <textarea
              rows={6}
              placeholder="Paste the target job description here…"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Interview Stage <span className="req">*</span></label>
              <select value={stage} onChange={(e) => setStage(e.target.value as InterviewStage)}>
                {STAGES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Target Level <span className="req">*</span></label>
              <select value={targetLevel} onChange={(e) => setTargetLevel(e.target.value as "PM" | "Senior PM")}>
                <option value="PM">PM</option>
                <option value="Senior PM">Senior PM</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Prior Assessment (optional)</label>
            <textarea
              rows={3}
              placeholder="Paste a previous exported assessment JSON or Markdown to give the interviewer context…"
              value={importedPriorAssessment}
              onChange={(e) => setImportedPriorAssessment(e.target.value)}
            />
            <div className="form-hint">Only used as context within this session. Not required.</div>
          </div>

          <div style={{ background: "#f0f4ff", border: "1px solid #cfe2ff", borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#084298" }}>
            🔒 This app does not save your resume, job description, transcript, or assessment to a database. Your content is held only in active browser/session memory and sent to the model to generate interview questions and feedback.
          </div>

          <button type="submit" className="btn btn-primary">
            Continue →
          </button>
        </form>
      </div>
    </div>
  );
}
