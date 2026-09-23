using Bozkurt.Gameplay.Herd;
using Bozkurt.Gameplay.Progression;
using Bozkurt.Gameplay.Prototype;
using UnityEngine;

namespace Bozkurt.Gameplay.Combat
{
    [DisallowMultipleComponent]
    [RequireComponent(typeof(SelectableWolf))]
    [RequireComponent(typeof(HealthComponent))]
    [RequireComponent(typeof(WolfProgression))]
    public sealed class WolfCombatController : MonoBehaviour
    {
        [Header("Health")]
        [SerializeField, Min(1f)] private float maximumHealth = 120f;

        [Header("Attack")]
        [SerializeField, Min(0f)] private float attackDamage = 22f;
        [SerializeField, Min(0.2f)] private float attackRange = 1.65f;
        [SerializeField, Min(0.5f)] private float detectionRange = 8.5f;
        [SerializeField, Min(0.1f)] private float attackCooldown = 0.85f;
        [SerializeField, Min(0.05f)] private float targetRefreshInterval = 0.25f;

        [Header("Rescue")]
        [SerializeField, Min(0.5f)] private float rescueRange = 2.1f;
        [SerializeField, Min(0.2f)] private float rescueDuration = 2.2f;
        [SerializeField, Range(0.05f, 1f)] private float revivedHealthFraction = 0.35f;

        [Header("Healing")]
        [SerializeField, Min(0.05f)] private float healingTargetRefreshInterval = 0.28f;
        [SerializeField, Range(0.5f, 1f)] private float woundedTargetThreshold = 0.98f;

        private SelectableWolf _movement;
        private HealthComponent _health;
        private WolfProgression _progression;
        private JackalCombatController _target;
        private WolfCombatController _rescueTarget;
        private HealthComponent _healingTarget;
        private float _nextAttackAt;
        private float _nextTargetRefreshAt;
        private float _nextHealingTargetRefreshAt;
        private float _nextHealAt;
        private float _rescueProgress;
        private bool _combatEnabled;
        private bool _healingVisualActive;

        public HealthComponent Health => _health;
        public WolfProgression Progression => _progression;
        public bool IsDowned => _health != null && _health.IsDepleted;
        public bool IsRescuing => _rescueTarget != null;
        public bool IsHealing => _healingTarget != null && _progression != null && _progression.CanHeal;
        public bool CombatEnabled => _combatEnabled;
        public float RescueProgress01 => _rescueTarget == null
            ? 0f
            : Mathf.Clamp01(_rescueProgress / CurrentRescueDuration);
        public WolfCombatController RescueTarget => _rescueTarget;
        public HealthComponent HealingTarget => _healingTarget;

        private float CurrentAttackDamage => attackDamage * (_progression != null ? _progression.AttackDamageMultiplier : 1f);
        private float CurrentAttackCooldown => attackCooldown * (_progression != null ? _progression.AttackCooldownMultiplier : 1f);
        private float CurrentDetectionRange => detectionRange + (_progression != null ? _progression.DetectionRangeBonus : 0f);
        private float CurrentRescueDuration => rescueDuration * (_progression != null ? _progression.RescueDurationMultiplier : 1f);

        public void Initialize(float maxHealth, float damage)
        {
            maximumHealth = Mathf.Max(1f, maxHealth);
            attackDamage = Mathf.Max(0f, damage);
            EnsureComponents();
            _health.Initialize(maximumHealth * _progression.MaximumHealthMultiplier, true);
            _combatEnabled = false;
            _nextHealingTargetRefreshAt = 0f;
            _nextHealAt = Time.time + 0.35f;
        }

        public void SetCombatEnabled(bool enabled)
        {
            _combatEnabled = enabled;
            if (!enabled)
            {
                _target = null;
            }
            else
            {
                _nextAttackAt = Time.time + 0.2f;
                _nextTargetRefreshAt = 0f;
            }
        }

        private void Awake()
        {
            EnsureComponents();
        }

        private void OnEnable()
        {
            EnsureComponents();
            _health.Depleted += HandleDowned;
            _health.Revived += HandleRevived;
            _progression.Changed += HandleProgressionChanged;
        }

        private void OnDisable()
        {
            if (_health != null)
            {
                _health.Depleted -= HandleDowned;
                _health.Revived -= HandleRevived;
            }

            if (_progression != null)
            {
                _progression.Changed -= HandleProgressionChanged;
            }
        }

        private void Update()
        {
            if (IsDowned)
            {
                return;
            }

            if (_rescueTarget != null)
            {
                ClearHealingTarget(false);
                UpdateRescue();
                return;
            }

            if (_movement.HasManualOrder)
            {
                _target = null;
                ClearHealingTarget(true);
                return;
            }

            if (TryUpdateHealing())
            {
                _target = null;
                return;
            }

            if (!_combatEnabled)
            {
                return;
            }

            if (Time.time >= _nextTargetRefreshAt)
            {
                _nextTargetRefreshAt = Time.time + targetRefreshInterval;
                RefreshTarget();
            }

            UpdateAttack();
        }

        public bool BeginRescue(WolfCombatController target)
        {
            if (target == null || target == this || IsDowned || !target.IsDowned)
            {
                return false;
            }

            _target = null;
            ClearHealingTarget(true);
            _rescueTarget = target;
            _rescueProgress = 0f;
            _movement.StopMovement();
            _movement.SetStatusColor(new Color(0.18f, 0.72f, 0.92f));
            _movement.MoveToSystem(target.transform.position);
            return true;
        }

        public void CancelRescue()
        {
            _rescueTarget = null;
            _rescueProgress = 0f;
            if (!IsDowned && !_healingVisualActive)
            {
                _movement.ClearStatusColor();
            }
        }

        public void RestoreFullHealth()
        {
            EnsureComponents();
            _health.RestoreFull();
        }

        public void RefreshProgressionBonuses()
        {
            EnsureComponents();
            _health.SetMaximumHealth(maximumHealth * _progression.MaximumHealthMultiplier, true);
            _nextHealingTargetRefreshAt = 0f;
        }

        private bool TryUpdateHealing()
        {
            if (_progression == null || !_progression.CanHeal)
            {
                ClearHealingTarget(true);
                return false;
            }

            if (Time.time >= _nextHealingTargetRefreshAt || !IsValidHealingTarget(_healingTarget))
            {
                _nextHealingTargetRefreshAt = Time.time + healingTargetRefreshInterval;
                RefreshHealingTarget();
            }

            if (_healingTarget == null)
            {
                ClearHealingTarget(true);
                return false;
            }

            SetHealingVisual(true);
            var offset = _healingTarget.transform.position - transform.position;
            offset.y = 0f;
            var healingRange = _progression.HealingRange;
            if (offset.sqrMagnitude > healingRange * healingRange)
            {
                _movement.MoveToSystem(_healingTarget.transform.position);
                return true;
            }

            _movement.StopMovement();
            FaceDirection(offset);
            if (Time.time < _nextHealAt)
            {
                return true;
            }

            _nextHealAt = Time.time + _progression.HealingCooldown;
            var previousHealth = _healingTarget.CurrentHealth;
            var herdTarget = _healingTarget.GetComponent<HerdAnimalController>();
            if (herdTarget != null)
            {
                herdTarget.ReceiveTreatment(
                    _progression.HealingAmount * _progression.HerdHealingMultiplier,
                    0.1f);
            }
            else
            {
                _healingTarget.Heal(_progression.HealingAmount);
            }

            var actualHealing = Mathf.Max(0f, _healingTarget.CurrentHealth - previousHealth);
            _progression.RecordHealing(actualHealing, herdTarget != null);
            if (!IsValidHealingTarget(_healingTarget))
            {
                ClearHealingTarget(true);
            }

            return true;
        }

        private void RefreshHealingTarget()
        {
            HealthComponent bestTarget = null;
            var bestScore = float.NegativeInfinity;
            var range = _progression.HealingDetectionRange;
            var rangeSquared = range * range;

            var wolves = FindObjectsByType<WolfCombatController>(FindObjectsSortMode.None);
            foreach (var wolf in wolves)
            {
                if (wolf == null || wolf.IsDowned || wolf.Health == null || wolf.Health.NormalizedHealth >= woundedTargetThreshold)
                {
                    continue;
                }

                ConsiderTarget(wolf.Health, 14f);
            }

            var herd = FindObjectsByType<HerdAnimalController>(FindObjectsSortMode.None);
            foreach (var animal in herd)
            {
                if (animal == null || animal.IsLost || animal.Health == null || animal.Health.NormalizedHealth >= woundedTargetThreshold)
                {
                    continue;
                }

                ConsiderTarget(animal.Health, 0f);
            }

            _healingTarget = bestTarget;

            void ConsiderTarget(HealthComponent candidate, float priorityBonus)
            {
                var distanceSquared = FlatDistanceSquared(transform.position, candidate.transform.position);
                if (distanceSquared > rangeSquared)
                {
                    return;
                }

                var missingHealthScore = (1f - candidate.NormalizedHealth) * 100f;
                var distancePenalty = Mathf.Sqrt(distanceSquared) * 1.35f;
                var score = missingHealthScore + priorityBonus - distancePenalty;
                if (score <= bestScore)
                {
                    return;
                }

                bestScore = score;
                bestTarget = candidate;
            }
        }

        private bool IsValidHealingTarget(HealthComponent candidate)
        {
            if (candidate == null || candidate.IsDepleted || candidate.NormalizedHealth >= woundedTargetThreshold)
            {
                return false;
            }

            var wolf = candidate.GetComponent<WolfCombatController>();
            if (wolf != null)
            {
                return !wolf.IsDowned;
            }

            var herd = candidate.GetComponent<HerdAnimalController>();
            return herd != null && !herd.IsLost;
        }

        private void ClearHealingTarget(bool clearVisual)
        {
            _healingTarget = null;
            if (clearVisual)
            {
                SetHealingVisual(false);
            }
        }

        private void SetHealingVisual(bool active)
        {
            if (_healingVisualActive == active)
            {
                return;
            }

            _healingVisualActive = active;
            if (active)
            {
                _movement.SetStatusColor(new Color(0.16f, 0.86f, 0.52f));
            }
            else if (!IsDowned && _rescueTarget == null)
            {
                _movement.ClearStatusColor();
            }
        }

        private void UpdateRescue()
        {
            if (_rescueTarget == null || !_rescueTarget.IsDowned)
            {
                CancelRescue();
                return;
            }

            var offset = _rescueTarget.transform.position - transform.position;
            offset.y = 0f;
            if (offset.sqrMagnitude > rescueRange * rescueRange)
            {
                _rescueProgress = 0f;
                _movement.MoveToSystem(_rescueTarget.transform.position);
                return;
            }

            _movement.StopMovement();
            FaceDirection(offset);
            _rescueProgress += Time.unscaledDeltaTime;
            if (_rescueProgress < CurrentRescueDuration)
            {
                return;
            }

            var rescued = _rescueTarget;
            if (rescued.Health.Revive(revivedHealthFraction))
            {
                rescued.transform.position += FlatDirectionAwayFrom(transform.position, rescued.transform.position) * 0.45f;
                _progression.RecordRescue();
            }
            CancelRescue();
        }

        private void RefreshTarget()
        {
            var activeDetectionRange = CurrentDetectionRange;
            if (_target != null && !_target.IsDefeated && _target.IsCombatActive)
            {
                var currentDistance = FlatDistanceSquared(transform.position, _target.transform.position);
                if (currentDistance <= activeDetectionRange * activeDetectionRange * 1.35f)
                {
                    return;
                }
            }

            _target = null;
            var bestDistance = activeDetectionRange * activeDetectionRange;
            var jackals = FindObjectsByType<JackalCombatController>(FindObjectsSortMode.None);
            foreach (var jackal in jackals)
            {
                if (jackal == null || jackal.IsDefeated || !jackal.IsCombatActive)
                {
                    continue;
                }

                var distance = FlatDistanceSquared(transform.position, jackal.transform.position);
                if (distance >= bestDistance)
                {
                    continue;
                }

                bestDistance = distance;
                _target = jackal;
            }
        }

        private void UpdateAttack()
        {
            if (_target == null || _target.IsDefeated || !_target.IsCombatActive)
            {
                return;
            }

            var offset = _target.transform.position - transform.position;
            offset.y = 0f;
            if (offset.sqrMagnitude > attackRange * attackRange)
            {
                _movement.MoveToSystem(_target.transform.position);
                return;
            }

            _movement.StopMovement();
            FaceDirection(offset);
            if (Time.time < _nextAttackAt)
            {
                return;
            }

            _nextAttackAt = Time.time + CurrentAttackCooldown;
            var previousHealth = _target.Health.CurrentHealth;
            var targetRole = _target.Role;
            var wasDefeated = _target.IsDefeated;
            _target.Health.ApplyDamage(new DamageInfo(CurrentAttackDamage, gameObject));
            var actualDamage = Mathf.Max(0f, previousHealth - _target.Health.CurrentHealth);
            _progression.RecordDamage(actualDamage);
            if (!wasDefeated && _target.IsDefeated)
            {
                _progression.RecordDefeat(targetRole);
            }
        }

        private void HandleDowned(HealthComponent health)
        {
            _target = null;
            ClearHealingTarget(true);
            CancelRescue();
            _movement.SetOperational(false);
            _movement.SetStatusColor(new Color(0.22f, 0.24f, 0.27f));
        }

        private void HandleRevived(HealthComponent health)
        {
            _movement.SetOperational(true);
            _movement.ClearStatusColor();
        }

        private void HandleProgressionChanged(WolfProgression progression)
        {
            if (_health == null || _health.MaximumHealth <= 0f)
            {
                return;
            }

            RefreshProgressionBonuses();
        }

        private void FaceDirection(Vector3 direction)
        {
            if (direction.sqrMagnitude <= 0.001f)
            {
                return;
            }

            transform.rotation = Quaternion.Slerp(
                transform.rotation,
                Quaternion.LookRotation(direction.normalized, Vector3.up),
                14f * Time.deltaTime);
        }

        private void EnsureComponents()
        {
            if (_movement == null)
            {
                _movement = GetComponent<SelectableWolf>();
            }

            if (_health == null)
            {
                _health = GetComponent<HealthComponent>();
            }

            if (_progression == null)
            {
                _progression = GetComponent<WolfProgression>();
            }
        }

        private static float FlatDistanceSquared(Vector3 first, Vector3 second)
        {
            var difference = first - second;
            difference.y = 0f;
            return difference.sqrMagnitude;
        }

        private static Vector3 FlatDirectionAwayFrom(Vector3 source, Vector3 destination)
        {
            var direction = destination - source;
            direction.y = 0f;
            return direction.sqrMagnitude <= 0.001f ? Vector3.forward : direction.normalized;
        }
    }
}
