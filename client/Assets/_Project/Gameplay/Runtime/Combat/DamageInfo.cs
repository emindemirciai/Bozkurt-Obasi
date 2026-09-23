using UnityEngine;

namespace Bozkurt.Gameplay.Combat
{
    public readonly struct DamageInfo
    {
        public DamageInfo(float amount, GameObject source)
        {
            Amount = Mathf.Max(0f, amount);
            Source = source;
        }

        public float Amount { get; }
        public GameObject Source { get; }
    }
}
