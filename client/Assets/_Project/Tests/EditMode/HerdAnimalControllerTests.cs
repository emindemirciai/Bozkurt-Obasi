using Bozkurt.Gameplay.Combat;
using Bozkurt.Gameplay.Formations;
using Bozkurt.Gameplay.Herd;
using NUnit.Framework;
using UnityEngine;

namespace Bozkurt.Tests
{
    public sealed class HerdAnimalControllerTests
    {
        [Test]
        public void Initialize_MarksBullAsDefender()
        {
            var gameObject = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            try
            {
                var controller = gameObject.AddComponent<HerdAnimalController>();
                controller.Initialize(
                    HerdAnimalType.Bull,
                    StarRegion.Front,
                    Vector3.zero,
                    180f,
                    2.7f,
                    30f,
                    Color.black);

                Assert.That(controller.IsDefender, Is.True);
                Assert.That(controller.AnimalType, Is.EqualTo(HerdAnimalType.Bull));
                Assert.That(controller.Health.CurrentHealth, Is.EqualTo(180f));
            }
            finally
            {
                Object.DestroyImmediate(gameObject);
            }
        }

        [Test]
        public void ForcePanic_SetsAnimalToPanickedState()
        {
            var gameObject = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            try
            {
                var controller = gameObject.AddComponent<HerdAnimalController>();
                controller.Initialize(
                    HerdAnimalType.Sheep,
                    StarRegion.Center,
                    Vector3.zero,
                    55f,
                    2.7f,
                    0f,
                    Color.white);

                controller.ForcePanic(Vector3.forward);

                Assert.That(controller.IsPanicked, Is.True);
                Assert.That(controller.Panic01, Is.EqualTo(1f));
            }
            finally
            {
                Object.DestroyImmediate(gameObject);
            }
        }

        [Test]
        public void ReceiveTreatment_HealsAndReducesPanic()
        {
            var gameObject = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            try
            {
                var controller = gameObject.AddComponent<HerdAnimalController>();
                controller.Initialize(
                    HerdAnimalType.Sheep,
                    StarRegion.Center,
                    Vector3.zero,
                    100f,
                    2.7f,
                    0f,
                    Color.white);

                controller.Health.ApplyDamage(new DamageInfo(45f, null));
                controller.ForcePanic(Vector3.forward);
                var healed = controller.ReceiveTreatment(20f, 0.35f);

                Assert.That(healed, Is.EqualTo(20f).Within(0.001f));
                Assert.That(controller.Health.CurrentHealth, Is.EqualTo(75f).Within(0.001f));
                Assert.That(controller.Panic01, Is.EqualTo(0.65f).Within(0.001f));
            }
            finally
            {
                Object.DestroyImmediate(gameObject);
            }
        }
    }
}
