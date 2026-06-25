import { InterviewStage, QuestionCategory } from "./types";

export const STAGE_LABELS: Record<InterviewStage, string> = {
  not_yet_applied: "General Practice / Not Yet Applied",
  recruiter_screen: "Recruiter Screen",
  hm_screen: "Hiring Manager Screen",
  team_interviews: "Team Interviews",
  tech_stakeholder: "Tech Stakeholder Interview",
  design_stakeholder: "Design Stakeholder Interview",
  business_stakeholder: "Business Stakeholder Interview",
  ceo_cpo_final: "CEO / CPO Final Round",
};

export const STAGE_QUESTION_PLANS: Record<InterviewStage, QuestionCategory[]> = {
  not_yet_applied: [
    "career_narrative",
    "ai_product_sense_strategy",
    "execution_metrics",
    "ai_ml_technical_judgment",
    "leadership_behavioral",
  ],
  recruiter_screen: [
    "career_narrative",
    "motivation_role_fit",
    "motivation_role_fit",
    "ai_ml_technical_judgment",
  ],
  hm_screen: [
    "ai_product_sense_strategy",
    "execution_metrics",
    "ai_ml_technical_judgment",
    "leadership_behavioral",
    "resume_jd_deep_dive",
  ],
  team_interviews: [
    "ai_ml_technical_judgment",
    "design_user_empathy",
    "business_gtm_monetization",
    "leadership_behavioral",
    "resume_jd_deep_dive",
  ],
  tech_stakeholder: [
    "ai_ml_technical_judgment",
    "ai_ml_technical_judgment",
    "ai_ml_technical_judgment",
    "ai_product_sense_strategy",
    "execution_metrics",
  ],
  design_stakeholder: [
    "design_user_empathy",
    "design_user_empathy",
    "design_user_empathy",
    "ai_product_sense_strategy",
    "leadership_behavioral",
  ],
  business_stakeholder: [
    "business_gtm_monetization",
    "business_gtm_monetization",
    "business_gtm_monetization",
    "ai_product_sense_strategy",
    "execution_metrics",
  ],
  ceo_cpo_final: [
    "ai_product_sense_strategy",
    "business_gtm_monetization",
    "motivation_role_fit",
    "ai_ml_technical_judgment",
    "leadership_behavioral",
  ],
};

export const STAGE_TONE: Record<InterviewStage, string> = {
  not_yet_applied: "Professional, friendly, and coaching-neutral.",
  recruiter_screen: "Warm, conversational, and high-level.",
  hm_screen: "Structured, curious, and realistic.",
  team_interviews: "Direct but fair.",
  tech_stakeholder: "Detail-oriented, sometimes skeptical.",
  design_stakeholder: "Collaborative and user-centric.",
  business_stakeholder: "Metrics-driven and practical.",
  ceo_cpo_final: "Big-picture, conversational, and pressure-testing.",
};

export const STAGE_INTERVIEWER_ROLE: Record<InterviewStage, string> = {
  not_yet_applied: "a mock AI PM interviewer",
  recruiter_screen: "a recruiter at the target company",
  hm_screen: "the hiring manager for this AI PM role",
  team_interviews: "a team member who will work closely with this PM",
  tech_stakeholder: "a senior ML engineer and technical stakeholder",
  design_stakeholder: "a senior designer and UX stakeholder",
  business_stakeholder: "a business development or GTM lead",
  ceo_cpo_final: "the CEO or CPO conducting the final round",
};

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  career_narrative: "Career Narrative",
  motivation_role_fit: "Motivation & Role Fit",
  ai_product_sense_strategy: "AI Product Sense & Strategy",
  execution_metrics: "Execution & Metrics",
  ai_ml_technical_judgment: "AI/ML Technical Judgment",
  design_user_empathy: "Design & User Empathy",
  business_gtm_monetization: "Business, GTM & Monetization",
  leadership_behavioral: "Leadership & Behavioral",
  resume_jd_deep_dive: "Resume / JD Deep Dive",
  candidate_questions: "Candidate Questions",
};

export function buildInterviewerSystemPrompt(params: {
  stage: InterviewStage;
  targetLevel: string;
  resumeText: string;
  jdText: string;
  importedPriorAssessment?: string;
}): string {
  const { stage, targetLevel, resumeText, jdText, importedPriorAssessment } = params;
  const role = STAGE_INTERVIEWER_ROLE[stage];
  const tone = STAGE_TONE[stage];
  const stageLabel = STAGE_LABELS[stage];

  return `You are conducting a mock AI PM interview. You are playing the role of ${role} interviewing a ${targetLevel} candidate for an AI PM position.

INTERVIEW STAGE: ${stageLabel}
TONE: ${tone}

CANDIDATE RESUME:
${resumeText}

TARGET JOB DESCRIPTION:
${jdText}
${importedPriorAssessment ? `\nPRIOR ASSESSMENT CONTEXT (from candidate's previous session):\n${importedPriorAssessment}\n` : ""}

CORE RULES:
1. Ask exactly ONE question at a time. Never ask multiple questions in a single turn.
2. Stay in character as ${role}. Do not break the fourth wall.
3. Do NOT evaluate, praise, or give feedback during the interview. Save all feedback for the final report.
4. Do NOT reveal ideal answers or coach the candidate during questioning.
5. Do NOT say things like "Great answer!" or "That was excellent." Stay neutral.
6. If the candidate asks a clarifying question about the interview question, answer in character and provide reasonable constraints.
7. If the candidate asks too many clarifying questions, say: "Use your judgment and state reasonable assumptions."
8. Be realistic and professional. This should feel like a real interview.
9. Use the resume and JD context to make questions specific and relevant.

EDGE CASE HANDLING:
- If the candidate gives a one-word or very short answer, ask exactly once: "Can you walk me through your thinking on that?" Then move on if still short.
- If the candidate asks for a hint, say: "Walk me through your thinking process first. I can help if you are stuck." Then give a light hint, not the answer.
- If the candidate goes off-topic, redirect once: "Let us bring it back. The question was about [topic]." If repeated, move on.
- If the candidate is rude, warn professionally. Track warnings mentally.
- If the candidate implies this is a live interview they are cheating on, say the tool is for practice only and cannot assist with a live interview.`;
}

export function buildInterviewTurnDecisionPrompt(params: {
  stage: InterviewStage;
  targetLevel: string;
  plannedCategories: QuestionCategory[];
  currentMainQuestionIndex: number;
  followUpsUsed: number;
  totalTurns: number;
  turnsJson: string;
  maxMainQuestions: number;
}): string {
  const {
    stage,
    targetLevel,
    plannedCategories,
    currentMainQuestionIndex,
    followUpsUsed,
    totalTurns,
    turnsJson,
    maxMainQuestions,
  } = params;

  const remainingCategories = plannedCategories.slice(currentMainQuestionIndex);
  const currentCategory = plannedCategories[currentMainQuestionIndex];
  const isLastQuestion = currentMainQuestionIndex >= maxMainQuestions - 1;

  return `You are deciding what to do next in this ${STAGE_LABELS[stage]} interview for a ${targetLevel} candidate.

CURRENT STATE:
- Main question index: ${currentMainQuestionIndex} of ${maxMainQuestions - 1} (0-indexed)
- Current question category: ${currentCategory ? CATEGORY_LABELS[currentCategory] : "none"}
- Follow-ups used for current question: ${followUpsUsed} (max 1, or 2 if answer was unusable)
- Total interview turns so far: ${totalTurns}
- Is this the last planned question: ${isLastQuestion}
- Remaining categories: ${remainingCategories.map((c) => CATEGORY_LABELS[c]).join(", ")}

INTERVIEW TRANSCRIPT:
${turnsJson}

DECISION RULES:
1. If the interview has covered all ${maxMainQuestions} main questions (currentMainQuestionIndex >= ${maxMainQuestions}), return type "move_to_candidate_questions".
2. If totalTurns >= 30, return type "move_to_candidate_questions".
3. If followUpsUsed >= 1 AND the last answer was adequate (not extremely short or unusable), return type "question" for the next main question category and set shouldIncrementMainQuestion to true.
4. If followUpsUsed >= 2, always move to the next main question (type "question", shouldIncrementMainQuestion true).
5. If followUpsUsed === 0 and the last candidate answer needs probing (unclear, very short, interesting claim to pressure-test, lacks structure, or conflicts with resume/JD), return type "follow_up" and set shouldIncrementMainQuestion to false.
6. If followUpsUsed === 0 and the answer is adequate, return type "question" for the next category and set shouldIncrementMainQuestion to true.
7. If currentMainQuestionIndex === 0 and there are no candidate turns yet, ask the first question (type "question", shouldIncrementMainQuestion false since we haven't gotten an answer yet — but actually set shouldIncrementMainQuestion to false only when it's the very first question being asked).

IMPORTANT: Return ONLY valid JSON matching this schema. No markdown, no explanation:
{
  "type": "question" | "follow_up" | "move_to_candidate_questions" | "end_interview",
  "questionText": "the actual question to ask (omit if move_to_candidate_questions)",
  "questionCategory": "${currentCategory || "career_narrative"}",
  "interviewerRole": "${STAGE_INTERVIEWER_ROLE[stage]}",
  "shouldIncrementMainQuestion": true | false,
  "limitationNote": "optional note about any limitation detected (e.g. very short answer, hint requested)"
}`;
}

export function buildAssessmentPrompt(params: {
  stage: InterviewStage;
  targetLevel: string;
  mode: string;
  resumeText: string;
  jdText: string;
  turnsJson: string;
  candidateQuestions?: string;
  completedMainQuestions: number;
  endedEarly: boolean;
  limitations: string[];
}): string {
  const {
    stage,
    targetLevel,
    mode,
    resumeText,
    jdText,
    turnsJson,
    candidateQuestions,
    completedMainQuestions,
    endedEarly,
    limitations,
  } = params;

  return `You are generating a final scored assessment for a mock AI PM interview.

INTERVIEW DETAILS:
- Stage: ${STAGE_LABELS[stage]}
- Target level: ${targetLevel}
- Mode: ${mode}
- Completed main questions: ${completedMainQuestions}
- Ended early: ${endedEarly}
- Known limitations: ${limitations.join("; ") || "none"}

CANDIDATE RESUME:
${resumeText}

TARGET JOB DESCRIPTION:
${jdText}

FULL INTERVIEW TRANSCRIPT:
${turnsJson}
${candidateQuestions ? `\nCANDIDATE'S QUESTIONS TO INTERVIEWER:\n${candidateQuestions}` : ""}

SCORING RUBRIC (1-4 scale):
1 = Strong No Hire: Clear gaps that would concern the team if hired.
2 = No Hire: Below bar. Important elements missing.
3 = Hire: Meets bar. Solid performance.
4 = Strong Hire: Exceeds bar. Clear differentiator.

DIMENSIONS TO SCORE:
1. AI Product Sense & Strategy
2. Execution, Metrics & Analytical Rigor
3. AI/ML Technical Depth & Judgment
4. Leadership, Influence & Behavioral
5. Communication & Interview Presence (scored across ALL answers)
6. Role/JD Fit

NEAR-VETO RULES (apply these strictly):
- Poor responsible-AI judgment (dismissing bias, safety, privacy as someone else's problem) strongly pulls overall recommendation down even if AI/ML dimension is acceptable.
- Vague or deflected ownership (claiming disproportionate impact, blaming others for failures) strongly pulls overall recommendation down even if Leadership dimension is acceptable.
- Do NOT mark Strong Hire unless there is specific evidence in at least THREE dimensions.

MANDATORY REQUIREMENTS FOR THE REPORT:
1. Every dimension must quote or paraphrase AT LEAST THREE specific things the candidate said (use "evidence" array).
2. Every improvement area must include a concrete next practice action (use "practiceNext" array).
3. If chat mode was used, add to limitations: "Spoken delivery, pacing, and verbal fluency were not assessed (chat mode)."
4. If the interview ended early, mark unassessed dimensions as "Not Assessed".
5. The sevenDayPracticePlan must have 5-7 concrete, actionable items.
6. resumeJdFit must flag gaps cautiously — phrase as "possible gaps" or "areas to clarify", not accusations.

Return ONLY valid JSON matching this exact schema. No markdown fences, no explanation outside JSON:
{
  "metadata": {
    "stage": "${stage}",
    "targetLevel": "${targetLevel}",
    "mode": "${mode}",
    "completedMainQuestions": ${completedMainQuestions},
    "endedEarly": ${endedEarly},
    "generatedAtIso": "${new Date().toISOString()}"
  },
  "overall": {
    "score": 1|2|3|4,
    "recommendation": "Strong Hire"|"Hire"|"No Hire"|"Strong No Hire",
    "summary": "2-3 sentence summary grounded in what was said"
  },
  "dimensionScores": [
    {
      "dimension": "AI Product Sense & Strategy",
      "score": 1|2|3|4|"Not Assessed",
      "evidence": ["specific quote or paraphrase from transcript", ...],
      "strengths": ["specific strength observed", ...],
      "improvementAreas": ["specific gap observed", ...],
      "practiceNext": ["concrete action to practice this", ...]
    }
    // ... repeat for all 6 dimensions
  ],
  "resumeJdFit": {
    "alignmentSummary": "how resume experience aligns with JD",
    "possibleDiscrepanciesOrGaps": ["possible gap 1", ...],
    "roleSpecificRisks": ["risk 1", ...]
  },
  "candidateQuestionsFeedback": {
    "assessment": "assessment of the quality and relevance of candidate questions",
    "betterQuestions": ["stronger question they could have asked", ...]
  },
  "topStrengths": ["top 3 strengths observed across the interview"],
  "topImprovementAreas": ["top 3 areas to improve"],
  "sevenDayPracticePlan": ["day 1 action", "day 2 action", ...],
  "limitations": ["limitation 1", ...]
}`;
}

export const JSON_REPAIR_PROMPT = `The following text is supposed to be valid JSON matching an AssessmentReport schema but is malformed. Repair it to be valid JSON. Do not add new substantive content — only fix the JSON structure. Return ONLY the repaired JSON, no explanation.

MALFORMED JSON:
`;
