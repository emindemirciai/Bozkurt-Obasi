using Bozkurt.Gameplay.Herd;
using UnityEngine;

namespace Bozkurt.Gameplay.Combat
{
    [DisallowMultipleComponent]
    [RequireComponent(typeof(HealthComponent))]
    public sealed class JackalCombatController : MonoBehaviour
    {
        [Header("Health")]
        [SerializeField, Min(1f)] private float maximumHealth = 65f;

        [Header("Attack")]
        [SerializeField, Min(0f)] private float attackDamage = 9f;
        [SerializeField, Min(0.2f)] private float attackRange = 1.45f;
        [SerializeField, Min(0.1f)] private float attackCooldown = 1.15f;
        [SerializeField, Min(0.1f)] private float movementSpeed = 3.25f;
        [SerializeField, Min(0.1f)] private float targetRefreshInterval = 0.4f;
        [SerializeField] private bool prefersHerd;

        [Header("WP-05 Pack Behaviour")]
        [SerializeField, Min(0.5f)] private float stagingStopDistance = 1.2f;
        [SerializeField, Min(2f)] private float howlInterval = 6.5f;

        private HealthComponent _health;
        private WolfCombatController _wolfTarget;
        private HerdAnimalController _herdTarget;
        private Collider _collider;
        private Renderer _renderer;
        private JackalPackCoordinator _pack;
        private float _nextAttackAt;
        private float _nextTargetRefreshAt;
        private float _nextHowlAt;
        private float _buffUntil;
        private float _damageBuffMultiplier = 1f;
        private float _speedBuffMultiplier = 1f;
        private int _directiveRevision = -1;
        private bool _stagingComplete;
        private bool _lastTargetPreference;

        public HealthComponent Health => _health;
        public bool IsDefeated => _health != null && _health.IsDepleted;
        public bool PrefersHerd => prefersHerd;
        public JackalRole Role { get; private set; } = JackalRole.Raider;
        public int PackSlot { get; private set; }
        public bool HasPackBuff => Time.time < _buffUntil;
        public bool IsCombatActive => _pack == null || _pack.BattleStarted;

        public void Initialize(float maxHealth, float damage, float speed, bool targetHerdFirst = false)
        {
            Initialize(maxHealth, damage, speed, JackalRole.Raider, null, 0, targetHerdFirst);
        }

        public void Initialize(
            float baseHealth,
            float baseDamage,
            float baseSpeed,
            JackalRole role,
            JackalPackCoordinator pack,
            int packSlot,
            bool? targetHerdFirst = null)
        {
            Role = role;
            PackSlot = Mathf.Max(0, packSlot);
            _pack = pack;

            var profile = JackalRoleCatalog.Get(role);
            maximumHealth = Mathf.Max(1f, baseHealth * profile.HealthMultiplier);
            attackDamage = Mathf.Max(0f, baseDamage * profile.DamageMultiplier);
            movementSpeed = Mathf.Max(0.1f, baseSpeed * profile.SpeedMultiplier);
            attackCooldown = Mathf.Max(0.1f, attackCooldown * profile.CooldownMultiplier);
            prefersHerd = targetHerdFirst ?? profile.PrefersHerd;
            _lastTargetPreference = prefersHerd;
            _nextHowlAt = Time.time + howlInterval * 0.65f;

            EnsureComponents();
            _health.Initialize(maximumHealth, false);
            _pack?.Register(this);
        }

        public void ApplyPackBuff(float duration, float damageMultiplier, float speedMultiplier)
        {
            if (IsDefeated)
            {
                return;
            }

            _buffUntil = Mathf.Max(_buffUntil, Time.time + Mathf.Max(0.1f, duration));
            _damageBuffMultiplier = Mathf.Max(_damageBuffMultiplier, Mathf.Max(1f, damageMultiplier));
            _speedBuffMultiplier = Mathf.Max(_speedBuffMultiplier, Mathf.Max(1f, speedMultiplier));
        }

        private void Awake()
        {
            EnsureComponents();
        }

        private void OnEnable()
        {
            EnsureComponents();
            _health.Depleted += HandleDefeated;
        }

        private void OnDisable()
        {
            if (_health != null)
            {
                _health.Depleted -= HandleDefeated;
            }
        }

        public void NotifyBattleStarted()
        {
            _nextAttackAt = Time.time + 0.25f;
            _nextTargetRefreshAt = 0f;
            _nextHowlAt = Time.time + howlInterval * 0.65f;
            _directiveRevision = -1;
            _stagingComplete = false;
            _wolfTarget = null;
            _herdTarget = null;
        }

        private void Update()
        {
            if (IsDefeated || !IsCombatActive)
            {
                return;
            }

            UpdateBuffState();
            RefreshDirectiveRevision();

            if (TryFollowStagingWaypoint())
            {
                return;
            }

            if (Role == JackalRole.Howler && Time.time >= _nextHowlAt)
            {
                _nextHowlAt = Time.time + howlInterval;
                _pack?.ApplyHowl(transform.position);
            }

            var preferHerdNow = _pack != null ? _pack.ShouldPreferHerd(this) : prefersHerd;
            if (preferHerdNow != _lastTargetPreference)
            {
                _lastTargetPreference = preferHerdNow;
                _wolfTarget = null;
                _herdTarget = null;
            }

            if (Time.time >= _nextTargetRefreshAt)
            {
                _nextTargetRefreshAt = Time.time + targetRefreshInterval;
                RefreshTarget(preferHerdNow);
            }

            if (!TryGetCurrentTarget(out var targetTransform, out var targetHealth))
            {
                return;
            }

            var offset = targetTransform.position - transform.position;
            offset.y = 0f;
            if (offset.sqrMagnitude > attackRange * attackRange)
            {
                MoveTowards(targetTransform.position);
                return;
            }

            FaceDirection(offset);
            if (Time.time < _nextAttackAt)
            {
                return;
            }

            _nextAttackAt = Time.time + attackCooldown;
            targetHealth.ApplyDamage(new DamageInfo(attackDamage * CurrentDamageMultiplier, gameObject));
        }

        private void RefreshDirectiveRevision()
        {
            if (_pack == null || _directiveRevision == _pack.TacticRevision)
            {
                return;
            }

            _directiveRevision = _pack.TacticRevision;
            _stagingComplete = false;
            _wolfTarget = null;
            _herdTarget = null;
        }

        private bool TryFollowStagingWaypoint()
        {
            if (_pack == null || _stagingComplete || !_pack.TryGetStagingWaypoint(this, out var waypoint))
            {
                return false;
            }

            waypoint.y = transform.position.y;
            var offset = waypoint - transform.position;
            offset.y = 0f;
            if (offset.sqrMagnitude <= stagingStopDistance * stagingStopDistance)
            {
                _stagingComplete = true;
                return false;
            }

            _wolfTarget = null;
            _herdTarget = null;
            MoveTowards(waypoint);
            return true;
        }

        private void RefreshTarget(bool preferHerdNow)
        {
            if (TryGetCurrentTarget(out _, out _))
            {
                return;
            }

            _wolfTarget = null;
            _herdTarget = null;

            if (preferHerdNow)
            {
                FindNearestHerdTarget();
                if (_herdTarget == null)
                {
                    FindNearestWolfTarget();
                }
            }
            else
            {
                FindNearestWolfTarget();
                if (_wolfTarget == null)
                {
                    FindNearestHerdTarget();
                }
            }
        }

        private bool TryGetCurrentTarget(out Transform targetTransform, out HealthComponent targetHealth)
        {
            if (_wolfTarget != null && !_wolfTarget.IsDowned)
            {
                targetTransform = _wolfTarget.transform;
                targetHealth = _wolfTarget.Health;
                return true;
            }

            if (_herdTarget != null && !_herdTarget.IsLost)
            {
                targetTransform = _herdTarget.transform;
                targetHealth = _herdTarget.Health;
                return true;
            }

            targetTransform = null;
            targetHealth = null;
            return false;
        }

        private void FindNearestWolfTarget()
        {
            var bestDistance = float.PositiveInfinity;
            var wolves = FindObjectsByType<WolfCombatController>(FindObjectsSortMode.None);
            foreach (var wolf in wolves)
            {
                if (wolf == null || wolf.IsDowned)
                {
                    continue;
                }

                var distance = FlatDistanceSquared(transform.position, wolf.transform.position);
                if (distance >= bestDistance)
                {
                    continue;
                }

                bestDistance = distance;
                _wolfTarget = wolf;
            }
        }

        private void FindNearestHerdTarget()
        {
            var bestScore = float.PositiveInfinity;
            var animals = FindObjectsByType<HerdAnimalController>(FindObjectsSortMode.None);
            foreach (var animal in animals)
            {
                if (animal == null || animal.IsLost)
                {
                    continue;
                }

                var distance = FlatDistanceSquared(transform.position, animal.transform.position);
                var vulnerabilityBonus = animal.AnimalType is HerdAnimalType.Lamb or HerdAnimalType.Calf or HerdAnimalType.Kid
                    ? 4f
                    : 0f;
                var defenderPenalty = animal.IsDefender ? 5f : 0f;
                var score = distance - vulnerabilityBonus + defenderPenalty;
                if (score >= bestScore)
                {
                    continue;
                }

                bestScore = score;
                _herdTarget = animal;
            }
        }

        private void MoveTowards(Vector3 destination)
        {
            destination.y = transform.position.y;
            var offset = destination - transform.position;
            offset.y = 0f;
            if (offset.sqrMagnitude <= 0.001f)
            {
                return;
            }

            var direction = offset.normalized;
            transform.position = Vector3.MoveTowards(
                transform.position,
                destination,
                movementSpeed * CurrentSpeedMultiplier * Time.deltaTime);
            FaceDirection(direction);
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
                11f * Time.deltaTime);
        }

        private void UpdateBuffState()
        {
            if (Time.time < _buffUntil)
            {
                return;
            }

            _damageBuffMultiplier = 1f;
            _speedBuffMultiplier = 1f;
        }

        private float CurrentDamageMultiplier => Time.time < _buffUntil ? _damageBuffMultiplier : 1f;
        private float CurrentSpeedMultiplier => Time.time < _buffUntil ? _speedBuffMultiplier : 1f;

        private void HandleDefeated(HealthComponent health)
        {
            _wolfTarget = null;
            _herdTarget = null;
            _pack?.NotifyDefeated(this);
            if (_collider != null)
            {
                _collider.enabled = false;
            }

            if (_renderer != null)
            {
                _renderer.material.color = new Color(0.16f, 0.13f, 0.1f);
            }

            transform.localScale = new Vector3(
                transform.localScale.x,
                transform.localScale.y * 0.35f,
                transform.localScale.z);
            Destroy(gameObject, 1.8f);
        }

        private void EnsureComponents()
        {
            if (_health == null)
            {
                _health = GetComponent<HealthComponent>();
            }

            if (_collider == null)
            {
                _collider = GetComponent<Collider>();
            }

            if (_renderer == null)
            {
                _renderer = GetComponentInChildren<Renderer>();
            }
        }

        private static float FlatDistanceSquared(Vector3 first, Vector3 second)
        {
            var difference = first - second;
            difference.y = 0f;
            return difference.sqrMagnitude;
        }
    }
}
