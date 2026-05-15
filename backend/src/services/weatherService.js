// src/services/weatherService.js
const axios = require('axios');

const OWM_KEY  = process.env.OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

const getWeatherByCoords = async (lat, lng) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/weather`, {
      params: { lat, lon: lng, appid: OWM_KEY, units: 'metric' },
      timeout: 6000,
    });
    return {
      temperature: data.main?.temp,
      feelsLike:   data.main?.feels_like,
      humidity:    data.main?.humidity,
      windSpeed:   data.wind?.speed,
      rainfall:    data.rain?.['1h'] || 0,
      description: data.weather?.[0]?.description,
      icon:        data.weather?.[0]?.icon,
      city:        data.name,
    };
  } catch (err) {
    console.warn('OpenWeatherMap error:', err.message);
    return null;
  }
};

const getForecastByCoords = async (lat, lng) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/forecast`, {
      params: { lat, lon: lng, appid: OWM_KEY, units: 'metric', cnt: 8 },
      timeout: 6000,
    });
    return data.list.map(item => ({
      time:        item.dt_txt,
      temperature: item.main?.temp,
      rainfall:    item.rain?.['3h'] || 0,
      windSpeed:   item.wind?.speed,
      description: item.weather?.[0]?.description,
    }));
  } catch (err) {
    console.warn('OpenWeatherMap forecast error:', err.message);
    return [];
  }
};

module.exports = { getWeatherByCoords, getForecastByCoords };
