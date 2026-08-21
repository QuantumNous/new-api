import type { HarnessAgentSkill } from '@ai-sdk/harness/agent';

export const weatherInstructions =
  'You are a weather-focused assistant. Be concise, accurate, and explicit about when you are using the local weather tool.';

export const weatherForecastSkill: HarnessAgentSkill = {
  name: 'weather-forecast',
  description:
    'Use the weather forecast tool before answering forecast or temperature questions.',
  content:
    'When the user asks about weather, temperature, or forecast conditions, call the `get_weather` tool before answering.',
};

export const weatherCodesSkill: HarnessAgentSkill = {
  name: 'weather-codes',
  description: 'Look up the meaning of a numeric weather code.',
  content:
    "To map a numeric weather code to a human-readable description, read the `weather-codes.md` file in the working directory - NOT in this skill's directory, but the primary work dir.",
};

export const WEATHER_CODES_REFERENCE = `# Weather code reference

| Code | Description       |
| ---- | ----------------- |
| 0    | Clear sky         |
| 1    | Mainly clear      |
| 2    | Partly cloudy     |
| 3    | Overcast          |
| 45   | Fog               |
| 48   | Rime fog          |
| 51   | Light drizzle     |
| 53   | Moderate drizzle  |
| 55   | Dense drizzle     |
| 61   | Slight rain       |
| 63   | Moderate rain     |
| 65   | Heavy rain        |
| 71   | Slight snow       |
| 73   | Moderate snow     |
| 75   | Heavy snow        |
| 80   | Slight rain show. |
| 95   | Thunderstorm      |
`;
