import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

const apiKey = process.env.GOOGLE_GENAI_API_KEY || "";

if (!apiKey) {
  console.warn("GOOGLE_GENAI_API_KEY is missing. Gemini client not initialized.");
}

export const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
export const fileManager = apiKey ? new GoogleAIFileManager(apiKey) : null;

export const model = genAI ? genAI.getGenerativeModel({
  model: "gemini-3.1-flash-lite-preview",
}) : null as any;

export async function uploadVideo(filePath: string, displayName: string) {
  if (!fileManager) {
    throw new Error("Gemini File Manager not initialized. Check API key.");
  }
  const uploadResponse = await fileManager.uploadFile(filePath, {
    mimeType: "video/mp4",
    displayName: displayName,
  });

  console.log(`Uploaded file ${uploadResponse.file.displayName} as: ${uploadResponse.file.uri}`);

  let file = await fileManager.getFile(uploadResponse.file.name);
  await new Promise<void>((resolve) => setTimeout(() => resolve(), 5_000)); // Initial wait
  
  while (file.state === FileState.PROCESSING) {
    process.stdout.write(".");
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 10_000));
    file = await fileManager.getFile(uploadResponse.file.name);
  }

  if (file.state === FileState.FAILED) {
    console.error("Gemini File Processing Failed:", file);
    throw new Error(`Video processing failed. State: ${file.state}`);
  }

  console.log(`File ${file.displayName} is ready for inference: ${file.uri}`);
  return file;
}

export async function summarizeTranscript(transcript: string) {
  if (!model) throw new Error("Gemini model not initialized.");
  
  const prompt = `Fasse die Hauptthemen dieser Tagesschau-Sendung basierend auf dem folgenden Transkript präzise zusammen.
  Nenne die wichtigsten 3-4 Meldungen als Bullet-Points.
  Erhöhe die Detailtiefe. 
  Antworte auf Deutsch.
  
  Transkript:
  ${transcript}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function deleteFile(fileName: string) {
  if (!fileManager) return;
  await fileManager.deleteFile(fileName);
}
