"use client";
import { useEffect, useRef, useState } from "react";
import { SessionState, InterviewTurn, InterviewTurnResponse } from "@/lib/types";
import { STAGE_LABELS, STAGE_QUESTION_PLANS } from "@/lib/prompts";
import VoiceInputButton from "./VoiceInputButton";

interface Props {
  session: SessionState;
  onTurnComplete: (turn: InterviewTurn, response: InterviewTurnResponse) => void;
  onEndInterview: () => void;
  onMoveToCandidate: () => void;
  onRestart: () => void;
  onError: (msg: string) => void;
}

export default function InterviewRoom({ session, onTurnComplete, onEndInterview, onMoveToCandidate, onRestart, onError }: Props) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const maxMainQuestions = session.stage === "recruiter_screen" ? 4 : 5;
  const progress = Math.min(session.currentMainQuestionIndex / maxMainQuestions, 1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.turns]);

  // Auto-fetch first question when interview starts with no turns
  useEffect(() => {
    if (session.turns.length === 0 && !loading) {
      fetchNextTurn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchNextTurn(candidateAnswer?: string) {
    setLoading(true);
    try {
      const turns = candidateAnswer
        ? [
            ...session.turns,
            {
              role: "candidate" as const,
              content: candidateAnswer,
              timestamp: new Date().toISOString(),
            },
          ]
        : session.turns;

      const res = await fetch("/api/interview-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: session.stage,
          targetLevel: session.targetLevel,
          resumeText: session.resumeText,
          jdText: session.jdText,
          importedPriorAssessment: session.importedPriorAssessment,
          turns,
          currentMainQuestionIndex: session.currentMainQuestionIndex,
          followUpsUsedForCurrentQuestion: session.followUpsUsedForCurrentQuestion,
        }),
      });

      if (!res.ok) {
        onError("Failed to fetch the next question. Please try again.");
        return;
      }

      const response: InterviewTurnResponse = await res.json();

      if (response.type === "move_to_candidate_questions") {
        if (candidateAnswer) {
          onTurnComplete(
            { role: "candidate", content: candidateAnswer, timestamp: new Date().toISOString() },
            response
          );
        }
        onMoveToCandidate();
        return;
      }

      const interviewerTurn: InterviewTurn = {
        role: "interviewer",
        content: response.questionText || "",
        questionCategory: response.questionCategory,
        timestamp: new Date().toISOString(),
      };

      if (candidateAnswer) {
        const candidateTurn: InterviewTurn = {
          role: "candidate",
          content: candidateAnswer,
          timestamp: new Date().toISOString(),
        };
        onTurnComplete(candidateTurn, response);
        setTimeout(() => onTurnComplete(interviewerTurn, { ...response, shouldIncrementMainQuestion: false }), 50);
      } else {
        onTurnComplete(interviewerTurn, response);
      }
    } catch {
      onError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
      setAnswer("");
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = answer.trim();
    if (!trimmed || loading) return;
    await fetchNextTurn(trimmed);
  }

  function handleEndInterview() {
    if (session.turns.length === 0) return;
    onEndInterview();
  }

  const interviewerTurns = session.turns.filter((t) => t.role === "interviewer");
  const lastQuestion = interviewerTurns[interviewerTurns.length - 1];

  return (
    <div className="container">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.1rem", marginBottom: 2 }}>
            {STAGE_LABELS[session.stage]}
          </h1>
          <div className="row-wrap" style={{ gap: 6 }}>
            <span className="badge badge-blue">{session.targetLevel}</span>
            <span className="badge badge-gray">{session.mode === "voice" ? "🎙 Voice" : "⌨️ Chat"}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setConfirmRestart(true)}>
            ↺ Restart
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleEndInterview}
            disabled={session.turns.length === 0 || loading}
          >
            End Interview
          </button>
        </div>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
          <span>Question {Math.min(session.currentMainQuestionIndex + 1, maxMainQuestions)} of {maxMainQuestions}</span>
          <span>{Math.round(progress * 100)}% complete</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {confirmRestart && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          <span>⚠️</span>
          <div>
            Restarting will discard this session. Continue?{" "}
            <button className="btn btn-danger btn-sm" style={{ marginLeft: 8 }} onClick={onRestart}>Yes, Restart</button>
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 6 }} onClick={() => setConfirmRestart(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Transcript */}
      <div className="card" style={{ marginBottom: 16, maxHeight: 420, overflowY: "auto" }}>
        {session.turns.length === 0 && loading && (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 24 }}>
            Starting interview…
          </div>
        )}
        {session.turns.map((turn, i) => (
          <div
            key={i}
            style={{
              marginBottom: 16,
              display: "flex",
              flexDirection: turn.role === "candidate" ? "row-reverse" : "row",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 20 }}>{turn.role === "interviewer" ? "👤" : "🙋"}</div>
            <div
              style={{
                background: turn.role === "interviewer" ? "var(--bg)" : "#e8f0fe",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 14px",
                maxWidth: "80%",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 11, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {turn.role === "interviewer" ? "Interviewer" : "You"}
              </div>
              {turn.content}
            </div>
          </div>
        ))}
        {loading && session.turns.length > 0 && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--text-muted)", fontSize: 13 }}>
            <div>👤</div>
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Answer input */}
      {lastQuestion && (
        <form onSubmit={handleSend}>
          <div style={{ background: "#f0f4ff", border: "1px solid #cfe2ff", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 13, color: "#084298" }}>
            <strong>Current question:</strong> {lastQuestion.content}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              rows={3}
              placeholder="Type your answer here…"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={loading}
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(e);
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button type="submit" className="btn btn-primary" disabled={loading || !answer.trim()}>
                Send
              </button>
              {session.mode === "voice" && (
                <VoiceInputButton
                  onTranscript={(t) => setAnswer((prev) => (prev ? prev + " " + t : t))}
                  disabled={loading}
                />
              )}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Tip: Press Cmd+Enter / Ctrl+Enter to send
          </div>
        </form>
      )}
    </div>
  );
}
