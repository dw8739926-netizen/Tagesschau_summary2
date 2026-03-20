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

      // 1. HIGH-SPEED TEXT PROCESSING (Vercel-Safe < 5s)
      console.log(`Processing text-based summary for ${v.id}...`);

      let summaryText = "";
      try {
        const { summarizeTranscript } = await import("@/lib/gemini");
        
        // Use the combined Title and Description for the summary
        const contentToAnalyze = `
          Titel: ${v.title}
          Beschreibung: ${v.description}
        `;
        
        summaryText = await summarizeTranscript(contentToAnalyze);
        console.log(`Summary generated from metadata!`);
      } catch (err: any) {
        console.error(`Gemini Text Analysis failed for ${v.id}:`, err.message);
        results.push({ id: v.id, status: "failed", error: "Text analysis failed" });
        continue;
      }

      if (!summaryText) {
        results.push({ id: v.id, status: "failed", error: "Could not generate summary from metadata." });
        continue;
      }

      // Save & Notify
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
