import { NextRequest, NextResponse } from "next/server";
import { getLatestVideosFromPlaylist } from "@/lib/youtube";
import { isVideoProcessed, saveSummary, supabase } from "@/lib/supabase";
import { uploadVideo, model, deleteFile } from "@/lib/gemini";
import { sendSummaryEmail } from "@/lib/resend";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export const maxDuration = 60; // As requested

export async function GET(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client not initialized. Check environment variables." }, { status: 500 });
  }

  try {
    console.log("Starting Tagesschau Cron Job...");
    const videos = await getLatestVideosFromPlaylist();
    
    if (videos.length === 0) {
      return NextResponse.json({ message: "No videos found in playlist." });
    }

    // Process the 3 latest videos
    const candidates = videos.slice(0, 3);
    const results = [];
    let newProcessedCount = 0;

    for (const v of candidates) {
      // Vercel timeout protection: Limit to 1 per run (Gemini takes time)
      if (newProcessedCount >= 1) break;

      const alreadyProcessed = await isVideoProcessed(v.id);
      if (alreadyProcessed) {
        results.push({ id: v.id, status: "skipped", message: "Already processed" });
        continue;
      }

      console.log(`Processing new video: ${v.title} (${v.id})`);

      // 1. Setup paths
      const videoUrl = `https://www.youtube.com/watch?v=${v.id}`;
      const tempDir = path.join(os.tmpdir(), "tagesschau-temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const tempFilePath = path.join(tempDir, `${v.id}.mp4`);
      
      const isWindows = process.platform === "win32";
      const ytDlpBinary = isWindows ? "yt-dlp.exe" : "yt-dlp";
      const ytDlpSourcePath = path.join(process.cwd(), "bin", ytDlpBinary);
      let ytDlpPath = ytDlpSourcePath;

      // Ensure Linux binary is executable on Vercel
      if (!isWindows) {
        const tempBinaryPath = path.join(os.tmpdir(), "yt-dlp");
        // FIX: Always copy to overwrite any old cached versions
        fs.copyFileSync(ytDlpSourcePath, tempBinaryPath);
        fs.chmodSync(tempBinaryPath, 0o755);
        ytDlpPath = tempBinaryPath;
      }

      // 2. Download Video
      console.log(`Downloading ${v.id} (Direct MP4: ${!!v.videoUrl})...`);
      
      if (v.videoUrl) {
        try {
          const res = await fetch(v.videoUrl);
          if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
          const buffer = await res.arrayBuffer();
          fs.writeFileSync(tempFilePath, Buffer.from(buffer));
          console.log(`Direct download completed: ${tempFilePath}`);
        } catch (err: any) {
          console.warn("Direct download failed, falling back to yt-dlp:", err.message);
        }
      }

      // Fallback or secondary attempt via yt-dlp
      if (!fs.existsSync(tempFilePath) || fs.statSync(tempFilePath).size === 0) {
        const downloadResult = spawnSync(ytDlpPath, [
          "-f", "best[height<=720][ext=mp4]/best",
          "--merge-output-format", "mp4",
          "--extractor-args", "youtube:player_client=android,web",
          "-o", tempFilePath,
          videoUrl
        ], { encoding: "utf-8" });

        if (!fs.existsSync(tempFilePath) || fs.statSync(tempFilePath).size === 0) {
          const errorDetail = downloadResult.stderr || downloadResult.error?.message || "Unknown error";
          console.error(`Download failed for ${v.id}:`, errorDetail);
          results.push({ 
            id: v.id, 
            status: "failed", 
            error: "Download failed", 
            detail: errorDetail,
            exitCode: downloadResult.status 
          });
          continue;
        }
      }

      // 3. Upload to Gemini
      console.log(`Uploading ${v.id} to Gemini...`);
      const geminiFile = await uploadVideo(tempFilePath, v.title);
      
      // 4. Generate Summary
      console.log(`Analyzing ${v.id}...`);
      const prompt = `Fasse die Hauptthemen dieser Tagesschau-Sendung präzise auf Deutsch zusammen. 
      Erhöhe die Detailtiefe. Nenne die wichtigsten 3-4 Meldungen als Bullet-Points. 
      Füge am Ende eine kurze visuelle Beschreibung der markantesten Szene hinzu.`;

      const analysisResult = await model.generateContent([
        { fileData: { mimeType: geminiFile.mimeType, fileUri: geminiFile.uri } },
        { text: prompt },
      ]);

      const summaryText = analysisResult.response.text();

      // 5. Save & Notify
      const summaryData = {
        video_id: v.id,
        title: v.title,
        date: v.published,
        summary_text: summaryText,
      };
      
      await saveSummary(summaryData);

      const htmlEmail = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #003366;">Tagesschau Zusammenfassung</h2>
          <hr/>
          <h3>${v.title}</h3>
          <div style="white-space: pre-wrap; line-height: 1.6;">${summaryText}</div>
          <hr/>
          <p style="font-size: 11px; color: #999;">Automatischer Service - Tagesschau Summary App</p>
        </div>
      `;
      
      await sendSummaryEmail(v.title, htmlEmail);
      
      // 6. Cleanup
      await deleteFile(geminiFile.name);
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      
      results.push({ id: v.id, status: "success", title: v.title });
      newProcessedCount++;
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ 
      error: error.message || "Unknown error",
      stack: error.stack,
      cause: error.cause
    }, { status: 500 });
  }
}
