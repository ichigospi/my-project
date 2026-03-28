import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { topic, sectionName, sectionDescription, templateName, aiApiKey } = body;

  if (aiApiKey) {
    // Detect API type and call accordingly
    const isAnthropic = aiApiKey.startsWith("sk-ant-");

    try {
      if (isAnthropic) {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": aiApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: `You are a script writer for a fortune-telling/spiritual YouTube channel.

Template: ${templateName}
Section: ${sectionName}
Section purpose: ${sectionDescription}
Topic: ${topic}

Write the script content for this section. Be engaging, mystical, and authentic.
Write in a warm, conversational tone. Include specific details related to the topic.
Output ONLY the script text, no headers or labels.`,
              },
            ],
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          return NextResponse.json({ error: error.error?.message || "API error" }, { status: res.status });
        }

        const data = await res.json();
        const text = data.content?.[0]?.text || "";
        return NextResponse.json({ text });
      } else {
        // OpenAI compatible
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${aiApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "You are a script writer for a fortune-telling/spiritual YouTube channel. Write engaging, mystical, authentic content.",
              },
              {
                role: "user",
                content: `Template: ${templateName}\nSection: ${sectionName}\nPurpose: ${sectionDescription}\nTopic: ${topic}\n\nWrite the script for this section. Output ONLY the script text.`,
              },
            ],
            max_tokens: 1024,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          return NextResponse.json({ error: error.error?.message || "API error" }, { status: res.status });
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        return NextResponse.json({ text });
      }
    } catch (error) {
      return NextResponse.json({ error: "Failed to generate script" }, { status: 500 });
    }
  }

  // Fallback: return a template-based response
  return NextResponse.json({
    text: `[AI generation requires an API key. Configure it in Settings.]\n\nSuggested content for "${sectionName}" about "${topic}":\n${sectionDescription}`,
    mock: true,
  });
}
