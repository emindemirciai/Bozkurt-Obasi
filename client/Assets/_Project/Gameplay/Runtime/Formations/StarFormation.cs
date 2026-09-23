using System;
using System.Collections.Generic;
using UnityEngine;

namespace Bozkurt.Gameplay.Formations
{
    public enum StarRegion
    {
        Center = 0,
        Front = 1,
        FrontRight = 2,
        RearRight = 3,
        RearLeft = 4,
        FrontLeft = 5
    }

    public static class StarFormation
    {
        public static IReadOnlyList<Vector3> GenerateFilled(
            int count,
            float outerRadius,
            float innerRadiusRatio,
            Vector3 origin,
            float rotationDegrees = 90f)
        {
            if (count <= 0)
            {
                return Array.Empty<Vector3>();
            }

            outerRadius = Mathf.Max(0.5f, outerRadius);
            innerRadiusRatio = Mathf.Clamp(innerRadiusRatio, 0.2f, 0.8f);
            var polygon = BuildPolygon(outerRadius, innerRadiusRatio, rotationDegrees);
            var candidates = BuildCandidates(polygon, outerRadius, count);
            var selected = SelectDistributedPoints(candidates, count);

            for (var index = 0; index < selected.Count; index++)
            {
                selected[index] += origin;
            }

            return selected;
        }

        public static StarRegion ClassifyRegion(Vector3 worldPoint, Vector3 origin, float centerRadius)
        {
            var local = worldPoint - origin;
            local.y = 0f;
            if (local.magnitude <= Mathf.Max(0.1f, centerRadius))
            {
                return StarRegion.Center;
            }

            // Zero degrees points towards +Z. Positive angles rotate clockwise when viewed from above.
            var angle = Mathf.Repeat(Mathf.Atan2(local.x, local.z) * Mathf.Rad2Deg + 360f, 360f);
            var index = Mathf.RoundToInt(angle / 72f) % 5;
            return index switch
            {
                0 => StarRegion.Front,
                1 => StarRegion.FrontRight,
                2 => StarRegion.RearRight,
                3 => StarRegion.RearLeft,
                _ => StarRegion.FrontLeft
            };
        }

        private static List<Vector3> BuildPolygon(float outerRadius, float innerRadiusRatio, float rotationDegrees)
        {
            var vertices = new List<Vector3>(10);
            for (var index = 0; index < 10; index++)
            {
                var radius = index % 2 == 0 ? outerRadius : outerRadius * innerRadiusRatio;
                var angle = (rotationDegrees - index * 36f) * Mathf.Deg2Rad;
                vertices.Add(new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius));
            }
            return vertices;
        }

        private static List<Vector3> BuildCandidates(IReadOnlyList<Vector3> polygon, float radius, int count)
        {
            var spacing = Mathf.Clamp(radius / Mathf.Sqrt(Mathf.Max(1, count)) * 0.75f, 0.35f, 1.4f);
            var candidates = new List<Vector3>();
            for (var x = -radius; x <= radius; x += spacing)
            {
                for (var z = -radius; z <= radius; z += spacing)
                {
                    var point = new Vector3(x, 0f, z);
                    if (IsInside(point, polygon))
                    {
                        candidates.Add(point);
                    }
                }
            }

            if (candidates.Count == 0)
            {
                candidates.Add(Vector3.zero);
            }

            return candidates;
        }

        private static List<Vector3> SelectDistributedPoints(IReadOnlyList<Vector3> candidates, int count)
        {
            var selected = new List<Vector3>(Mathf.Min(count, candidates.Count));
            var used = new bool[candidates.Count];

            var firstIndex = 0;
            var shortest = float.MaxValue;
            for (var index = 0; index < candidates.Count; index++)
            {
                var distance = candidates[index].sqrMagnitude;
                if (distance < shortest)
                {
                    shortest = distance;
                    firstIndex = index;
                }
            }

            selected.Add(candidates[firstIndex]);
            used[firstIndex] = true;

            while (selected.Count < count && selected.Count < candidates.Count)
            {
                var bestIndex = -1;
                var bestDistance = -1f;
                for (var candidateIndex = 0; candidateIndex < candidates.Count; candidateIndex++)
                {
                    if (used[candidateIndex]) continue;
                    var minimumDistance = float.MaxValue;
                    foreach (var selectedPoint in selected)
                    {
                        minimumDistance = Mathf.Min(
                            minimumDistance,
                            (candidates[candidateIndex] - selectedPoint).sqrMagnitude);
                    }

                    if (minimumDistance > bestDistance)
                    {
                        bestDistance = minimumDistance;
                        bestIndex = candidateIndex;
                    }
                }

                if (bestIndex < 0) break;
                used[bestIndex] = true;
                selected.Add(candidates[bestIndex]);
            }

            while (selected.Count < count)
            {
                selected.Add(selected[selected.Count % Mathf.Max(1, selected.Count)]);
            }

            return selected;
        }

        private static bool IsInside(Vector3 point, IReadOnlyList<Vector3> polygon)
        {
            var inside = false;
            for (int i = 0, j = polygon.Count - 1; i < polygon.Count; j = i++)
            {
                var xi = polygon[i].x;
                var zi = polygon[i].z;
                var xj = polygon[j].x;
                var zj = polygon[j].z;
                var intersects = ((zi > point.z) != (zj > point.z))
                    && point.x < (xj - xi) * (point.z - zi) / (zj - zi + Mathf.Epsilon) + xi;
                if (intersects) inside = !inside;
            }
            return inside;
        }
    }
}
