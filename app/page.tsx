"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { SessionState, InterviewTurn, InterviewTurnResponse } from "@/lib/types";
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

function AssessmentLoadingScreen() {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div className="container">
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h2>Generating Your Assessment</h2>
        <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
          Analyzing your interview responses and generating evidence-based feedback…
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
          This typically takes 30–90 seconds. Please do not refresh.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6, fontWeight: 500 }}>
          ⏱ {timeStr} elapsed
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const [session, setSession] = useState<SessionState>(INITIAL_SESSION as SessionState);
  const [error, setError] = useState("");
  const [generatingAssessment, setGeneratingAssessment] = useState(false);

  function restart() {
    setSession(INITIAL_SESSION as SessionState);
    setError("");
    setGeneratingAssessment(false);
  }

  function handleSetupContinue(data: Pick<SessionState, "resumeText" | "jdText" | "stage" | "targetLevel" | "importedPriorAssessment">) {
    setSession((s) => ({
      ...s,
      ...data,
      plannedQuestionCategories: STAGE_QUESTION_PLANS[data.stage],
      status: "CONTEXT_READY",
    }));
  }

  function handleModeSelect(mode: "chat" | "voice", voicePermission: SessionState["voicePermission"]) {
    setSession((s) => ({
      ...s,
      mode,
      voicePermission,
      status: "INTERVIEW_IN_PROGRESS",
      startedAtIso: new Date().toISOString(),
    }));
  }

  // Atomically commit one or more turns in a single state update
  const handleTurnsComplete = useCallback((newTurns: InterviewTurn[], response: InterviewTurnResponse) => {
    setSession((s) => {
      const turns = [...s.turns, ...newTurns];
      let currentMainQuestionIndex = s.currentMainQuestionIndex;
      let followUpsUsedForCurrentQuestion = s.followUpsUsedForCurrentQuestion;

      // The last candidate turn in the batch determines index changes
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
    // Snapshot session values before going async — avoids stale closure issues
    setSession((s) => {
      const maxMainQuestions = s.stage === "recruiter_screen" ? 4 : 5;
      const completedMainQuestions = Math.min(s.currentMainQuestionIndex, maxMainQuestions);
      const endedEarly = completedMainQuestions < maxMainQuestions;

      // Kick off the fetch using current session snapshot
      setGeneratingAssessment(true);
      setError("");

      fetch("/api/generate-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: s.stage,
          targetLevel: s.targetLevel,
          mode: s.mode,
          resumeText: s.resumeText,
          jdText: s.jdText,
          turns: s.turns,
          candidateQuestions: questions || undefined,
          completedMainQuestions,
          endedEarly,
          hintCount: s.hintCount,
          voicePermission: s.voicePermission,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || "Assessment generation failed");
          }
          return res.json();
        })
        .then((assessment) => {
          setSession((prev) => ({ ...prev, assessment, status: "REPORT_READY" }));
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : "Unknown error";
          setError(`Failed to generate assessment: ${msg}. Your transcript is preserved — you can try again.`);
          setSession((prev) => ({ ...prev, status: "CANDIDATE_QUESTIONS" }));
        })
        .finally(() => {
          setGeneratingAssessment(false);
        });

      return { ...s, candidateQuestions: questions, status: "GENERATING_ASSESSMENT" as const };
    });
  }

  // Render state machine
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
    return <AssessmentLoadingScreen />;
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
