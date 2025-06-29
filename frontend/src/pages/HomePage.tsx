import "./HomePage.css";
import ActiveConnections from "../components/ActiveConnections";

function HomePage() {
  return (
    // Keep the .page class for general layout, add .home-page for specific styles
    <div className="page home-page">
      <h1>Welcome to WEBwhiteboard</h1>
      <p>
        Your collaborative space for organizing links and notes on shared
        boards.
      </p>
      <div style={{ marginTop: '20px' }}>
        <ActiveConnections />
      </div>
      {/* You could add a link to login or dashboard here later */}
      {/* <p><a href="/login">Get Started</a></p> */}
    </div>
  );
}

export default HomePage;
