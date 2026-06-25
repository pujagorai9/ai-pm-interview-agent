import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { buildAssessmentPrompt } from "@/lib/prompts";
import { InterviewStage, InterviewTurn } from "@/lib/types";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    stage, targetLevel, mode, resumeText, jdText, turns,
    candidateQuestions, completedMainQuestions, endedEarly, hintCount, voicePermission,
  }: {
    stage: InterviewStage; targetLevel: string; mode: string;
    resumeText: string; jdText: string; turns: InterviewTurn[];
    candidateQuestions?: string; completedMainQuestions: number;
    endedEarly: boolean; hintCount: number; voicePermission: string;
  } = body;

  const limitations: string[] = [];
  if (mode === "chat") limitations.push("Spoken delivery, pacing, and verbal fluency were not assessed (chat mode).");
  if (voicePermission === "denied") limitations.push("Microphone permission was denied; voice flow could not be assessed.");
  if (endedEarly) limitations.push(`Interview ended early after ${completedMainQuestions} main question(s). Some dimensions may be Not Assessed.`);
  if (hintCount > 0) limitations.push(`Candidate requested ${hintCount} hint(s) during the interview.`);

  const prompt = buildAssessmentPrompt({
    stage, targetLevel, mode, resumeText, jdText,
    turnsJson: JSON.stringify(turns.map((t) => ({ role: t.role, content: t.content })), null, 2),
    candidateQuestions, completedMainQuestions, endedEarly, limitations,
  });

  const encoder = new TextEncoder();

  // Stream SSE events so the browser sees progress and Vercel stays alive
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }

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
            // Stream each token to the client so it sees live progress
            send("token", JSON.stringify(chunk.delta.text));
          }
        }

        // Try to parse the accumulated JSON
        let assessment = tryParse(rawText);

        if (!assessment) {
          send("status", JSON.stringify("Repairing JSON…"));
          const repair = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            temperature: 0,
            messages: [{
              role: "user",
              content: `Repair this malformed JSON to match the AssessmentReport schema. Return ONLY valid JSON:\n\n${rawText}`,
            }],
          });
          const repaired = repair.content[0].type === "text" ? repair.content[0].text : "";
          assessment = tryParse(repaired);
        }

        if (!assessment) {
          send("error", JSON.stringify("Could not generate a valid assessment. Please try again."));
        } else {
          send("done", JSON.stringify(assessment));
        }
      } catch (err) {
        console.error("generate-assessment error:", err);
        send("error", JSON.stringify("Server error generating assessment. Please try again."));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function tryParse(text: string) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}
