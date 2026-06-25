import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { buildAssessmentPrompt } from "@/lib/prompts";
import { AssessmentReport, InterviewStage, InterviewTurn } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callModel(prompt: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    temperature: 0.1,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

function parseAssessment(text: string): AssessmentReport | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text) as AssessmentReport;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      stage,
      targetLevel,
      mode,
      resumeText,
      jdText,
      turns,
      candidateQuestions,
      completedMainQuestions,
      endedEarly,
      hintCount,
      voicePermission,
    }: {
      stage: InterviewStage;
      targetLevel: string;
      mode: string;
      resumeText: string;
      jdText: string;
      turns: InterviewTurn[];
      candidateQuestions?: string;
      completedMainQuestions: number;
      endedEarly: boolean;
      hintCount: number;
      voicePermission: string;
    } = body;

    const limitations: string[] = [];
    if (mode === "chat") {
      limitations.push("Spoken delivery, pacing, and verbal fluency were not assessed (chat mode).");
    }
    if (voicePermission === "denied") {
      limitations.push("Microphone permission was denied; voice flow could not be assessed.");
    }
    if (endedEarly) {
      limitations.push(`Interview ended early after ${completedMainQuestions} main question(s). Some dimensions may be Not Assessed.`);
    }
    if (hintCount > 0) {
      limitations.push(`Candidate requested ${hintCount} hint(s) during the interview.`);
    }

    const prompt = buildAssessmentPrompt({
      stage,
      targetLevel,
      mode,
      resumeText,
      jdText,
      turnsJson: JSON.stringify(
        turns.map((t) => ({ role: t.role, content: t.content })),
        null,
        2
      ),
      candidateQuestions,
      completedMainQuestions,
      endedEarly,
      limitations,
    });

    let rawText = await callModel(prompt);
    let assessment = parseAssessment(rawText);

    if (!assessment) {
      // Retry with repair
      const repairPrompt = `The following text is supposed to be valid JSON matching an AssessmentReport schema but is malformed. Repair it to be valid JSON. Do not add new substantive content. Return ONLY the repaired JSON:\n\n${rawText}`;
      rawText = await callModel(repairPrompt);
      assessment = parseAssessment(rawText);
    }

    if (!assessment) {
      return NextResponse.json(
        { error: "Could not generate valid assessment JSON after repair attempt.", raw: rawText },
        { status: 500 }
      );
    }

    return NextResponse.json(assessment);
  } catch (err) {
    console.error("generate-assessment error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
