using Bozkurt.Gameplay.Combat;
using Bozkurt.Gameplay.Formations;
using UnityEngine;

namespace Bozkurt.Gameplay.Herd
{
    public enum HerdAnimalType
    {
        Sheep = 0,
        Lamb = 1,
        Goat = 2,
        Kid = 3,
        Cow = 4,
        Calf = 5,
        Bull = 6,
        Ram = 7
    }

    [DisallowMultipleComponent]
    [RequireComponent(typeof(HealthComponent))]
    public sealed class HerdAnimalController : MonoBehaviour
    {
        [Header("Movement")]
        [SerializeField, Min(0.1f)] private float movementSpeed = 2.7f;
        [SerializeField, Min(0.1f)] private float rotationSpeed = 8f;
        [SerializeField, Min(0.2f)] private float formationStopDistance = 0.18f;

        [Header("Panic")]
        [SerializeField, Min(0.5f)] private float panicRadius = 6f;
        [SerializeField, Min(0.5f)] private float safeRadius = 9f;
        [SerializeField, Min(0.1f)] private float panicBuildPerSecond = 0.72f;
        [SerializeField, Min(0.05f)] private float panicRecoveryPerSecond = 0.24f;
        [SerializeField, Range(0.05f, 1f)] private float panicMoveThreshold = 0.42f;
        [SerializeField, Min(0.5f)] private float panicFleeDistance = 4.25f;
        [SerializeField, Min(1f)] private float panicSpeedMultiplier = 1.65f;

        [Header("Natural Defence")]
        [SerializeField, Min(0f)] private float defenceDamage;
        [SerializeField, Min(0.2f)] private float defenceRange = 1.65f;
        [SerializeField, Min(0.1f)] private float defenceCooldown = 1.15f;
        [SerializeField, Min(0.5f)] private float defenderGuardRadius = 5f;

        [Header("Sensing")]
        [SerializeField, Min(0.05f)] private float targetRefreshInterval = 0.3f;

        private HealthComponent _health;
        private JackalCombatController _nearestThreat;
        private Renderer _renderer;
        private Material _material;
        private Collider _collider;
        private Color _baseColor = Color.white;
        private Vector3 _formationPosition;
        private float _panic01;
        private float _nextTargetRefreshAt;
        private float _nextDefenceAttackAt;
        private float _forcedPanicUntil;
        private Vector3 _forcedDangerOrigin;
        private float _healingVisualUntil;

        public HerdAnimalType AnimalType { get; private set; }
        public StarRegion Region { get; private set; }
        public HealthComponent Health => _health;
        public Vector3 FormationPosition => _formationPosition;
        public float Panic01 => _panic01;
        public bool IsPanicked => !IsLost && _panic01 >= panicMoveThreshold;
        public bool IsLost => _health != null && _health.IsDepleted;
        public bool IsDefender => defenceDamage > 0f;

        public void Initialize(
            HerdAnimalType animalType,
            StarRegion region,
            Vector3 formationPosition,
            float maximumHealth,
            float speed,
            float naturalDefenceDamage,
            Color baseColor)
        {
            AnimalType = animalType;
            Region = region;
            movementSpeed = Mathf.Max(0.1f, speed);
            defenceDamage = Mathf.Max(0f, naturalDefenceDamage);
            _formationPosition = FlattenToCurrentHeight(formationPosition);
            _baseColor = baseColor;

            EnsureComponents();
            _health.Initialize(Mathf.Max(1f, maximumHealth), false);
            ApplyVisualState();
        }

        public void SetFormationPosition(Vector3 position, StarRegion region)
        {
            _formationPosition = FlattenToCurrentHeight(position);
            Region = region;
        }

        public void CalmAndReturn()
        {
            _panic01 = 0f;
            _forcedPanicUntil = 0f;
            _nearestThreat = null;
            ApplyVisualState();
        }

        public void ForcePanic(Vector3 dangerOrigin, float duration = 3.2f)
        {
            if (IsLost)
            {
                return;
            }

            _forcedDangerOrigin = dangerOrigin;
            _forcedPanicUntil = Mathf.Max(_forcedPanicUntil, Time.time + Mathf.Max(0.5f, duration));
            _panic01 = 1f;
            ApplyVisualState();
        }

        public float ReceiveTreatment(float healingAmount, float panicReduction = 0.12f)
        {
            if (IsLost)
            {
                return 0f;
            }

            var previousHealth = _health.CurrentHealth;
            _health.Heal(Mathf.Max(0f, healingAmount));
            _panic01 = Mathf.Max(0f, _panic01 - Mathf.Max(0f, panicReduction));
            _healingVisualUntil = Time.time + 0.42f;
            ApplyVisualState();
            return Mathf.Max(0f, _health.CurrentHealth - previousHealth);
        }

        public void RestoreState(float normalizedHealth, bool lost, float panic)
        {
            EnsureComponents();
            _panic01 = Mathf.Clamp01(panic);
            _forcedPanicUntil = 0f;
            _nearestThreat = null;
            _health.RestoreState(normalizedHealth, lost);
            ApplyVisualState();
        }

        private void Awake()
        {
            EnsureComponents();
        }

        private void OnEnable()
        {
            EnsureComponents();
            _health.Depleted += HandleLost;
        }

        private void OnDisable()
        {
            if (_health != null)
            {
                _health.Depleted -= HandleLost;
            }
        }

        private void Update()
        {
            if (IsLost)
            {
                return;
            }

            if (Time.time >= _nextTargetRefreshAt)
            {
                _nextTargetRefreshAt = Time.time + targetRefreshInterval;
                RefreshNearestThreat();
            }

            var hasDanger = TryGetDangerPosition(out var dangerPosition, out var dangerDistance);
            UpdatePanic(hasDanger, dangerDistance);

            if (IsDefender && _nearestThreat != null && !_nearestThreat.IsDefeated && _nearestThreat.IsCombatActive)
            {
                if (TryDefendAgainstThreat(_nearestThreat))
                {
                    ApplyVisualState();
                    return;
                }
            }

            if (IsPanicked && hasDanger)
            {
                FleeFrom(dangerPosition);
            }
            else
            {
                MoveTowards(_formationPosition, movementSpeed);
            }

            ApplyVisualState();
        }

        private bool TryDefendAgainstThreat(JackalCombatController threat)
        {
            var threatPosition = threat.transform.position;
            var distanceFromPost = FlatDistance(_formationPosition, threatPosition);
            if (distanceFromPost > defenderGuardRadius)
            {
                return false;
            }

            var distance = FlatDistance(transform.position, threatPosition);
            if (distance > defenceRange)
            {
                MoveTowards(threatPosition, movementSpeed * 1.12f);
                return true;
            }

            FaceDirection(threatPosition - transform.position);
            if (Time.time < _nextDefenceAttackAt)
            {
                return true;
            }

            _nextDefenceAttackAt = Time.time + defenceCooldown;
            threat.Health.ApplyDamage(new DamageInfo(defenceDamage, gameObject));
            _panic01 = Mathf.Max(0f, _panic01 - 0.18f);
            return true;
        }

        private void UpdatePanic(bool hasDanger, float dangerDistance)
        {
            if (hasDanger && dangerDistance <= safeRadius)
            {
                var closeness = 1f - Mathf.InverseLerp(panicRadius, safeRadius, dangerDistance);
                _panic01 = Mathf.Clamp01(_panic01 + panicBuildPerSecond * Mathf.Lerp(0.35f, 1f, closeness) * Time.deltaTime);
                return;
            }

            _panic01 = Mathf.MoveTowards(_panic01, 0f, panicRecoveryPerSecond * Time.deltaTime);
        }

        private bool TryGetDangerPosition(out Vector3 dangerPosition, out float dangerDistance)
        {
            if (Time.time < _forcedPanicUntil)
            {
                dangerPosition = _forcedDangerOrigin;
                dangerDistance = 0f;
                return true;
            }

            if (_nearestThreat != null && !_nearestThreat.IsDefeated && _nearestThreat.IsCombatActive)
            {
                dangerPosition = _nearestThreat.transform.position;
                dangerDistance = FlatDistance(transform.position, dangerPosition);
                return true;
            }

            dangerPosition = Vector3.zero;
            dangerDistance = float.PositiveInfinity;
            return false;
        }

        private void FleeFrom(Vector3 dangerPosition)
        {
            var away = transform.position - dangerPosition;
            away.y = 0f;
            if (away.sqrMagnitude <= 0.001f)
            {
                away = transform.position - _formationPosition;
                away.y = 0f;
            }
            if (away.sqrMagnitude <= 0.001f)
            {
                away = Vector3.back;
            }

            var destination = _formationPosition + away.normalized * panicFleeDistance * Mathf.Lerp(0.55f, 1f, _panic01);
            MoveTowards(destination, movementSpeed * panicSpeedMultiplier);
        }

        private void MoveTowards(Vector3 destination, float speed)
        {
            destination.y = transform.position.y;
            var offset = destination - transform.position;
            offset.y = 0f;
            if (offset.sqrMagnitude <= formationStopDistance * formationStopDistance)
            {
                transform.position = destination;
                return;
            }

            var direction = offset.normalized;
            transform.position = Vector3.MoveTowards(transform.position, destination, speed * Time.deltaTime);
            FaceDirection(direction);
        }

        private void FaceDirection(Vector3 direction)
        {
            direction.y = 0f;
            if (direction.sqrMagnitude <= 0.001f)
            {
                return;
            }

            transform.rotation = Quaternion.Slerp(
                transform.rotation,
                Quaternion.LookRotation(direction.normalized, Vector3.up),
                rotationSpeed * Time.deltaTime);
        }

        private void RefreshNearestThreat()
        {
            if (_nearestThreat != null && !_nearestThreat.IsDefeated && _nearestThreat.IsCombatActive)
            {
                var currentDistance = FlatDistance(transform.position, _nearestThreat.transform.position);
                if (currentDistance <= safeRadius * 1.35f)
                {
                    return;
                }
            }

            _nearestThreat = null;
            var bestDistance = float.PositiveInfinity;
            var jackals = FindObjectsByType<JackalCombatController>(FindObjectsSortMode.None);
            foreach (var candidate in jackals)
            {
                if (candidate == null || candidate.IsDefeated || !candidate.IsCombatActive)
                {
                    continue;
                }

                var distance = FlatDistanceSquared(transform.position, candidate.transform.position);
                if (distance >= bestDistance)
                {
                    continue;
                }

                bestDistance = distance;
                _nearestThreat = candidate;
            }
        }

        private void HandleLost(HealthComponent health)
        {
            _panic01 = 0f;
            _nearestThreat = null;
            if (_collider != null)
            {
                _collider.enabled = false;
            }

            if (_material != null)
            {
                _material.color = new Color(0.18f, 0.16f, 0.14f);
            }

            transform.localScale = new Vector3(
                transform.localScale.x,
                transform.localScale.y * 0.32f,
                transform.localScale.z);
        }

        private void ApplyVisualState()
        {
            if (_material == null || IsLost)
            {
                return;
            }

            var panicColor = new Color(1f, 0.48f, 0.12f);
            var currentColor = Color.Lerp(_baseColor, panicColor, _panic01 * 0.72f);
            if (Time.time < _healingVisualUntil)
            {
                currentColor = Color.Lerp(currentColor, new Color(0.2f, 1f, 0.52f), 0.68f);
            }
            _material.color = currentColor;
        }

        private void EnsureComponents()
        {
            if (_health == null)
            {
                _health = GetComponent<HealthComponent>();
            }

            if (_renderer == null)
            {
                _renderer = GetComponentInChildren<Renderer>();
                if (_renderer != null)
                {
                    _material = _renderer.material;
                    if (_baseColor == Color.white)
                    {
                        _baseColor = _material.color;
                    }
                }
            }

            if (_collider == null)
            {
                _collider = GetComponent<Collider>();
            }
        }

        private Vector3 FlattenToCurrentHeight(Vector3 position)
        {
            return new Vector3(position.x, transform.position.y, position.z);
        }

        private static float FlatDistance(Vector3 first, Vector3 second)
        {
            return Mathf.Sqrt(FlatDistanceSquared(first, second));
        }

        private static float FlatDistanceSquared(Vector3 first, Vector3 second)
        {
            var difference = first - second;
            difference.y = 0f;
            return difference.sqrMagnitude;
        }
    }
}
