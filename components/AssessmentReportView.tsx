"use client";
import { AssessmentReport } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/prompts";
import { InterviewStage } from "@/lib/types";

const SCORE_LABEL: Record<number | string, string> = {
  1: "Strong No Hire",
  2: "No Hire",
  3: "Hire",
  4: "Strong Hire",
  "Not Assessed": "Not Assessed",
};

const RECOMMENDATION_COLOR: Record<string, string> = {
  "Strong Hire": "score-4",
  "Hire": "score-3",
  "No Hire": "score-2",
  "Strong No Hire": "score-1",
};

interface Props {
  report: AssessmentReport;
}

export default function AssessmentReportView({ report }: Props) {
  const { metadata, overall, dimensionScores, resumeJdFit, candidateQuestionsFeedback, topStrengths, topImprovementAreas, sevenDayPracticePlan, limitations } = report;

  return (
    <div>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 20, marginBottom: 24 }}>
        <div className="row-wrap" style={{ gap: 6, marginBottom: 10 }}>
          <span className="badge badge-blue">{STAGE_LABELS[metadata.stage as InterviewStage]}</span>
          <span className="badge badge-gray">{metadata.targetLevel}</span>
          <span className="badge badge-gray">{metadata.mode === "voice" ? "🎙 Voice" : "⌨️ Chat"}</span>
          {metadata.endedEarly && <span className="badge badge-yellow">Ended Early</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {metadata.completedMainQuestions} question(s) completed · Generated {new Date(metadata.generatedAtIso).toLocaleString()}
        </div>
      </div>

      {/* Overall */}
      <div className="card" style={{ marginBottom: 20, borderLeft: "4px solid var(--primary)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              Overall Recommendation
            </div>
            <div style={{ fontSize: 1.6 + "rem", fontWeight: 700 }}>{overall.recommendation}</div>
          </div>
          <span className={`score-pill ${RECOMMENDATION_COLOR[overall.recommendation] || "score-na"}`}>
            {overall.score}/4
          </span>
        </div>
        <p style={{ marginTop: 12, fontSize: 14, color: "var(--text)" }}>{overall.summary}</p>
      </div>

      {/* Top strengths + improvements */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ color: "var(--success)", marginBottom: 10 }}>✅ Top Strengths</h3>
          <ul style={{ paddingLeft: 18, fontSize: 14 }}>
            {topStrengths.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
          </ul>
        </div>
        <div className="card">
          <h3 style={{ color: "var(--danger)", marginBottom: 10 }}>📈 Top Areas to Improve</h3>
          <ul style={{ paddingLeft: 18, fontSize: 14 }}>
            {topImprovementAreas.map((a, i) => <li key={i} style={{ marginBottom: 6 }}>{a}</li>)}
          </ul>
        </div>
      </div>

      {/* Dimension Scores */}
      <h2 style={{ marginBottom: 16 }}>Dimension Scores</h2>
      <div className="stack" style={{ marginBottom: 24 }}>
        {dimensionScores.map((d, i) => {
          const scoreClass = d.score === "Not Assessed" ? "score-na" : `score-${d.score}`;
          return (
            <div key={i} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{d.dimension}</h3>
                <span className={`score-pill ${scoreClass}`}>
                  {d.score === "Not Assessed" ? "Not Assessed" : `${SCORE_LABEL[d.score]} (${d.score}/4)`}
                </span>
              </div>
              {d.score !== "Not Assessed" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Evidence</div>
                    <ul style={{ paddingLeft: 16, fontSize: 13 }}>
                      {d.evidence.map((e, j) => <li key={j} style={{ marginBottom: 4 }}>{e}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--success)", marginBottom: 6, textTransform: "uppercase" }}>Strengths</div>
                    <ul style={{ paddingLeft: 16, fontSize: 13 }}>
                      {d.strengths.map((s, j) => <li key={j} style={{ marginBottom: 4 }}>{s}</li>)}
                    </ul>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--danger)", marginTop: 10, marginBottom: 6, textTransform: "uppercase" }}>Improve</div>
                    <ul style={{ paddingLeft: 16, fontSize: 13 }}>
                      {d.improvementAreas.map((a, j) => <li key={j} style={{ marginBottom: 4 }}>{a}</li>)}
                    </ul>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", marginTop: 10, marginBottom: 6, textTransform: "uppercase" }}>Practice Next</div>
                    <ul style={{ paddingLeft: 16, fontSize: 13 }}>
                      {d.practiceNext.map((p, j) => <li key={j} style={{ marginBottom: 4 }}>{p}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resume/JD Fit */}
      <h2 style={{ marginBottom: 12 }}>Resume / JD Fit</h2>
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 14, marginBottom: 14 }}>{resumeJdFit.alignmentSummary}</p>
        {resumeJdFit.possibleDiscrepanciesOrGaps.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--warning)", marginBottom: 6, textTransform: "uppercase" }}>Possible Gaps or Areas to Clarify</div>
            <ul style={{ paddingLeft: 18, fontSize: 13 }}>
              {resumeJdFit.possibleDiscrepanciesOrGaps.map((g, i) => <li key={i} style={{ marginBottom: 4 }}>{g}</li>)}
            </ul>
          </div>
        )}
        {resumeJdFit.roleSpecificRisks.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--danger)", marginBottom: 6, textTransform: "uppercase" }}>Role-Specific Risks</div>
            <ul style={{ paddingLeft: 18, fontSize: 13 }}>
              {resumeJdFit.roleSpecificRisks.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Candidate Questions Feedback */}
      <h2 style={{ marginBottom: 12 }}>Candidate Questions Feedback</h2>
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 14, marginBottom: 12 }}>{candidateQuestionsFeedback.assessment}</p>
        {candidateQuestionsFeedback.betterQuestions.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", marginBottom: 6, textTransform: "uppercase" }}>Stronger Questions to Consider</div>
            <ul style={{ paddingLeft: 18, fontSize: 13 }}>
              {candidateQuestionsFeedback.betterQuestions.map((q, i) => <li key={i} style={{ marginBottom: 4 }}>{q}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* 7-Day Practice Plan */}
      <h2 style={{ marginBottom: 12 }}>7-Day Practice Plan</h2>
      <div className="card" style={{ marginBottom: 20 }}>
        <ol style={{ paddingLeft: 20, fontSize: 14 }}>
          {sevenDayPracticePlan.map((item, i) => <li key={i} style={{ marginBottom: 8 }}>{item}</li>)}
        </ol>
      </div>

      {/* Limitations */}
      {limitations.length > 0 && (
        <>
          <h2 style={{ marginBottom: 12 }}>Assessment Limitations</h2>
          <div className="card" style={{ marginBottom: 20, background: "#fff3cd", borderColor: "#ffc107" }}>
            <ul style={{ paddingLeft: 18, fontSize: 13 }}>
              {limitations.map((l, i) => <li key={i} style={{ marginBottom: 6 }}>{l}</li>)}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
