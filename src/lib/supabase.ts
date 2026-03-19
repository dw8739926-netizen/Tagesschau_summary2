import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface TagesschauSummary {
  video_id: string; // YouTube Video ID
  title: string;
  date: string;
  summary_text: string;
  processed_at?: string;
}

export async function isVideoProcessed(videoId: string): Promise<boolean> {
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
