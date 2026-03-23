// src/components/HomeScreen.jsx

export default function HomeScreen({ onHost, onPlayer }) {
  return (
    <div className="screen home-screen">
      <div className="home-content">
        <h1 className="home-title">CYBER SECURITY AWARENESS</h1>
        <p className="home-subtitle">Live exhibition challenge</p>
        <div className="home-buttons">
          <button className="btn btn-host" onClick={onHost}>
            <span className="btn-icon">📺</span>
            Host Mode
            <span className="btn-hint">For laptop / TV</span>
          </button>
          <button className="btn btn-player" onClick={onPlayer}>
            <span className="btn-icon">📱</span>
            Player Mode
            <span className="btn-hint">For phones</span>
          </button>
        </div>
      </div>
    </div>
  );
}
