using Bozkurt.Gameplay.Formations;
using NUnit.Framework;
using UnityEngine;

namespace Bozkurt.Tests
{
    public sealed class StarFormationTests
    {
        [TestCase(1)]
        [TestCase(24)]
        [TestCase(100)]
        public void GenerateFilled_ReturnsRequestedPointCount(int count)
        {
            var points = StarFormation.GenerateFilled(count, 6f, 0.44f, Vector3.zero);
            Assert.AreEqual(count, points.Count);
        }
    }
}
