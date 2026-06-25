import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { buildAssessmentPrompt } from "@/lib/prompts";
import { AssessmentReport, InterviewStage, InterviewTurn } from "@/lib/types";

// Streaming keeps the connection alive on Vercel Hobby (no 60s timeout on streaming responses)
export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseAssessment(text: string): AssessmentReport | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text) as AssessmentReport;
  } catch {
    return null;
  }
}

async function streamToString(prompt: string): Promise<string> {
  let result = "";
  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    temperature: 0.1,
    messages: [{ role: "user", content: prompt }],
  });
  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      result += chunk.delta.text;
    }
  }
  return result;
}

export async function POST(req: NextRequest) {
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

  // Stream tokens from the model; flush each chunk to the client so Vercel
  // sees continuous activity and doesn't cut the connection at 60s.
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let rawText = "";

        const modelStream = await client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          temperature: 0.1,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const chunk of modelStream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            rawText += chunk.delta.text;
            // Send a space so Vercel's proxy sees activity and doesn't cut at 60s.
            // The final JSON is sent after the loop; parseAssessment strips leading whitespace.
            controller.enqueue(encoder.encode(" "));
          }
        }

        let assessment = parseAssessment(rawText);

        // Repair pass if JSON is malformed
        if (!assessment) {
          const repairPrompt = `The following text is supposed to be valid JSON matching an AssessmentReport schema but is malformed. Repair it to be valid JSON. Do not add new substantive content. Return ONLY the repaired JSON:\n\n${rawText}`;
          rawText = await streamToString(repairPrompt);
          assessment = parseAssessment(rawText);
        }

        if (!assessment) {
          controller.enqueue(
            encoder.encode(JSON.stringify({ error: "Could not generate valid assessment JSON after repair attempt." }))
          );
        } else {
          controller.enqueue(encoder.encode(JSON.stringify(assessment)));
        }
      } catch (err) {
        console.error("generate-assessment error:", err);
        controller.enqueue(encoder.encode(JSON.stringify({ error: "Internal server error" })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
      "X-Accel-Buffering": "no", // disable Nginx buffering on Vercel
    },
  });
}
