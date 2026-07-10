import { useEffect, useState } from "react";
import axios from "axios";

const API = "/api";

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("theme");
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const fetchByCity = async (q) => {
    if (!q) return;
    setLoading(true);
    setError("");
    try {
      const [w, f] = await Promise.all([
        axios.get(`${API}/weather/city/${encodeURIComponent(q)}`),
        axios.get(`${API}/forecast/city/${encodeURIComponent(q)}`),
      ]);
      setWeather(w.data);
      setForecast(f.data);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to fetch weather");
      setWeather(null);
      setForecast(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchByCoords = async (lat, lon) => {
    setLoading(true);
    setError("");
    try {
      const [w, f] = await Promise.all([
        axios.get(`${API}/weather/coords`, { params: { lat, lon } }),
        axios.get(`${API}/forecast/coords`, { params: { lat, lon } }),
      ]);
      setWeather(w.data);
      setForecast(f.data);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to fetch weather");
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
      () => setError("Unable to retrieve your location")
    );
  };

  useEffect(() => {
    useMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchByCity(city.trim());
  };

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <div className="app">
      <p>This is para tag</p>
      <div className="container">
        <header className="topbar">
          <div className="brand">
            <span className="brand-dot" />
            <span>Breeze</span>
          </div>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </header>

        <h1>How's the sky today?</h1>
        <p className="subtitle">
          Search any city or use your location for a fresh look at the weather.
        </p>

        <form className="search" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Search a city..."
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
          <button type="button" className="btn" id="button" onClick={useMyLocation}>
            My location
          </button>
        </form>

        
        {error && <p className="error">{error}</p>}

        {weather && (
          <div className="card current">
            <div className="location">
              {weather.name}
              {weather.sys?.country ? `, ${weather.sys.country}` : ""}
            </div>
            <div className="current-main">
              <div>
                <div className="temp">
                  {Math.round(weather.main.temp)}
                  <sup>°C</sup>
                </div>
                <div className="desc">{weather.weather[0].description}</div>
              </div>
              <img
                src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
                alt={weather.weather[0].description}
              />
            </div>
            <div className="details">
              <div>
                <div className="detail-label">Feels like</div>
                <div className="detail-value">
                  {Math.round(weather.main.feels_like)}°
                </div>
              </div>
              <div>
                <div className="detail-label">Humidity</div>
                <div className="detail-value">{weather.main.humidity}%</div>
              </div>
              <div>
                <div className="detail-label">Wind</div>
                <div className="detail-value">{weather.wind.speed} m/s</div>
              </div>
              <div>
                <div className="detail-label">Pressure</div>
                <div className="detail-value">{weather.main.pressure}</div>
              </div>
            </div>
          </div>
        )}

        {forecast && (
          <>
            <div className="section-title">5-Day Forecast</div>
            <div className="forecast-grid">
              {forecast.daily.map((d) => (
                <div key={d.date} className="forecast-card">
                  <div className="date">
                    {new Date(d.date).toLocaleDateString(undefined, {
                      weekday: "short",
                    })}
                  </div>
                  <img
                    src={`https://openweathermap.org/img/wn/${d.icon}@2x.png`}
                    alt={d.description}
                  />
                  <div className="range">
                    <strong>{Math.round(d.max)}°</strong>{" "}
                    <span className="low">{Math.round(d.min)}°</span>
                  </div>
                  <div className="desc small">{d.description}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
