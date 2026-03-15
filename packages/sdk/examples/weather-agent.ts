import { Agent, tool } from "../mod.ts";
import { anthropic } from "npm:@ai-sdk/anthropic";
import { z } from "zod";

const getWeather = tool({
  name: "get_weather",
  description: "Get current weather for a location using its coordinates",
  parameters: z.object({
    latitude: z.number().describe("Latitude of the location"),
    longitude: z.number().describe("Longitude of the location"),
    city: z.string().describe("Human-readable city name for the response"),
  }),
  execute: async (_ctx, { latitude, longitude, city }) => {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,wind_speed_10m`;
    const data = await fetch(url).then((r) => r.json());
    return `${city}: ${data.current.temperature_2m}°C, wind ${data.current.wind_speed_10m} km/h`;
  },
});

const WeatherReport = z.object({
  city: z.string(),
  temperature: z.number().describe("Temperature in Celsius"),
  windSpeed: z.number().describe("Wind speed in km/h"),
  summary: z.string().describe("One-sentence weather summary"),
});

const agent = new Agent<undefined, z.infer<typeof WeatherReport>>({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt:
    "You are a weather assistant. Use the get_weather tool with exact coordinates. " +
    "Always call the tool before responding.",
  tools: [getWeather],
  outputSchema: WeatherReport,
});

const result = await agent.run("What's the weather in Tokyo?");
console.log(result.output);
