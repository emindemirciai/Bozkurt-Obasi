using Bozkurt.Gameplay.Camps;
using NUnit.Framework;

namespace Bozkurt.Tests.EditMode
{
    public sealed class CampBuildingCatalogTests
    {
        [Test]
        public void EveryBuildingHasNonNegativeCostsAndAName()
        {
            for (var value = (int)CampBuildingType.HealingArea;
                 value <= (int)CampBuildingType.WatchPost;
                 value++)
            {
                var profile = CampBuildingCatalog.Get((CampBuildingType)value);
                Assert.That(profile.DisplayName, Is.Not.Empty);
                Assert.That(profile.WoodCost, Is.GreaterThanOrEqualTo(0));
                Assert.That(profile.StoneCost, Is.GreaterThanOrEqualTo(0));
                Assert.That(profile.HerbCost, Is.GreaterThanOrEqualTo(0));
            }
        }

        [Test]
        public void BuildingCycleWrapsToHealingArea()
        {
            Assert.That(
                CampBuildingCatalog.Next(CampBuildingType.WatchPost),
                Is.EqualTo(CampBuildingType.HealingArea));
        }
    }
}
