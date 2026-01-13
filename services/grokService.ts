// Simple Grok API Wrapper
export const askGrok = async (systemPrompt: string, userMessage: string, apiKey: string) => {
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        model: "grok-beta", // Or latest supported model
        stream: false,
        temperature: 0.5,
      }),
    });

    const data = await response.json();
    return data.choices[0]?.message?.content;
  } catch (error) {
    console.error("Grok API Error:", error);
    return null;
  }
};