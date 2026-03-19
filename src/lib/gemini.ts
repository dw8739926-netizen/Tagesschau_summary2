import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

const apiKey = process.env.GOOGLE_GENAI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

export const model = genAI.getGenerativeModel({
  model: "gemini-3.1-flash-lite-preview",
});

export async function uploadVideo(filePath: string, displayName: string) {
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

export async function deleteFile(fileName: string) {
  await fileManager.deleteFile(fileName);
}
