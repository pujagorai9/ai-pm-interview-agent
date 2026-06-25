import { AssessmentReport, InterviewStage } from "./types";
import { STAGE_LABELS } from "./prompts";

const SCORE_LABEL: Record<number | string, string> = {
  1: "1 — Strong No Hire",
  2: "2 — No Hire",
  3: "3 — Hire",
  4: "4 — Strong Hire",
  "Not Assessed": "Not Assessed",
};

export function reportToMarkdown(report: AssessmentReport): string {
  const { metadata, overall, dimensionScores, resumeJdFit, candidateQuestionsFeedback, topStrengths, topImprovementAreas, sevenDayPracticePlan, limitations } = report;

  const lines: string[] = [];

  lines.push(`# AI PM Interview Assessment`);
  lines.push(``);
  lines.push(`**Stage:** ${STAGE_LABELS[metadata.stage as InterviewStage]}`);
  lines.push(`**Level:** ${metadata.targetLevel}`);
  lines.push(`**Mode:** ${metadata.mode}`);
  lines.push(`**Questions Completed:** ${metadata.completedMainQuestions}${metadata.endedEarly ? " (ended early)" : ""}`);
  lines.push(`**Generated:** ${new Date(metadata.generatedAtIso).toLocaleString()}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Overall Recommendation`);
  lines.push(``);
  lines.push(`**${overall.recommendation}** (Score: ${overall.score}/4)`);
  lines.push(``);
  lines.push(overall.summary);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Dimension Scores`);
  lines.push(``);

  for (const d of dimensionScores) {
    lines.push(`### ${d.dimension}`);
    lines.push(`**Score:** ${SCORE_LABEL[d.score]}`);
    lines.push(``);
    if (d.score !== "Not Assessed") {
      lines.push(`**Evidence from interview:**`);
      for (const e of d.evidence) lines.push(`- ${e}`);
      lines.push(``);
      lines.push(`**Strengths:**`);
      for (const s of d.strengths) lines.push(`- ${s}`);
      lines.push(``);
      lines.push(`**Areas to improve:**`);
      for (const a of d.improvementAreas) lines.push(`- ${a}`);
      lines.push(``);
      lines.push(`**Practice next:**`);
      for (const p of d.practiceNext) lines.push(`- ${p}`);
    }
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Resume / JD Fit`);
  lines.push(``);
  lines.push(resumeJdFit.alignmentSummary);
  lines.push(``);
  if (resumeJdFit.possibleDiscrepanciesOrGaps.length > 0) {
    lines.push(`**Possible gaps or areas to clarify:**`);
    for (const g of resumeJdFit.possibleDiscrepanciesOrGaps) lines.push(`- ${g}`);
    lines.push(``);
  }
  if (resumeJdFit.roleSpecificRisks.length > 0) {
    lines.push(`**Role-specific risks:**`);
    for (const r of resumeJdFit.roleSpecificRisks) lines.push(`- ${r}`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Candidate Questions Feedback`);
  lines.push(``);
  lines.push(candidateQuestionsFeedback.assessment);
  lines.push(``);
  if (candidateQuestionsFeedback.betterQuestions.length > 0) {
    lines.push(`**Stronger questions to consider asking:**`);
    for (const q of candidateQuestionsFeedback.betterQuestions) lines.push(`- ${q}`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Top Strengths`);
  lines.push(``);
  for (const s of topStrengths) lines.push(`- ${s}`);
  lines.push(``);

  lines.push(`## Top Areas to Improve`);
  lines.push(``);
  for (const a of topImprovementAreas) lines.push(`- ${a}`);
  lines.push(``);

  lines.push(`---`);
  lines.push(``);
  lines.push(`## 7-Day Practice Plan`);
  lines.push(``);
  sevenDayPracticePlan.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
  lines.push(``);

  if (limitations.length > 0) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Limitations`);
    lines.push(``);
    for (const l of limitations) lines.push(`- ${l}`);
  }

  return lines.join("\n");
}

export function getExportFilename(stage: InterviewStage, ext: "md" | "json"): string {
  const date = new Date().toISOString().split("T")[0];
  const stageSlug = stage.replace(/_/g, "-");
  return `ai-pm-interview-assessment-${stageSlug}-${date}.${ext}`;
}

export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
