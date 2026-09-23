using Bozkurt.Gameplay.Formations;
using NUnit.Framework;
using UnityEngine;

namespace Bozkurt.Tests
{
    public sealed class CrescentFormationTests
    {
        [Test]
        public void Generate_ReturnsRequestedPointCount()
        {
            var points = CrescentFormation.Generate(15, 14f, 5f, Vector3.zero, Vector3.forward);
            Assert.AreEqual(15, points.Count);
        }

        [Test]
        public void Generate_PlacesTipsBehindCenter()
        {
            var points = CrescentFormation.Generate(5, 10f, 4f, Vector3.zero, Vector3.forward);
            var center = points[2];
            Assert.Less(points[0].z, center.z);
            Assert.Less(points[4].z, center.z);
        }
    }
}
