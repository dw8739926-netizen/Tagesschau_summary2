export interface YouTubeVideo {
  id: string;
  title: string;
  published: string;
}

export async function getLatestVideosFromPlaylist(): Promise<YouTubeVideo[]> {
  const playlistId = "PL4A2F331EE86DCC22";
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;

  try {
    const response = await fetch(rssUrl);
    const text = await response.text();

    // Basic regex-based XML parsing to avoid large dependencies like fast-xml-parser
    const entries = text.split("<entry>").slice(1);
    
    return entries.map((entry) => {
      const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || "";
      const title = entry.match(/<title>([^<]+)<\/title>/)?.[1] || "";
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] || "";
      
      return { id, title, published };
    }).filter(v => v.id);
  } catch (error) {
    console.error("Error fetching YouTube RSS:", error);
    return [];
  }
}
