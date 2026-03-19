import { NextRequest, NextResponse } from "next/server";
import { getLatestVideosFromPlaylist } from "@/lib/youtube";
import { isVideoProcessed, saveSummary } from "@/lib/supabase";
import { uploadVideo, model, deleteFile } from "@/lib/gemini";
import { sendSummaryEmail } from "@/lib/resend";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export const maxDuration = 60; // As requested

export async function GET(req: NextRequest) {
  // In production, add a CRON_SECRET check here for security
  
  try {
    console.log("Starting Tagesschau Cron Job...");
    const videos = await getLatestVideosFromPlaylist();
    
    // Process only the latest video for the cron run to avoid timeouts
    const latestVideo = videos[0];
    
    if (!latestVideo) {
      return NextResponse.json({ message: "No videos found in playlist." });
    }

    const processed = await isVideoProcessed(latestVideo.id);
    if (processed) {
      return NextResponse.json({ message: `Video ${latestVideo.id} already processed.` });
    }

    console.log(`Processing new video: ${latestVideo.title} (${latestVideo.id})`);

    // 1. Download Video to local temp folder using yt-dlp.exe
    const videoUrl = `https://www.youtube.com/watch?v=${latestVideo.id}`;
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = path.join(tempDir, `${latestVideo.id}.mp4`);
    const ytDlpPath = path.join(process.cwd(), "bin", "yt-dlp.exe");
    
    console.log(`Working Directory: ${process.cwd()}`);
    console.log(`yt-dlp Path: ${ytDlpPath}`);
    
    if (!fs.existsSync(ytDlpPath)) {
      throw new Error(`yt-dlp.exe not found at ${ytDlpPath}`);
    }

    // Clean up any existing file from previous failed attempts
    if (fs.existsSync(tempFilePath)) {
      console.log(`Deleting existing temp file: ${tempFilePath}`);
      fs.unlinkSync(tempFilePath);
    }

    console.log(`Downloading video via yt-dlp to ${tempFilePath}...`);

    const resultDownload = spawnSync(ytDlpPath, [
      "--force-overwrites",
      "-f", "best[height<=720][ext=mp4]/best",
      "-o", tempFilePath,
      videoUrl
    ], { encoding: "utf-8" });

    if (resultDownload.stdout) console.log("yt-dlp stdout:", resultDownload.stdout);
    if (resultDownload.stderr) console.log("yt-dlp stderr:", resultDownload.stderr);

    if (resultDownload.error || resultDownload.status !== 0) {
      const errorMsg = resultDownload.stderr || resultDownload.error?.message || "Unknown error";
      console.error("yt-dlp error:", errorMsg);
      throw new Error(`Failed to download video: ${errorMsg}`);
    }

    const stats = fs.statSync(tempFilePath);
    if (stats.size === 0) {
      throw new Error("Downloaded file is empty (0 bytes).");
    }
    console.log(`Download complete (${(stats.size / 1024 / 1024).toFixed(2)} MB). Uploading to Google File API...`);

    // 2. Upload to Google File API
    const googleFile = await uploadVideo(tempFilePath, latestVideo.title);

    // 3. Delete temporary local file immediately
    fs.unlinkSync(tempFilePath);

    // 4. Gemini Analysis
    console.log("Requesting Gemini analysis...");
    const prompt = "Fasse die Themen dieser Nachrichtensendung detailliert zusammen. Füge außerdem zu jedem Thema eine visuelle Beschreibung der gezeigten Bilder oder Grafiken hinzu.";
    
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: googleFile.mimeType,
          fileUri: googleFile.uri,
        },
      },
      { text: prompt },
    ]);

    const summaryText = result.response.text();
    console.log("Summary generated.");

    // 5. Save to Supabase
    const summaryData = {
      video_id: latestVideo.id,
      title: latestVideo.title,
      date: latestVideo.published,
      summary_text: summaryText,
    };
    
    await saveSummary(summaryData);

    // 6. Send Email
    console.log("Sending email notification...");
    const htmlEmail = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; color: #333;">
        <h1 style="color: #003366; border-bottom: 2px solid #003366; padding-bottom: 10px;">Tagesschau Zusammenfassung</h1>
        <h2>${latestVideo.title}</h2>
        <p style="color: #666;">Datum: ${new Date(latestVideo.published).toLocaleString('de-DE')}</p>
        <hr />
        <div style="line-height: 1.6; white-space: pre-wrap;">
          ${summaryText}
        </div>
        <hr />
        <p style="font-size: 12px; color: #999;">Diese E-Mail wurde automatisch generiert.</p>
      </div>
    `;
    
    await sendSummaryEmail(latestVideo.title, htmlEmail);

    // 7. Cleanup Google File
    await deleteFile(googleFile.name);

    return NextResponse.json({ success: true, videoId: latestVideo.id });

  } catch (error: any) {
    console.error("Cron Job Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
