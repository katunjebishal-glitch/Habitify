import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getAIHabitAdvice(prompt: string, language: string = 'English') {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: `You are an expert habit coach and productivity specialist. Provide concise, actionable advice on habit optimization, goal setting, and maintaining streaks. Use a motivational and supportive tone. Please respond in ${language}.`,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm sorry, I'm having trouble connecting to my AI brain right now. Please try again later!";
  }
}
