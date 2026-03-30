import { tool } from '@langchain/core/tools'
import * as z from 'zod'

const mockWeatherData: Record<string, { temp: number; condition: string }> = {
  'new york': { temp: 62, condition: 'Partly cloudy' },
  london: { temp: 55, condition: 'Rainy' },
  paris: { temp: 68, condition: 'Sunny' },
  tokyo: { temp: 72, condition: 'Clear' },
  sydney: { temp: 78, condition: 'Warm and humid' },
  'san francisco': { temp: 59, condition: 'Foggy' },
}

export const getWeather = tool(
  ({ city }) => {
    const key = city.toLowerCase()
    const data = mockWeatherData[key]
    if (data) {
      return `${city}: ${data.temp}°F, ${data.condition}`
    }
    return `${city}: 65°F, Mild (no specific data available)`
  },
  {
    name: 'get_weather',
    description: 'Get the current weather for a given city',
    schema: z.object({
      city: z.string().describe('The city name to look up weather for'),
    }),
  },
)
