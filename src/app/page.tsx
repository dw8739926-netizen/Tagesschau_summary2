import { getSummaries } from "@/lib/supabase";
import styles from "./page.module.css"; 

export const dynamic = "force-dynamic";

export default async function Home() {
  const summaries = await getSummaries();

  return (
    <main className="container">
      <header className="header">
        <h1 className="title">Tagesschau Summary</h1>
        <p className="subtitle">Die wichtigsten News präzise zusammengefasst.</p>
      </header>

      <section className="dashboard">
        {summaries.length === 0 ? (
          <div className="empty-state">
            <p>Noch keine Zusammenfassungen vorhanden.</p>
            <p className="hint">Der Cron-Job wird regelmäßig nach neuen Videos suchen.</p>
          </div>
        ) : (
          <div className="summaries-grid">
            {summaries.map((summary) => (
              <article key={summary.video_id} className="summary-card">
                <div className="card-header">
                  <span className="badge">News</span>
                  <time className="date">
                    {new Date(summary.date).toLocaleDateString('de-DE', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </time>
                </div>
                <h2 className="summary-title">{summary.title}</h2>
                <div className="summary-content">
                  {summary.summary_text}
                </div>
                <footer className="card-footer">
                  <a href={`https://youtube.com/watch?v=${summary.video_id}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">Original Video</a>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer style={{ marginTop: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        &copy; {new Date().getFullYear()} Tagesschau Summary App
      </footer>
    </main>
  );
}
