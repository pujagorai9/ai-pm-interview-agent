"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { SessionState, InterviewTurn, InterviewTurnResponse, AssessmentReport } from "@/lib/types";
import { STAGE_QUESTION_PLANS } from "@/lib/prompts";
import SetupForm from "@/components/SetupForm";
import ModeSelector from "@/components/ModeSelector";
import InterviewRoom from "@/components/InterviewRoom";
import CandidateQuestionsScreen from "@/components/CandidateQuestionsScreen";
import AssessmentReportView from "@/components/AssessmentReportView";
import ExportButtons from "@/components/ExportButtons";

const INITIAL_SESSION: Partial<SessionState> = {
  status: "ONBOARDING",
  turns: [],
  currentMainQuestionIndex: 0,
  followUpsUsedForCurrentQuestion: 0,
  rudeWarningCount: 0,
  hintCount: 0,
  suspectedLiveInterviewFlag: false,
  voicePermission: "unknown",
};

// Reads an SSE stream from the assessment API.
// Calls onToken for each streamed token (for live preview),
// resolves with the parsed AssessmentReport on "done", rejects on "error".
async function readAssessmentStream(
  res: Response,
  onToken: (token: string) => void
): Promise<AssessmentReport> {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastEvent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE format: lines grouped by \n\n blocks
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const lines = block.split("\n");
      let event = lastEvent;
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) data = line.slice(6);
      }
      lastEvent = event;
      if (!data) continue;

      if (event === "token") {
        try { onToken(JSON.parse(data)); } catch { /* ignore */ }
      } else if (event === "done") {
        try { return JSON.parse(data) as AssessmentReport; } catch {
          throw new Error("Assessment JSON was invalid.");
        }
      } else if (event === "error") {
        let msg = data;
        try { msg = JSON.parse(data); } catch { /* use raw */ }
        throw new Error(msg);
      }
    }
  }
  throw new Error("Stream ended without a result.");
}

function AssessmentLoadingScreen({ streamedText }: { streamedText: string }) {
  const [elapsed, setElapsed] = useState(0);
  const previewRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (previewRef.current) previewRef.current.scrollTop = previewRef.current.scrollHeight;
  }, [streamedText]);

  const timeStr = elapsed >= 60 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : `${elapsed}s`;

  return (
    <div className="container">
      <div className="card" style={{ padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <h2>Generating Your Assessment</h2>
          <p style={{ color: "var(--text-muted)", marginTop: 6, fontSize: 14 }}>
            Please do not refresh — your report is being written in real time below.
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4, fontWeight: 500 }}>
            ⏱ {timeStr} elapsed
          </p>
        </div>
        {streamedText && (
          <pre
            ref={previewRef}
            style={{
              background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6,
              padding: 12, fontSize: 11, lineHeight: 1.5, maxHeight: 300, overflowY: "auto",
              whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text-muted)",
            }}
          >
            {streamedText}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [session, setSession] = useState<SessionState>(INITIAL_SESSION as SessionState);
  const [error, setError] = useState("");
  const [generatingAssessment, setGeneratingAssessment] = useState(false);
  const [streamedText, setStreamedText] = useState("");

  function restart() {
    setSession(INITIAL_SESSION as SessionState);
    setError("");
    setGeneratingAssessment(false);
    setStreamedText("");
  }

  function handleSetupContinue(data: Pick<SessionState, "resumeText" | "jdText" | "stage" | "targetLevel" | "importedPriorAssessment">) {
    setSession((s) => ({
      ...s, ...data,
      plannedQuestionCategories: STAGE_QUESTION_PLANS[data.stage],
      status: "CONTEXT_READY",
    }));
  }

  function handleModeSelect(mode: "chat" | "voice", voicePermission: SessionState["voicePermission"]) {
    setSession((s) => ({
      ...s, mode, voicePermission,
      status: "INTERVIEW_IN_PROGRESS",
      startedAtIso: new Date().toISOString(),
    }));
  }

  const handleTurnsComplete = useCallback((newTurns: InterviewTurn[], response: InterviewTurnResponse) => {
    setSession((s) => {
      const turns = [...s.turns, ...newTurns];
      let currentMainQuestionIndex = s.currentMainQuestionIndex;
      let followUpsUsedForCurrentQuestion = s.followUpsUsedForCurrentQuestion;
      const lastCandidateTurn = [...newTurns].reverse().find((t) => t.role === "candidate");
      if (lastCandidateTurn) {
        if (response.shouldIncrementMainQuestion) {
          currentMainQuestionIndex = s.currentMainQuestionIndex + 1;
          followUpsUsedForCurrentQuestion = 0;
        } else if (response.type === "follow_up") {
          followUpsUsedForCurrentQuestion = s.followUpsUsedForCurrentQuestion + 1;
        }
      }
      return { ...s, turns, currentMainQuestionIndex, followUpsUsedForCurrentQuestion };
    });
  }, []);

  function handleEndInterview() {
    setSession((s) => ({ ...s, status: "CANDIDATE_QUESTIONS", endedAtIso: new Date().toISOString() }));
  }

  function handleMoveToCandidate() {
    setSession((s) => ({ ...s, status: "CANDIDATE_QUESTIONS", endedAtIso: new Date().toISOString() }));
  }

  async function handleCandidateQuestionsSubmit(questions: string) {
    // Capture current session synchronously before going async
    const snap = session;
    const maxMainQuestions = snap.stage === "recruiter_screen" ? 4 : 5;
    const completedMainQuestions = Math.min(snap.currentMainQuestionIndex, maxMainQuestions);
    const endedEarly = completedMainQuestions < maxMainQuestions;

    setSession((s) => ({ ...s, candidateQuestions: questions, status: "GENERATING_ASSESSMENT" }));
    setGeneratingAssessment(true);
    setStreamedText("");
    setError("");

    try {
      const res = await fetch("/api/generate-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: snap.stage, targetLevel: snap.targetLevel, mode: snap.mode,
          resumeText: snap.resumeText, jdText: snap.jdText, turns: snap.turns,
          candidateQuestions: questions || undefined,
          completedMainQuestions, endedEarly,
          hintCount: snap.hintCount, voicePermission: snap.voicePermission,
        }),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const assessment = await readAssessmentStream(res, (token) => {
        setStreamedText((t) => t + token);
      });

      setSession((s) => ({ ...s, assessment, status: "REPORT_READY" }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(`Failed to generate assessment: ${msg}. Your transcript is preserved — you can try again.`);
      setSession((s) => ({ ...s, status: "CANDIDATE_QUESTIONS" }));
    } finally {
      setGeneratingAssessment(false);
    }
  }

  // ── State machine render ──────────────────────────────────────────────────

  if (session.status === "ONBOARDING") {
    return <SetupForm onContinue={handleSetupContinue} />;
  }

  if (session.status === "CONTEXT_READY") {
    return <ModeSelector onSelect={handleModeSelect} onBack={restart} />;
  }

  if (session.status === "INTERVIEW_IN_PROGRESS" || session.status === "MODE_SELECTED") {
    return (
      <InterviewRoom
        session={session}
        onTurnsComplete={handleTurnsComplete}
        onEndInterview={handleEndInterview}
        onMoveToCandidate={handleMoveToCandidate}
        onRestart={restart}
        onError={(msg) => setError(msg)}
      />
    );
  }

  if (session.status === "CANDIDATE_QUESTIONS") {
    return (
      <div>
        {error && (
          <div className="container">
            <div className="error-banner error"><span>⚠️</span>{error}</div>
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={() => handleCandidateQuestionsSubmit(session.candidateQuestions || "")}>
                Retry Assessment
              </button>
            </div>
          </div>
        )}
        {!error && (
          <CandidateQuestionsScreen
            onSubmit={handleCandidateQuestionsSubmit}
            onSkip={() => handleCandidateQuestionsSubmit("")}
          />
        )}
      </div>
    );
  }

  if (session.status === "GENERATING_ASSESSMENT" || generatingAssessment) {
    return <AssessmentLoadingScreen streamedText={streamedText} />;
  }

  if (session.status === "REPORT_READY" && session.assessment) {
    return (
      <div className="container">
        {error && <div className="error-banner error" style={{ marginBottom: 16 }}><span>⚠️</span>{error}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <h1>Your Interview Assessment</h1>
          <div className="row-wrap" style={{ gap: 10 }}>
            <ExportButtons report={session.assessment} />
            <button className="btn btn-outline" onClick={restart}>↺ New Interview</button>
          </div>
        </div>
        <AssessmentReportView report={session.assessment} />
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <button className="btn btn-primary" onClick={restart}>Start Another Interview</button>
        </div>
      </div>
    );
  }

  return null;
}
