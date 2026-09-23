using Bozkurt.Gameplay.Formations;
using NUnit.Framework;
using UnityEngine;

namespace Bozkurt.Tests
{
    public sealed class StarRegionTests
    {
        [Test]
        public void ClassifyRegion_ReturnsCenterForNearbyPoint()
        {
            var result = StarFormation.ClassifyRegion(new Vector3(0.2f, 0f, 0.15f), Vector3.zero, 1f);
            Assert.That(result, Is.EqualTo(StarRegion.Center));
        }

        [Test]
        public void ClassifyRegion_ReturnsFrontForPositiveZPoint()
        {
            var result = StarFormation.ClassifyRegion(new Vector3(0f, 0f, 5f), Vector3.zero, 1f);
            Assert.That(result, Is.EqualTo(StarRegion.Front));
        }

        [Test]
        public void ClassifyRegion_ReturnsFrontRightForDiagonalPoint()
        {
            var result = StarFormation.ClassifyRegion(new Vector3(4f, 0f, 1.5f), Vector3.zero, 1f);
            Assert.That(result, Is.EqualTo(StarRegion.FrontRight));
        }
    }
}
