using System;
using UnityEngine;

namespace Bozkurt.Gameplay.Combat
{
    [DisallowMultipleComponent]
    public sealed class HealthComponent : MonoBehaviour
    {
        [SerializeField, Min(1f)] private float maximumHealth = 100f;
        [SerializeField] private bool revivable;

        public event Action<HealthComponent> HealthChanged;
        public event Action<HealthComponent> Depleted;
        public event Action<HealthComponent> Revived;

        public float MaximumHealth => maximumHealth;
        public float CurrentHealth { get; private set; }
        public float NormalizedHealth => maximumHealth <= 0f ? 0f : CurrentHealth / maximumHealth;
        public bool IsDepleted { get; private set; }
        public bool IsRevivable => revivable;

        private void Awake()
        {
            if (CurrentHealth <= 0f && !IsDepleted)
            {
                CurrentHealth = maximumHealth;
            }
        }

        public void Initialize(float maxHealth, bool canRevive)
        {
            maximumHealth = Mathf.Max(1f, maxHealth);
            revivable = canRevive;
            CurrentHealth = maximumHealth;
            IsDepleted = false;
            HealthChanged?.Invoke(this);
        }


        public void SetMaximumHealth(float value, bool preserveHealthRatio = true)
        {
            var newMaximum = Mathf.Max(1f, value);
            var previousMaximum = maximumHealth;
            var previousRatio = previousMaximum <= 0f ? 1f : CurrentHealth / previousMaximum;
            maximumHealth = newMaximum;

            if (IsDepleted)
            {
                CurrentHealth = 0f;
            }
            else if (preserveHealthRatio)
            {
                CurrentHealth = Mathf.Clamp(previousRatio * maximumHealth, 0f, maximumHealth);
            }
            else
            {
                CurrentHealth = Mathf.Min(CurrentHealth, maximumHealth);
            }

            HealthChanged?.Invoke(this);
        }

        public bool ApplyDamage(DamageInfo damage)
        {
            if (IsDepleted || damage.Amount <= 0f)
            {
                return false;
            }

            CurrentHealth = Mathf.Max(0f, CurrentHealth - damage.Amount);
            HealthChanged?.Invoke(this);

            if (CurrentHealth > 0f)
            {
                return true;
            }

            IsDepleted = true;
            Depleted?.Invoke(this);
            return true;
        }

        public bool Heal(float amount)
        {
            if (IsDepleted || amount <= 0f)
            {
                return false;
            }

            var previous = CurrentHealth;
            CurrentHealth = Mathf.Min(maximumHealth, CurrentHealth + amount);
            if (Mathf.Approximately(previous, CurrentHealth))
            {
                return false;
            }

            HealthChanged?.Invoke(this);
            return true;
        }

        public bool Revive(float healthFraction)
        {
            if (!revivable || !IsDepleted)
            {
                return false;
            }

            IsDepleted = false;
            CurrentHealth = maximumHealth * Mathf.Clamp(healthFraction, 0.05f, 1f);
            HealthChanged?.Invoke(this);
            Revived?.Invoke(this);
            return true;
        }

        public void RestoreFull()
        {
            var wasDepleted = IsDepleted;
            IsDepleted = false;
            CurrentHealth = maximumHealth;
            HealthChanged?.Invoke(this);
            if (wasDepleted)
            {
                Revived?.Invoke(this);
            }
        }

        public void RestoreState(float normalizedHealth, bool depleted)
        {
            var wasDepleted = IsDepleted;
            IsDepleted = depleted;
            CurrentHealth = depleted
                ? 0f
                : maximumHealth * Mathf.Clamp(normalizedHealth, 0.01f, 1f);
            HealthChanged?.Invoke(this);

            if (depleted && !wasDepleted)
            {
                Depleted?.Invoke(this);
            }
            else if (!depleted && wasDepleted)
            {
                Revived?.Invoke(this);
            }
        }
    }
}
