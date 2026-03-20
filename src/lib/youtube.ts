export interface YouTubeVideo {
  id: string;
  title: string;
  published: string;
  videoUrl?: string; // Direct MP4 link
}

export async function getLatestVideosFromPlaylist(): Promise<YouTubeVideo[]> {
  const rssUrl = `https://www.tagesschau.de/multimedia/sendung/tagesschau_20_uhr/podcast-ts2000-video-100~podcast.xml`;

  try {
    const response = await fetch(rssUrl);
    const text = await response.text();

    const entries = text.split("<item>").slice(1);
    
    return entries.map((entry) => {
      const id = entry.match(/<guid>([^<]+)<\/guid>/)?.[1] || "";
      const title = entry.match(/<title>([^<]+)<\/title>/)?.[1] || "";
      const published = entry.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] || "";
      const videoUrl = entry.match(/<enclosure url="([^"]+)"/)?.[1] || "";
      
      return { id, title, published, videoUrl };
    }).filter(v => v.videoUrl);
  } catch (error) {
    console.error("Error fetching Tagesschau RSS:", error);
    return [];
  }
}
