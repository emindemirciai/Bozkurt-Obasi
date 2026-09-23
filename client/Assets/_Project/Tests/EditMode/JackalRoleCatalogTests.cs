using Bozkurt.Gameplay.Combat;
using NUnit.Framework;

namespace Bozkurt.Tests
{
    public sealed class JackalRoleCatalogTests
    {
        [Test]
        public void Runner_IsFasterAndMoreFragileThanRaider()
        {
            var raider = JackalRoleCatalog.Get(JackalRole.Raider);
            var runner = JackalRoleCatalog.Get(JackalRole.Runner);

            Assert.That(runner.SpeedMultiplier, Is.GreaterThan(raider.SpeedMultiplier));
            Assert.That(runner.HealthMultiplier, Is.LessThan(raider.HealthMultiplier));
            Assert.That(runner.PrefersHerd, Is.True);
            Assert.That(runner.CanFlank, Is.True);
        }

        [Test]
        public void Leader_IsTheMostDurableRole()
        {
            var leader = JackalRoleCatalog.Get(JackalRole.Leader);
            var brute = JackalRoleCatalog.Get(JackalRole.Brute);

            Assert.That(leader.HealthMultiplier, Is.GreaterThan(brute.HealthMultiplier));
            Assert.That(leader.DamageMultiplier, Is.GreaterThan(1f));
        }

        [Test]
        public void AllPackTactics_HaveReadableTurkishNames()
        {
            Assert.That(JackalRoleNames.GetTacticDisplayName(JackalPackTactic.DirectAssault), Is.Not.Empty);
            Assert.That(JackalRoleNames.GetTacticDisplayName(JackalPackTactic.LeftFlank), Is.Not.Empty);
            Assert.That(JackalRoleNames.GetTacticDisplayName(JackalPackTactic.RightFlank), Is.Not.Empty);
            Assert.That(JackalRoleNames.GetTacticDisplayName(JackalPackTactic.SplitFlank), Is.Not.Empty);
            Assert.That(JackalRoleNames.GetTacticDisplayName(JackalPackTactic.HerdRush), Is.Not.Empty);
        }
    }
}
