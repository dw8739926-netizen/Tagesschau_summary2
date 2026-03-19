import { getSummaries } from "@/lib/supabase";
import styles from "./page.module.css"; 

export const dynamic = "force-dynamic";

export default async function Home() {
  const summaries = await getSummaries();

  return (
    <main className="container">
      <header className="header">
        <h1>Tagesschau Summary</h1>
        <p>Automatisierte Video-Zusammenfassungen mit Gemini 3.1 Flash-Lite</p>
      </header>

      <div className="grid">
        {summaries.length === 0 ? (
          <div className="empty-state">
            <h3>Noch keine Zusammenfassungen vorhanden.</h3>
            <p>Der Cron-Job wird regelmäßig nach neuen Videos suchen.</p>
          </div>
        ) : (
          summaries.map((summary) => (
            <article key={summary.video_id} className="card">
              <div className="card-date">{new Date(summary.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              <h2 className="card-title">{summary.title}</h2>
              <div className="card-text">{summary.summary_text}</div>
            </article>
          ))
        )}
      </div>

      <footer style={{ marginTop: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        &copy; {new Date().getFullYear()} Tagesschau Summary App
      </footer>
    </main>
  );
}
