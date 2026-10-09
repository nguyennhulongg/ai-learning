import { tool } from "ai";
import { z } from "zod";

const URL = process.env.OPEN_WEATHER_URL
const API_KEY = process.env.OPENWEATHER_API_KEY

export const weatherTools = {
  getWeather: tool({
    description: "Lấy thông tin thời tiết hiện tại của một thành phố",
    inputSchema: z.object({
      city: z.string().describe("Tên thành phố"),
    }),
    execute: async ({ city }) => {
      // TODO: thay bằng OpenWeatherMap API
      const res = await fetch(`${URL}/data/2.5/weather?q=${city}&appid=${API_KEY}`);
      const conditions = ["Nắng", "Nhiều mây", "Mưa nhẹ", "Có mây", "Giông bão"];
      const temp = Math.floor(Math.random() * 20 + 20);
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      return {
        city,
        temperature: temp,
        unit: "°C",
        condition,
        humidity: Math.floor(Math.random() * 40 + 50) + "%",
        wind: Math.floor(Math.random() * 30 + 5) + " km/h",
      };
    },
  }),
};
