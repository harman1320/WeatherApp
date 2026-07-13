# Weather App Backend

## Setup
1. `cd backend`
2. `npm install`
3. Add your OpenWeather API key in `.env` (get one free at https://openweathermap.org/api)
4. `npm start` (or `npm run dev` with nodemon)

Server runs on http://localhost:5000

## API routes
- `GET /api/weather/city/:city?units=metric|imperial`
- `GET /api/weather/coords?lat=..&lon=..&units=metric|imperial`
- `GET /api/forecast/city/:city?units=metric|imperial`
- `GET /api/forecast/coords?lat=..&lon=..&units=metric|imperial`
- `GET /api/air/coords?lat=..&lon=..` (OpenWeather AQI scale 1 to 5)
