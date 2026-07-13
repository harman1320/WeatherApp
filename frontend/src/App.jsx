import { useEffect, useState } from "react";
import axios from "axios";

const API = "/api";
const UNIT_KEY = "unit";
const RECENT_SEARCHES_KEY = "recentSearches";
const MAX_RECENT = 8;

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("theme");
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialUnit() {
  if (typeof window === "undefined") return "metric";
  return localStorage.getItem(UNIT_KEY) === "imperial" ? "imperial" : "metric";
}

function getInitialRecentSearches() {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => typeof item === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function formatTemp(value) {
  return `${Math.round(value)}°`;
}

function formatCityTime(unixSeconds, timezoneOffsetSeconds) {
  if (!unixSeconds && unixSeconds !== 0) return "N/A";
  const date = new Date((unixSeconds + timezoneOffsetSeconds) * 1000);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function getDaylightInfo(weather) {
  const sunrise = weather?.sys?.sunrise;
  const sunset = weather?.sys?.sunset;
  const now = weather?.dt;
  if (!sunrise || !sunset || !now || sunset <= sunrise) {
    return { percent: 0, label: "Daylight data unavailable" };
  }
  if (now < sunrise) return { percent: 0, label: "Before sunrise" };
  if (now > sunset) return { percent: 100, label: "After sunset" };
  const percent = ((now - sunrise) / (sunset - sunrise)) * 100;
  return { percent, label: "Daylight in progress" };
}

function getSuggestions({ weather, forecast, aqi }) {
  if (!weather) return [];
  const temp = weather.main?.temp;
  const wind = weather.wind?.speed ?? 0;
  const rainChance = forecast?.daily?.[0]?.pop ?? 0;
  const list = [];

  if (rainChance >= 0.6) list.push("Carry an umbrella before heading out.");
  if (temp <= 10) list.push("Wear a warm jacket.");
  else if (temp <= 20) list.push("A light jacket should be comfortable.");
  else if (temp >= 30) list.push("Use breathable clothing and stay hydrated.");
  if (wind >= 10) list.push("It is breezy, so secure loose items.");
  if (aqi >= 4) list.push("Air quality is poor, so limit intense outdoor activity.");

  if (!list.length) list.push("Great conditions for a short outdoor walk.");
  return list.slice(0, 3);
}

function addUniqueRecentCity(prev, cityName) {
  const trimmed = cityName.trim();
  if (!trimmed) return prev;
  const lower = trimmed.toLowerCase();
  const next = [trimmed, ...prev.filter((item) => item.toLowerCase() !== lower)];
  return next.slice(0, MAX_RECENT);
}

function getAqiMeta(aqi) {
  const map = {
    1: { label: "Good", className: "aqi-good" },
    2: { label: "Fair", className: "aqi-fair" },
    3: { label: "Moderate", className: "aqi-moderate" },
    4: { label: "Poor", className: "aqi-poor" },
    5: { label: "Very Poor", className: "aqi-very-poor" },
  };
  return map[aqi] || { label: "Unavailable", className: "aqi-unknown" };
}

export default function App() {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [theme, setTheme] = useState(getInitialTheme);
  const [unit, setUnit] = useState(getInitialUnit);
  const [recentSearches, setRecentSearches] = useState(getInitialRecentSearches);
  const [lastSearch, setLastSearch] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(UNIT_KEY, unit);
  }, [unit]);

  useEffect(() => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
  }, [recentSearches]);

  const fetchAqi = async (lat, lon) => {
    try {
      const { data } = await axios.get(`${API}/air/coords`, { params: { lat, lon } });
      setAqiData(data);
    } catch {
      setAqiData(null);
    }
  };

  const fetchByCity = async (q, { saveHistory = true } = {}) => {
    if (!q) return;
    setLoading(true);
    setError("");
    setLocationError("");
    try {
      const [w, f] = await Promise.all([
        axios.get(`${API}/weather/city/${encodeURIComponent(q)}`, { params: { units: unit } }),
        axios.get(`${API}/forecast/city/${encodeURIComponent(q)}`, {
          params: { units: unit },
        }),
      ]);
      setWeather(w.data);
      setForecast(f.data);
      setLastSearch({ type: "city", city: q });
      if (w.data?.coord?.lat && w.data?.coord?.lon) {
        await fetchAqi(w.data.coord.lat, w.data.coord.lon);
      } else {
        setAqiData(null);
      }
      if (saveHistory) {
        setRecentSearches((prev) => addUniqueRecentCity(prev, w.data?.name || q));
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to fetch weather");
      setWeather(null);
      setForecast(null);
      setAqiData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchByCoords = async (lat, lon) => {
    setLoading(true);
    setError("");
    setLocationError("");
    try {
      const [w, f] = await Promise.all([
        axios.get(`${API}/weather/coords`, { params: { lat, lon, units: unit } }),
        axios.get(`${API}/forecast/coords`, { params: { lat, lon, units: unit } }),
      ]);
      setWeather(w.data);
      setForecast(f.data);
      setLastSearch({ type: "coords", lat, lon });
      await fetchAqi(lat, lon);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to fetch weather");
      setAqiData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!lastSearch) return;
    if (lastSearch.type === "city") {
      fetchByCity(lastSearch.city, { saveHistory: false });
    } else if (lastSearch.type === "coords") {
      fetchByCoords(lastSearch.lat, lastSearch.lon);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    setLocationLoading(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLoading(false);
        fetchByCoords(pos.coords.latitude, pos.coords.longitude);
      },
      (geoErr) => {
        setLocationLoading(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setLocationError("Location permission denied. Please search by city instead.");
        } else {
          setLocationError("Unable to retrieve your location. Please try city search.");
        }
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const query = city.trim();
    if (!query) {
      setError("Please enter a city name.");
      return;
    }
    fetchByCity(query);
  };

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const windUnit = unit === "metric" ? "m/s" : "mph";
  const tempUnit = unit === "metric" ? "C" : "F";
  const daylight = getDaylightInfo(weather);
  const suggestions = getSuggestions({ weather, forecast, aqi: aqiData?.aqi });
  const aqiMeta = getAqiMeta(aqiData?.aqi);

  return (
    <div className="app">
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
        <div className="toolbar">
          <div className="unit-toggle" role="group" aria-label="Temperature unit toggle">
            <button
              type="button"
              className={`btn ${unit === "metric" ? "btn-primary" : ""}`}
              onClick={() => setUnit("metric")}
              aria-pressed={unit === "metric"}
            >
              °C
            </button>
            <button
              type="button"
              className={`btn ${unit === "imperial" ? "btn-primary" : ""}`}
              onClick={() => setUnit("imperial")}
              aria-pressed={unit === "imperial"}
            >
              °F
            </button>
          </div>
        </div>

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
          <button
            type="button"
            className="btn"
            onClick={useMyLocation}
            disabled={locationLoading || loading}
            aria-label="Use my current location"
          >
            My location
          </button>
        </form>
        {locationError && <p className="error">{locationError}</p>}
        {recentSearches.length > 0 && (
          <div className="recent-wrap card">
            <div className="recent-header">
              <div className="detail-label">Recent searches</div>
              <button
                type="button"
                className="btn btn-clear"
                onClick={() => setRecentSearches([])}
                aria-label="Clear all recent searches"
              >
                Clear all
              </button>
            </div>
            <div className="recent-list">
              {recentSearches.map((item) => (
                <div key={item} className="chip-row">
                  <button type="button" className="chip" onClick={() => fetchByCity(item)}>
                    {item}
                  </button>
                  <button
                    type="button"
                    className="chip-remove"
                    onClick={() =>
                      setRecentSearches((prev) =>
                        prev.filter((cityName) => cityName.toLowerCase() !== item.toLowerCase())
                      )
                    }
                    aria-label={`Remove ${item} from recent searches`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && <p className="info">Fetching the latest…</p>}
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
                  <sup>°{tempUnit}</sup>
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
                <div className="detail-value">{formatTemp(weather.main.feels_like)}</div>
              </div>
              <div>
                <div className="detail-label">Humidity</div>
                <div className="detail-value">{weather.main.humidity}%</div>
              </div>
              <div>
                <div className="detail-label">Wind</div>
                <div className="detail-value">
                  {weather.wind.speed} {windUnit}
                </div>
              </div>
              <div>
                <div className="detail-label">Pressure</div>
                <div className="detail-value">{weather.main.pressure} hPa</div>
              </div>
            </div>
          </div>
        )}

        {weather && (
          <div className="insights-grid">
            <div className="card">
              <div className="detail-label">Sunrise / Sunset</div>
              <div className="sun-times">
                <div>
                  <span className="detail-label">Sunrise</span>
                  <div className="detail-value">
                    {formatCityTime(weather.sys.sunrise, weather.timezone || 0)}
                  </div>
                </div>
                <div>
                  <span className="detail-label">Sunset</span>
                  <div className="detail-value">
                    {formatCityTime(weather.sys.sunset, weather.timezone || 0)}
                  </div>
                </div>
              </div>
              <div className="progress-wrap" aria-label="Daylight progress">
                <div className="progress-bar" style={{ width: `${daylight.percent}%` }} />
              </div>
              <p className="info-inline">{daylight.label}</p>
            </div>

            <div className="card">
              <div className="detail-label">Air Quality Index</div>
              <div className={`aqi-badge ${aqiMeta.className}`}>
                AQI {aqiData?.aqi ?? "N/A"} · {aqiMeta.label}
              </div>
              {!aqiData?.aqi && <p className="info-inline">AQI data unavailable for this location.</p>}
            </div>

            <div className="card">
              <div className="detail-label">Clothing & Activity Tips</div>
              <ul className="suggestions">
                {suggestions.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
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
                    <strong>{formatTemp(d.max)}</strong>{" "}
                    <span className="low">{formatTemp(d.min)}</span>
                  </div>
                  <div className="desc small">{d.description}</div>
                  <div className={`pop ${typeof d.pop === "number" && d.pop >= 0.6 ? "high" : ""}`}>
                    Rain:{" "}
                    {typeof d.pop === "number"
                      ? `${Math.round(d.pop * 100)}%`
                      : "No precipitation data"}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
