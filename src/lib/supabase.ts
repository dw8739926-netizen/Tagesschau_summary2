import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase environment variables are missing. Client not initialized.");
}

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface TagesschauSummary {
  video_id: string; // YouTube Video ID
  title: string;
  date: string;
  summary_text: string;
  processed_at?: string;
}

export async function isVideoProcessed(videoId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("tagesschau_summaries_v2")
    .select("video_id")
    .eq("video_id", videoId)
    .single();

  if (error && error.code !== "PGRST116") { // PGRST116 is "no rows returned"
    console.error("Error checking video status:", error);
  }

  return !!data;
}

export async function saveSummary(summary: TagesschauSummary) {
  if (!supabase) return;
  const { error } = await supabase
    .from("tagesschau_summaries_v2")
    .upsert({
      video_id: summary.video_id,
      title: summary.title,
      date: summary.date,
      summary_text: summary.summary_text,
    });

  if (error) {
    console.error("Error saving summary to Supabase:", error);
    throw error;
  }
}

export async function getSummaries(): Promise<TagesschauSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tagesschau_summaries_v2")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching summaries from Supabase:", error);
    return [];
  }

  return data || [];
}
