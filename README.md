# Weather App

A full-stack weather app built with Node.js/Express (backend) and React + Vite (frontend). Uses the OpenWeather API to show current weather + 5-day forecast, either by city search or by the user's current geolocation.

## Structure
```
weather-app/
├── backend/     # Express API server
└── frontend/    # React + Vite UI
```

## Quick start

### 1. Backend
```
cd backend
npm install
# edit .env and put your OpenWeather API key
npm start
```
Runs on http://localhost:5000

### 2. Frontend (in another terminal)
```
cd frontend
npm install
npm run dev
```
Runs on http://localhost:5173

### Get an API key
Free at https://openweathermap.org/api — put it into `backend/.env` as `OPENWEATHER_API_KEY`.
