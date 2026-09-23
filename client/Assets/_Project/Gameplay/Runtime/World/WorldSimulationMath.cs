using UnityEngine;

namespace Bozkurt.Gameplay.World
{
    public enum PrototypeWeather
    {
        Clear = 0,
        Windy = 1,
        Foggy = 2,
        Rainy = 3
    }

    public static class WorldSimulationMath
    {
        public static float CalculateDaylight01(float hour)
        {
            var wrappedHour = Mathf.Repeat(hour, 24f);
            var daylightAngle = (wrappedHour - 6f) / 12f * Mathf.PI;
            return Mathf.Clamp01(Mathf.Sin(daylightAngle));
        }

        public static float GetMigrationSpeedMultiplier(PrototypeWeather weather)
        {
            return weather switch
            {
                PrototypeWeather.Windy => 0.88f,
                PrototypeWeather.Foggy => 0.8f,
                PrototypeWeather.Rainy => 0.72f,
                _ => 1f
            };
        }

        public static string GetWeatherDisplayName(PrototypeWeather weather)
        {
            return weather switch
            {
                PrototypeWeather.Windy => "Rüzgârlı",
                PrototypeWeather.Foggy => "Sisli",
                PrototypeWeather.Rainy => "Yağmurlu",
                _ => "Açık"
            };
        }
    }
}
