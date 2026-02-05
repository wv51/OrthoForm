import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AICreatedQuestion {
  label: string;
  hint: string;
  type: 'text' | 'choice' | 'rating' | 'checkboxes' | 'date' | 'dropdown';
  options: string[];
  required: boolean;
}

export const generateSurveyQuestions = async (topic: string): Promise<AICreatedQuestion[]> => {
  const currentApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
  if (!currentApiKey) {
    console.warn("No API Key provided for Gemini");
    return [];
  }

  const genAI = new GoogleGenerativeAI(currentApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const prompt = `Generate 5 professional survey questions for an orthopedic clinic patient survey about: "${topic}". 
  Ensure a mix of question types (text, choice, rating, checkboxes, dropdown). 
  The content MUST be in Thai language (ภาษาไทย).
  
  IMPORTANT: Return ONLY a valid JSON array. No other text, no markdown code blocks, no explanation.
  
  JSON Structure:
  [
    {
      "label": "ข้อความคำถามภาษาไทย",
      "hint": "คำอธิบายสั้นๆ (ถ้ามี)",
      "type": "text" | "choice" | "rating" | "checkboxes" | "dropdown",
      "options": ["ตัวเลือก 1", "ตัวเลือก 2"],
      "required": true
    }
  ]`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log("Gemini Response:", text);
    
    // Improved JSON extraction and cleaning
    let cleanText = text.replace(/```json\n?|```/g, '').trim();
    const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Could not find JSON array in response");
    
    const rawData = JSON.parse(jsonMatch[0]);

    return rawData.map((q: any) => ({
      label: q.label || q.text,
      hint: q.hint || "",
      type: q.type === 'yesno' ? 'choice' : (q.type || 'text'),
      options: q.type === 'yesno' ? ['ใช่', 'ไม่ใช่'] : (q.options || []),
      required: q.required !== undefined ? q.required : true
    }));

  } catch (error) {
    console.error("Error generating questions:", error);
    return [];
  }
};

export const summarizeFeedback = async (textResponses: string[]): Promise<string> => {
  const currentApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
  if (!currentApiKey || textResponses.length === 0) return "ไม่สามารถวิเคราะห์ข้อมูลได้เนื่องจากไม่มีข้อมูลคำตอบแบบข้อความ";

  const genAI = new GoogleGenerativeAI(currentApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const prompt = `สรุปความคิดเห็นของคนไข้ต่อไปนี้เป็นภาษาไทย ให้เป็นใจความสำคัญ 3 ข้อที่สั้นและกระชับ:\n\n${textResponses.join('\n')}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error summarizing feedback:", error);
    return "เกิดข้อผิดพลาดในการสรุปข้อมูล";
  }
};

export interface WordCloudItem {
  text: string;
  value: number;
}

export const extractKeywords = async (textResponses: string[]): Promise<WordCloudItem[]> => {
  const currentApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
  if (!currentApiKey || textResponses.length === 0) return [];

  const genAI = new GoogleGenerativeAI(currentApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const prompt = `Extract top 15 most frequent and meaningful keywords/phrases from the following Thai text responses. 
  Ignore common stop words. Return ONLY a valid JSON array of objects with "text" (keyword) and "value" (frequency/importance score 1-10).
  
  Responses:
  ${textResponses.join('\n')}
  
  JSON Output format:
  [{"text": "หมอใจดี", "value": 10}, {"text": "รอนาน", "value": 8}]`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    let cleanText = text.replace(/```json\n?|```/g, '').trim();
    const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Error extracting keywords:", error);
    return [];
  }
};
