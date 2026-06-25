"use client";
import { useState, useCallback } from "react";
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
      status: "MODE_SELECTED",
      startedAtIso: new Date().toISOString(),
    }));
    // Immediately transition to interview in progress
    setSession((s) => ({ ...s, status: "INTERVIEW_IN_PROGRESS" }));
  }

  const handleTurnComplete = useCallback((turn: InterviewTurn, response: InterviewTurnResponse) => {
    setSession((s) => {
      const newTurns = [...s.turns, turn];
      let newIndex = s.currentMainQuestionIndex;
      let newFollowUps = s.followUpsUsedForCurrentQuestion;

      if (turn.role === "candidate") {
        // After candidate answers, check if we should increment
        if (response.shouldIncrementMainQuestion) {
          newIndex = s.currentMainQuestionIndex + 1;
          newFollowUps = 0;
        } else if (response.type === "follow_up") {
          newFollowUps = s.followUpsUsedForCurrentQuestion + 1;
        }
      }

      return {
        ...s,
        turns: newTurns,
        currentMainQuestionIndex: newIndex,
        followUpsUsedForCurrentQuestion: newFollowUps,
      };
    });
  }, []);

  function handleEndInterview() {
    setSession((s) => ({ ...s, status: "CANDIDATE_QUESTIONS", endedAtIso: new Date().toISOString() }));
  }

  function handleMoveToCandidate() {
    setSession((s) => ({ ...s, status: "CANDIDATE_QUESTIONS", endedAtIso: new Date().toISOString() }));
  }

  async function handleCandidateQuestionsSubmit(questions: string) {
    setSession((s) => ({ ...s, candidateQuestions: questions, status: "GENERATING_ASSESSMENT" }));
    setGeneratingAssessment(true);
    setError("");

    try {
      const maxMainQuestions = session.stage === "recruiter_screen" ? 4 : 5;
      const completedMainQuestions = Math.min(session.currentMainQuestionIndex, maxMainQuestions);
      const endedEarly = completedMainQuestions < maxMainQuestions;

      const res = await fetch("/api/generate-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: session.stage,
          targetLevel: session.targetLevel,
          mode: session.mode,
          resumeText: session.resumeText,
          jdText: session.jdText,
          turns: session.turns,
          candidateQuestions: questions || undefined,
          completedMainQuestions,
          endedEarly,
          hintCount: session.hintCount,
          voicePermission: session.voicePermission,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Assessment generation failed");
      }

      const assessment = await res.json();
      setSession((s) => ({ ...s, assessment, status: "REPORT_READY" }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(`Failed to generate assessment: ${msg}. Your transcript is preserved.`);
      setSession((s) => ({ ...s, status: "CANDIDATE_QUESTIONS" }));
    } finally {
      setGeneratingAssessment(false);
    }
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
        onTurnComplete={handleTurnComplete}
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
          </div>
        )}
        <CandidateQuestionsScreen
          onSubmit={handleCandidateQuestionsSubmit}
          onSkip={() => handleCandidateQuestionsSubmit("")}
        />
      </div>
    );
  }

  if (session.status === "GENERATING_ASSESSMENT" || generatingAssessment) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h2>Generating Your Assessment</h2>
          <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
            Analyzing your interview responses and generating evidence-based feedback…
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
            This may take 20–40 seconds.
          </p>
        </div>
      </div>
    );
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
