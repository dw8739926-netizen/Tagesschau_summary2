export interface YouTubeVideo {
  id: string;
  title: string;
  published: string;
  description: string;
}

export async function getLatestVideosFromPlaylist(): Promise<YouTubeVideo[]> {
  const playlistId = "PL4A2F331EE86DCC22";
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    console.error("YOUTUBE_API_KEY is missing.");
    return [];
  }

  const apiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=5&playlistId=${playlistId}&key=${apiKey}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!data.items) {
      console.error("YouTube API Error:", data);
      return [];
    }

    return data.items.map((item: any) => ({
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      published: item.snippet.publishedAt,
      description: item.snippet.description || ""
    }));
  } catch (error) {
    console.error("Error fetching YouTube API:", error);
    return [];
  }
}
