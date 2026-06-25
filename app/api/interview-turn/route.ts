import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  buildInterviewerSystemPrompt,
  buildInterviewTurnDecisionPrompt,
  STAGE_QUESTION_PLANS,
} from "@/lib/prompts";
import { InterviewStage, InterviewTurn, InterviewTurnResponse } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      stage,
      targetLevel,
      resumeText,
      jdText,
      importedPriorAssessment,
      turns,
      currentMainQuestionIndex,
      followUpsUsedForCurrentQuestion,
    }: {
      stage: InterviewStage;
      targetLevel: string;
      resumeText: string;
      jdText: string;
      importedPriorAssessment?: string;
      turns: InterviewTurn[];
      currentMainQuestionIndex: number;
      followUpsUsedForCurrentQuestion: number;
    } = body;

    const plannedCategories = STAGE_QUESTION_PLANS[stage];
    const maxMainQuestions = stage === "recruiter_screen" ? 4 : 5;

    const systemPrompt = buildInterviewerSystemPrompt({
      stage,
      targetLevel,
      resumeText,
      jdText,
      importedPriorAssessment,
    });

    const decisionPrompt = buildInterviewTurnDecisionPrompt({
      stage,
      targetLevel,
      plannedCategories,
      currentMainQuestionIndex,
      followUpsUsed: followUpsUsedForCurrentQuestion,
      totalTurns: turns.length,
      turnsJson: JSON.stringify(
        turns.map((t) => ({ role: t.role, content: t.content })),
        null,
        2
      ),
      maxMainQuestions,
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0.3,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        } as Parameters<typeof client.messages.create>[0]["system"] extends Array<infer T> ? T : never,
      ],
      messages: [{ role: "user", content: decisionPrompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    let parsed: InterviewTurnResponse;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse model response", raw: rawText },
        { status: 500 }
      );
    }

    // Strip internal fields before sending to client
    const { ...safeResponse } = parsed;
    return NextResponse.json(safeResponse);
  } catch (err) {
    console.error("interview-turn error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
