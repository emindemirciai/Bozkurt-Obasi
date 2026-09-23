using Bozkurt.Gameplay.Combat;
using NUnit.Framework;
using UnityEngine;

namespace Bozkurt.Tests
{
    public sealed class HealthComponentTests
    {
        private GameObject _gameObject;
        private HealthComponent _health;

        [SetUp]
        public void SetUp()
        {
            _gameObject = new GameObject("Health Test");
            _health = _gameObject.AddComponent<HealthComponent>();
            _health.Initialize(100f, true);
        }

        [TearDown]
        public void TearDown()
        {
            Object.DestroyImmediate(_gameObject);
        }

        [Test]
        public void Damage_ReducesHealthWithoutGoingBelowZero()
        {
            _health.ApplyDamage(new DamageInfo(35f, null));
            Assert.That(_health.CurrentHealth, Is.EqualTo(65f).Within(0.001f));

            _health.ApplyDamage(new DamageInfo(500f, null));
            Assert.That(_health.CurrentHealth, Is.EqualTo(0f));
            Assert.That(_health.IsDepleted, Is.True);
        }

        [Test]
        public void Revive_RestoresConfiguredHealthFraction()
        {
            _health.ApplyDamage(new DamageInfo(100f, null));
            var revived = _health.Revive(0.35f);

            Assert.That(revived, Is.True);
            Assert.That(_health.IsDepleted, Is.False);
            Assert.That(_health.CurrentHealth, Is.EqualTo(35f).Within(0.001f));
        }

        [Test]
        public void RestoreFull_RecoversDownedUnit()
        {
            _health.ApplyDamage(new DamageInfo(100f, null));
            _health.RestoreFull();

            Assert.That(_health.IsDepleted, Is.False);
            Assert.That(_health.CurrentHealth, Is.EqualTo(100f).Within(0.001f));
        }
    }
}
