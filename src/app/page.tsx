export default function HomePage() {
  return (
    <main style={{ maxWidth: 800, margin: '50px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>PirateXPlay API</h1>
      <p>Unofficial REST API for PirateXPlay</p>
      <h2>Endpoints</h2>
      <ul>
        <li><code>GET /api/home</code> - Latest Series, Latest Movies, Networks, Languages</li>
        <li><code>GET /api/search?q=one piece</code> - Search anime/movies</li>
        <li><code>GET /api/info?id=one-piece-season-1-37854</code> - Series/movie details + episodes</li>
        <li><code>GET /api/episodes?id=one-piece-season-1-37854</code> - Episode list only</li>
        <li><code>GET /api/watch?id=one-piece-season-1-37854-1x1</code> - Video server sources</li>
        <li><code>GET /api/providers</code> - Known embed providers</li>
      </ul>
      <h3>Rate Limiting</h3>
      <p>All endpoints are rate-limited. Check <code>X-RateLimit-Remaining</code> headers.</p>
      <h3>Source</h3>
      <p><a href="https://piratexplay.cc" target="_blank" rel="noreferrer">PirateXPlay</a></p>
    </main>
  );
}
