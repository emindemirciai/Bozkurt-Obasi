using UnityEngine;

namespace Bozkurt.Gameplay.Combat
{
    public readonly struct JackalRoleProfile
    {
        public JackalRoleProfile(
            float healthMultiplier,
            float damageMultiplier,
            float speedMultiplier,
            float cooldownMultiplier,
            bool prefersHerd,
            bool canFlank,
            Vector3 scale,
            Color color)
        {
            HealthMultiplier = healthMultiplier;
            DamageMultiplier = damageMultiplier;
            SpeedMultiplier = speedMultiplier;
            CooldownMultiplier = cooldownMultiplier;
            PrefersHerd = prefersHerd;
            CanFlank = canFlank;
            Scale = scale;
            Color = color;
        }

        public float HealthMultiplier { get; }
        public float DamageMultiplier { get; }
        public float SpeedMultiplier { get; }
        public float CooldownMultiplier { get; }
        public bool PrefersHerd { get; }
        public bool CanFlank { get; }
        public Vector3 Scale { get; }
        public Color Color { get; }
    }

    public static class JackalRoleCatalog
    {
        public static JackalRoleProfile Get(JackalRole role)
        {
            return role switch
            {
                JackalRole.Runner => new JackalRoleProfile(
                    0.72f, 0.72f, 1.55f, 0.78f, true, true,
                    new Vector3(0.52f, 0.56f, 0.82f),
                    new Color(0.76f, 0.34f, 0.11f)),

                JackalRole.Brute => new JackalRoleProfile(
                    1.85f, 1.55f, 0.68f, 1.22f, false, false,
                    new Vector3(0.92f, 0.88f, 1.18f),
                    new Color(0.29f, 0.19f, 0.12f)),

                JackalRole.Sneaky => new JackalRoleProfile(
                    0.82f, 0.9f, 1.28f, 0.92f, true, true,
                    new Vector3(0.58f, 0.58f, 0.9f),
                    new Color(0.34f, 0.36f, 0.31f)),

                JackalRole.Howler => new JackalRoleProfile(
                    1.05f, 0.62f, 0.9f, 1.12f, false, false,
                    new Vector3(0.72f, 0.72f, 1.02f),
                    new Color(0.43f, 0.24f, 0.49f)),

                JackalRole.Leader => new JackalRoleProfile(
                    2.45f, 1.42f, 1.04f, 0.88f, false, false,
                    new Vector3(1.02f, 1f, 1.35f),
                    new Color(0.58f, 0.12f, 0.08f)),

                _ => new JackalRoleProfile(
                    1f, 1f, 1f, 1f, false, true,
                    new Vector3(0.65f, 0.65f, 0.95f),
                    new Color(0.48f, 0.31f, 0.14f))
            };
        }
    }
}
