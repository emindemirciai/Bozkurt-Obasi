using Bozkurt.Gameplay.World;
using NUnit.Framework;

namespace Bozkurt.Tests.EditMode
{
    public sealed class WorldSimulationMathTests
    {
        [Test]
        public void Daylight_IsDarkAtMidnight_AndBrightAtNoon()
        {
            Assert.That(WorldSimulationMath.CalculateDaylight01(0f), Is.EqualTo(0f).Within(0.001f));
            Assert.That(WorldSimulationMath.CalculateDaylight01(12f), Is.EqualTo(1f).Within(0.001f));
        }

        [Test]
        public void RainSlowsMigrationMoreThanWind()
        {
            var rain = WorldSimulationMath.GetMigrationSpeedMultiplier(PrototypeWeather.Rainy);
            var wind = WorldSimulationMath.GetMigrationSpeedMultiplier(PrototypeWeather.Windy);
            Assert.That(rain, Is.LessThan(wind));
        }
    }
}
