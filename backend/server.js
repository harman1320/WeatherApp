require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;
const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE = "https://api.openweathermap.org/data/2.5";
const ALLOWED_UNITS = new Set(["metric", "imperial"]);

app.use(cors());
app.use(express.json());

function resolveUnits(req, res) {
  const units = req.query.units || "metric";
  if (!ALLOWED_UNITS.has(units)) {
    res.status(400).json({ message: "units must be metric or imperial" });
    return null;
  }
  return units;
}

// Current weather by city
app.get("/api/weather/city/:city", async (req, res) => {
  try {
    const { city } = req.params;
    const units = resolveUnits(req, res);
    if (!units) return;
    const { data } = await axios.get(`${BASE}/weather`, {
      params: { q: city, appid: API_KEY, units },
    });
    res.json(data);
  } catch (err) {
    res
      .status(err.response?.status || 500)
      .json({ message: err.response?.data?.message || "Error fetching weather" });
  }
});

// Current weather by coordinates
app.get("/api/weather/coords", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ message: "lat and lon required" });
    const units = resolveUnits(req, res);
    if (!units) return;
    const { data } = await axios.get(`${BASE}/weather`, {
      params: { lat, lon, appid: API_KEY, units },
    });
    res.json(data);
  } catch (err) {
    res
      .status(err.response?.status || 500)
      .json({ message: err.response?.data?.message || "Error fetching weather" });
  }
});

// 5-day forecast by city
app.get("/api/forecast/city/:city", async (req, res) => {
  try {
    const { city } = req.params;
    const units = resolveUnits(req, res);
    if (!units) return;
    const { data } = await axios.get(`${BASE}/forecast`, {
      params: { q: city, appid: API_KEY, units },
    });
    res.json(summarizeForecast(data));
  } catch (err) {
    res
      .status(err.response?.status || 500)
      .json({ message: err.response?.data?.message || "Error fetching forecast" });
  }
});

// 5-day forecast by coords
app.get("/api/forecast/coords", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ message: "lat and lon required" });
    const units = resolveUnits(req, res);
    if (!units) return;
    const { data } = await axios.get(`${BASE}/forecast`, {
      params: { lat, lon, appid: API_KEY, units },
    });
    res.json(summarizeForecast(data));
  } catch (err) {
    res
      .status(err.response?.status || 500)
      .json({ message: err.response?.data?.message || "Error fetching forecast" });
  }
});

// Air quality by coordinates
app.get("/api/air/coords", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ message: "lat and lon required" });
    const { data } = await axios.get(`${BASE}/air_pollution`, {
      params: { lat, lon, appid: API_KEY },
    });
    const first = data?.list?.[0];
    res.json({
      coord: data.coord || null,
      aqi: first?.main?.aqi ?? null,
      components: first?.components || null,
      dt: first?.dt || null,
    });
  } catch (err) {
    res
      .status(err.response?.status || 500)
      .json({ message: err.response?.data?.message || "Error fetching air quality" });
  }
});

// Group 3-hour forecast into daily summaries (max 5 days)
function summarizeForecast(data) {
  const days = {};
  for (const item of data.list) {
    const date = item.dt_txt.split(" ")[0];
    if (!days[date]) {
      days[date] = { date, temps: [], items: [], pops: [] };
    }
    days[date].temps.push(item.main.temp);
    days[date].items.push(item);
    if (typeof item.pop === "number") {
      days[date].pops.push(item.pop);
    }
  }
  const daily = Object.values(days)
    .slice(0, 5)
    .map((d) => {
      // pick midday item if available for icon/description
      const mid =
        d.items.find((i) => i.dt_txt.includes("12:00:00")) ||
        d.items[Math.floor(d.items.length / 2)];
      return {
        date: d.date,
        min: Math.min(...d.temps),
        max: Math.max(...d.temps),
        icon: mid.weather[0].icon,
        description: mid.weather[0].description,
        main: mid.weather[0].main,
        humidity: mid.main.humidity,
        wind: mid.wind.speed,
        pop: d.pops.length ? Math.max(...d.pops) : null,
      };
    });
  return { city: data.city, daily };
}

app.get("/", (_req, res) => res.json({ status: "Weather API running" }));

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
