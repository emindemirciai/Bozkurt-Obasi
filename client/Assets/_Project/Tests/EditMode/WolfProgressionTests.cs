using Bozkurt.Gameplay.Progression;
using NUnit.Framework;
using UnityEngine;

namespace Bozkurt.Tests
{
    public sealed class WolfProgressionTests
    {
        private GameObject _gameObject;
        private WolfProgression _progression;

        [SetUp]
        public void SetUp()
        {
            _gameObject = new GameObject("Wolf Progression Test");
            _progression = _gameObject.AddComponent<WolfProgression>();
            _progression.Initialize(0);
        }

        [TearDown]
        public void TearDown()
        {
            Object.DestroyImmediate(_gameObject);
        }

        [Test]
        public void Experience_LevelUpCreatesTrainingPoint()
        {
            _progression.AddExperience(65);

            Assert.That(_progression.Level, Is.EqualTo(2));
            Assert.That(_progression.CurrentExperience, Is.EqualTo(5));
            Assert.That(_progression.UnspentTrainingPoints, Is.EqualTo(1));
        }

        [Test]
        public void GuardianTraining_IncreasesHealthMultiplier()
        {
            _progression.AddExperience(60);
            var spent = _progression.SpendTrainingPoint(WolfTrainingPath.Guardian);

            Assert.That(spent, Is.True);
            Assert.That(_progression.GuardianRanks, Is.EqualTo(1));
            Assert.That(_progression.MaximumHealthMultiplier, Is.EqualTo(1.12f).Within(0.001f));
        }


        [Test]
        public void StarterHealer_BeginsWithHealingSkill()
        {
            var healerObject = new GameObject("Starter Healer Test");
            try
            {
                var healer = healerObject.AddComponent<WolfProgression>();
                healer.Initialize(4, null, true);

                Assert.That(healer.CanHeal, Is.True);
                Assert.That(healer.HealerRanks, Is.EqualTo(1));
                Assert.That(healer.HealingAmount, Is.GreaterThan(0f));
            }
            finally
            {
                Object.DestroyImmediate(healerObject);
            }
        }

        [Test]
        public void HealerTraining_IncreasesHealingPower()
        {
            _progression.AddExperience(60);
            var previousHealing = _progression.HealingAmount;
            var spent = _progression.SpendTrainingPoint(WolfTrainingPath.Healer);

            Assert.That(spent, Is.True);
            Assert.That(_progression.HealerRanks, Is.EqualTo(1));
            Assert.That(_progression.HealingAmount, Is.GreaterThan(previousHealing));
        }

        [Test]
        public void Snapshot_RestoresProgressionState()
        {
            _progression.AddExperience(60);
            _progression.SpendTrainingPoint(WolfTrainingPath.Healer);
            var snapshot = _progression.CaptureSnapshot();

            var secondObject = new GameObject("Restored Wolf Progression Test");
            try
            {
                var restored = secondObject.AddComponent<WolfProgression>();
                restored.Initialize(0, snapshot);

                Assert.That(restored.Level, Is.EqualTo(2));
                Assert.That(restored.HealerRanks, Is.EqualTo(1));
                Assert.That(restored.CanHeal, Is.True);
                Assert.That(restored.HealingAmount, Is.GreaterThan(0f));
            }
            finally
            {
                Object.DestroyImmediate(secondObject);
            }
        }
    }
}
