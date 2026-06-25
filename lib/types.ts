export type InterviewStage =
  | "not_yet_applied"
  | "recruiter_screen"
  | "hm_screen"
  | "team_interviews"
  | "tech_stakeholder"
  | "design_stakeholder"
  | "business_stakeholder"
  | "ceo_cpo_final";

export type QuestionCategory =
  | "career_narrative"
  | "motivation_role_fit"
  | "ai_product_sense_strategy"
  | "execution_metrics"
  | "ai_ml_technical_judgment"
  | "design_user_empathy"
  | "business_gtm_monetization"
  | "leadership_behavioral"
  | "resume_jd_deep_dive"
  | "candidate_questions";

export type AppStatus =
  | "ONBOARDING"
  | "CONTEXT_READY"
  | "MODE_SELECTED"
  | "INTERVIEW_IN_PROGRESS"
  | "CANDIDATE_QUESTIONS"
  | "GENERATING_ASSESSMENT"
  | "REPORT_READY";

export interface InterviewTurn {
  role: "interviewer" | "candidate";
  content: string;
  questionCategory?: QuestionCategory;
  timestamp: string;
}

export interface InterviewTurnResponse {
  type: "question" | "follow_up" | "move_to_candidate_questions" | "end_interview";
  questionText?: string;
  questionCategory?: QuestionCategory;
  interviewerRole: string;
  shouldIncrementMainQuestion: boolean;
  limitationNote?: string;
}

export interface DimensionScore {
  dimension: string;
  score: 1 | 2 | 3 | 4 | "Not Assessed";
  evidence: string[];
  strengths: string[];
  improvementAreas: string[];
  practiceNext: string[];
}

export interface AssessmentReport {
  metadata: {
    stage: InterviewStage;
    targetLevel: "PM" | "Senior PM";
    mode: "chat" | "voice";
    completedMainQuestions: number;
    endedEarly: boolean;
    generatedAtIso: string;
  };
  overall: {
    score: 1 | 2 | 3 | 4;
    recommendation: "Strong Hire" | "Hire" | "No Hire" | "Strong No Hire";
    summary: string;
  };
  dimensionScores: DimensionScore[];
  resumeJdFit: {
    alignmentSummary: string;
    possibleDiscrepanciesOrGaps: string[];
    roleSpecificRisks: string[];
  };
  candidateQuestionsFeedback: {
    assessment: string;
    betterQuestions: string[];
  };
  topStrengths: string[];
  topImprovementAreas: string[];
  sevenDayPracticePlan: string[];
  limitations: string[];
}

export interface SessionState {
  resumeText: string;
  jdText: string;
  importedPriorAssessment?: string;
  stage: InterviewStage;
  targetLevel: "PM" | "Senior PM";
  mode: "chat" | "voice";
  voicePermission: "unknown" | "granted" | "denied" | "unavailable";
  status: AppStatus;
  turns: InterviewTurn[];
  plannedQuestionCategories: QuestionCategory[];
  currentMainQuestionIndex: number;
  followUpsUsedForCurrentQuestion: number;
  rudeWarningCount: number;
  hintCount: number;
  suspectedLiveInterviewFlag: boolean;
  startedAtIso: string;
  endedAtIso?: string;
  candidateQuestions?: string;
  assessment?: AssessmentReport;
}
