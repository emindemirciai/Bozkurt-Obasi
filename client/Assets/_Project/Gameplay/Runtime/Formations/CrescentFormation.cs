using System;
using System.Collections.Generic;
using UnityEngine;

namespace Bozkurt.Gameplay.Formations
{
    public static class CrescentFormation
    {
        public static IReadOnlyList<Vector3> Generate(
            int count,
            float width,
            float depth,
            Vector3 origin,
            Vector3 attackDirection)
        {
            if (count <= 0)
            {
                return Array.Empty<Vector3>();
            }

            width = Mathf.Max(0.1f, width);
            depth = Mathf.Max(0f, depth);
            var forward = attackDirection.sqrMagnitude > 0.001f
                ? attackDirection.normalized
                : Vector3.forward;
            var right = Vector3.Cross(Vector3.up, forward).normalized;
            var points = new List<Vector3>(count);

            if (count == 1)
            {
                points.Add(origin);
                return points;
            }

            for (var index = 0; index < count; index++)
            {
                var t = index / (float)(count - 1) * 2f - 1f;
                var lateral = right * (t * width * 0.5f);
                var backward = -forward * (t * t * depth);
                points.Add(origin + lateral + backward);
            }

            return points;
        }
    }
}
