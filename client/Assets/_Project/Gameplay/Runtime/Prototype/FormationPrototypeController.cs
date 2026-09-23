using System.Collections.Generic;
using Bozkurt.Gameplay.Combat;
using Bozkurt.Gameplay.Formations;
using Bozkurt.Gameplay.Herd;
using Bozkurt.Gameplay.Progression;
using Bozkurt.Gameplay.Save;
using UnityEngine;

namespace Bozkurt.Gameplay.Prototype
{
    public enum CrescentMode
    {
        Tight = 0,
        Balanced = 1,
        Wide = 2
    }

    public enum StarMode
    {
        Tight = 0,
        Balanced = 1,
        Open = 2
    }

    public enum PrototypeBattlePhase
    {
        Preparation = 0,
        Active = 1,
        Victory = 2,
        Defeat = 3
    }

    public sealed class FormationPrototypeController : MonoBehaviour
    {
        [Header("Counts")]
        [SerializeField, Min(1)] private int wolfCount = 5;
        [SerializeField, Min(1)] private int herdCount = 24;
        [SerializeField, Min(0)] private int jackalCount = 12;

        [Header("Layout")]
        [SerializeField] private Vector3 crescentOrigin = new(0f, 0f, 4f);
        [SerializeField] private Vector3 starOrigin = new(0f, 0f, -5f);
        [SerializeField] private float crescentWidth = 14f;
        [SerializeField] private float crescentDepth = 5f;
        [SerializeField] private float starRadius = 6f;
        [SerializeField] private CrescentMode crescentMode = CrescentMode.Balanced;
        [SerializeField] private StarMode starMode = StarMode.Balanced;

        [Header("WP-02 Combat Balance")]
        [SerializeField, Min(1f)] private float wolfHealth = 120f;
        [SerializeField, Min(0f)] private float wolfDamage = 22f;
        [SerializeField, Min(1f)] private float jackalHealth = 65f;
        [SerializeField, Min(0f)] private float jackalDamage = 9f;
        [SerializeField, Min(0.1f)] private float jackalSpeed = 3.25f;

        [Header("WP-03 Crescent Integrity")]
        [SerializeField, Min(0.5f)] private float fullIntegrityDistance = 1.25f;
        [SerializeField, Min(1f)] private float zeroIntegrityDistance = 7.5f;
        [SerializeField, Range(0f, 1f)] private float unityBonusThreshold = 0.8f;

        [Header("WP-04 Star Integrity")]
        [SerializeField, Min(0.25f)] private float fullStarIntegrityDistance = 0.9f;
        [SerializeField, Min(1f)] private float zeroStarIntegrityDistance = 5.5f;
        [SerializeField, Range(0f, 1f)] private float maximumUnityPanic = 0.4f;

        private readonly List<GameObject> _spawned = new();
        private readonly List<SelectableWolf> _wolves = new();
        private readonly List<WolfCombatController> _wolfCombatants = new();
        private readonly List<WolfProgression> _wolfProgressions = new();
        private readonly Dictionary<int, WolfProgressionSnapshot> _progressionSnapshots = new();
        private readonly List<HerdAnimalController> _herdAnimals = new();
        private readonly List<JackalCombatController> _jackals = new();
        private JackalPackCoordinator _jackalPack;
        private PrototypeBattlePhase _battlePhase = PrototypeBattlePhase.Preparation;
        private bool _waveRewardsGranted;
        private Vector3 _jackalSpawnAnchor;
        private int _waveNumber = 1;

        public int TotalWolfCount => _wolfCombatants.Count;
        public int ActiveWolfCount => CountActiveWolves();
        public int DownedWolfCount => TotalWolfCount - ActiveWolfCount;
        public int TotalHerdCount => _herdAnimals.Count;
        public int ActiveHerdCount => CountActiveHerd();
        public int LostHerdCount => TotalHerdCount - ActiveHerdCount;
        public int PanickedHerdCount => CountPanickedHerd();
        public int TotalJackalCount => jackalCount;
        public int RemainingJackalCount => CountRemainingJackals();
        public int ActiveHealerCount => CountActiveHealers();
        public int WoundedWolfCount => CountWoundedWolves();
        public int WoundedHerdCount => CountWoundedHerd();
        public int TreatableHerdCount => CountTreatableHerd();
        public bool IsVictory => _battlePhase == PrototypeBattlePhase.Victory;
        public bool IsDefeat => _battlePhase == PrototypeBattlePhase.Defeat;
        public bool IsBattleActive => _battlePhase == PrototypeBattlePhase.Active;
        public bool IsPreparingBattle => _battlePhase == PrototypeBattlePhase.Preparation;
        public PrototypeBattlePhase BattlePhase => _battlePhase;
        public string BattlePhaseName => _battlePhase switch
        {
            PrototypeBattlePhase.Active => "Savaş sürüyor",
            PrototypeBattlePhase.Victory => "Dalga püskürtüldü",
            PrototypeBattlePhase.Defeat => "Savunma hattı kırıldı",
            _ => "Hazırlık"
        };
        public CrescentMode CurrentCrescentMode => crescentMode;
        public StarMode CurrentStarMode => starMode;
        public string CurrentCrescentModeName => crescentMode switch
        {
            CrescentMode.Tight => "Sıkı",
            CrescentMode.Wide => "Geniş",
            _ => "Dengeli"
        };
        public string CurrentStarModeName => starMode switch
        {
            StarMode.Tight => "Sıkı",
            StarMode.Open => "Açık",
            _ => "Dengeli"
        };
        public string CurrentJackalTacticName => _jackalPack != null ? _jackalPack.CurrentTacticName : "Doğrudan saldırı";
        public bool IsJackalLeaderAlive => _jackalPack != null && _jackalPack.LeaderAlive;
        public int JackalHowlCount => _jackalPack != null ? _jackalPack.HowlCount : 0;
        public int HighestWolfLevel => GetHighestWolfLevel();
        public int TotalUnspentTrainingPoints => GetTotalUnspentTrainingPoints();
        public int WaveNumber => _waveNumber;
        public Vector3 CurrentStarOrigin => starOrigin;
        public Vector3 CurrentCrescentOrigin => crescentOrigin;
        public bool CanPrepareNextBattle => !IsBattleActive && ActiveWolfCount > 0 && ActiveHerdCount > 0;
        public float CrescentIntegrity01 => CalculateCrescentIntegrity();
        public float StarIntegrity01 => CalculateStarIntegrity();
        public float AverageHerdPanic01 => CalculateAverageHerdPanic();
        public bool IsUnityBonusActive =>
            ActiveWolfCount >= 3
            && ActiveHerdCount > 0
            && CrescentIntegrity01 >= unityBonusThreshold
            && StarIntegrity01 >= unityBonusThreshold
            && AverageHerdPanic01 <= maximumUnityPanic;

        private void Start() => RebuildPreview(false);

        private void Update()
        {
            if (_battlePhase != PrototypeBattlePhase.Active)
            {
                return;
            }

            if (TotalJackalCount > 0 && RemainingJackalCount == 0)
            {
                CompleteBattle(PrototypeBattlePhase.Victory);
            }
            else if ((TotalWolfCount > 0 && ActiveWolfCount == 0) || (TotalHerdCount > 0 && ActiveHerdCount == 0))
            {
                CompleteBattle(PrototypeBattlePhase.Defeat);
            }
        }

        [ContextMenu("Rebuild Preview")]
        public void BuildPreview() => RebuildPreview(_wolfProgressions.Count > 0);

        public void ResetCombat() => RebuildPreview(true);

        private void RebuildPreview(bool preserveProgression)
        {
            if (preserveProgression)
            {
                CaptureWolfProgression();
            }
            else
            {
                _progressionSnapshots.Clear();
            }

            ClearPreview();
            EnsureJackalPack();
            _jackalPack.Initialize(crescentOrigin, starOrigin);
            _battlePhase = PrototypeBattlePhase.Preparation;
            _waveRewardsGranted = false;
            _waveNumber = 1;
            SpawnGroundMarkings();
            SpawnWolves();
            SpawnHerd();
            SpawnJackals();
            ApplyCrescentMode(false);
            ApplyStarMode(false);
            SetWolfCombatEnabled(false);
        }

        public void StartBattle()
        {
            if (_battlePhase != PrototypeBattlePhase.Preparation || RemainingJackalCount <= 0)
            {
                return;
            }

            // Hazırlık sırasında sürü başka bir noktaya göç etmiş olabilir.
            // Çakalları savaşı başlattığımız andaki ay-yıldız konumuna taşı.
            RelocatePreparedJackalsToCurrentAnchor();
            _battlePhase = PrototypeBattlePhase.Active;
            SetWolfCombatEnabled(true);
            _jackalPack?.StartBattle();
        }

        public void PrepareNextBattle()
        {
            if (!CanPrepareNextBattle)
            {
                return;
            }

            ClearJackalsOnly();
            EnsureJackalPack();
            _jackalPack.Initialize(crescentOrigin, starOrigin);
            _battlePhase = PrototypeBattlePhase.Preparation;
            _waveRewardsGranted = false;
            _waveNumber++;
            SpawnJackals();
            SetWolfCombatEnabled(false);
        }

        public void MoveFormationCenter(Vector3 newStarOrigin, bool commandUnits)
        {
            var translation = newStarOrigin - starOrigin;
            translation.y = 0f;
            if (translation.sqrMagnitude <= 0.000001f)
            {
                return;
            }

            starOrigin += translation;
            crescentOrigin += translation;
            ApplyCrescentMode(commandUnits);
            ApplyStarMode(commandUnits);
            _jackalPack?.UpdateAnchors(crescentOrigin, starOrigin);
        }

        public void RestoreAllWolves()
        {
            foreach (var wolf in _wolfCombatants)
            {
                if (wolf != null)
                {
                    wolf.RestoreFullHealth();
                }
            }

            ReturnWolvesToFormation();
        }

        public void SetTightCrescent()
        {
            crescentMode = CrescentMode.Tight;
            ApplyCrescentMode(true);
        }

        public void SetBalancedCrescent()
        {
            crescentMode = CrescentMode.Balanced;
            ApplyCrescentMode(true);
        }

        public void SetWideCrescent()
        {
            crescentMode = CrescentMode.Wide;
            ApplyCrescentMode(true);
        }

        public void SetTightStar()
        {
            starMode = StarMode.Tight;
            ApplyStarMode(true);
        }

        public void SetBalancedStar()
        {
            starMode = StarMode.Balanced;
            ApplyStarMode(true);
        }

        public void SetOpenStar()
        {
            starMode = StarMode.Open;
            ApplyStarMode(true);
        }

        public void ReturnHerdToFormation()
        {
            foreach (var animal in _herdAnimals)
            {
                if (animal != null && !animal.IsLost)
                {
                    animal.CalmAndReturn();
                }
            }
        }

        public int TreatHerd(float healthFraction = 0.28f, float panicReduction = 0.3f)
        {
            var affected = 0;
            foreach (var animal in _herdAnimals)
            {
                if (animal == null || animal.IsLost)
                {
                    continue;
                }

                var wasTreatable = animal.Health.NormalizedHealth < 0.999f || animal.Panic01 > 0.01f;
                if (!wasTreatable)
                {
                    continue;
                }

                animal.ReceiveTreatment(
                    animal.Health.MaximumHealth * Mathf.Clamp01(healthFraction),
                    Mathf.Max(0f, panicReduction));
                affected++;
            }

            return affected;
        }

        public int ApplyCampTreatment(
            float wolfHealthFraction,
            float herdHealthFraction,
            float panicReduction,
            bool reviveDownedWolves)
        {
            var affected = 0;
            var clampedWolfFraction = Mathf.Clamp01(wolfHealthFraction);
            var clampedHerdFraction = Mathf.Clamp01(herdHealthFraction);
            var clampedPanicReduction = Mathf.Clamp01(panicReduction);

            foreach (var wolf in _wolfCombatants)
            {
                if (wolf == null || wolf.Health == null)
                {
                    continue;
                }

                if (wolf.IsDowned)
                {
                    if (reviveDownedWolves && wolf.Health.Revive(0.45f))
                    {
                        affected++;
                    }
                    continue;
                }

                if (wolf.Health.NormalizedHealth < 0.999f
                    && wolf.Health.Heal(wolf.Health.MaximumHealth * clampedWolfFraction))
                {
                    affected++;
                }
            }

            foreach (var animal in _herdAnimals)
            {
                if (animal == null || animal.IsLost)
                {
                    continue;
                }

                var wasTreatable = animal.Health.NormalizedHealth < 0.999f
                    || animal.Panic01 > 0.01f;
                if (!wasTreatable)
                {
                    continue;
                }

                animal.ReceiveTreatment(
                    animal.Health.MaximumHealth * clampedHerdFraction,
                    clampedPanicReduction);
                affected++;
            }

            if (reviveDownedWolves)
            {
                ReturnWolvesToFormation();
                ReturnHerdToFormation();
            }

            return affected;
        }

        public FormationSessionData CaptureSessionData()
        {
            var data = new FormationSessionData
            {
                waveNumber = _waveNumber,
                crescentMode = (int)crescentMode,
                starMode = (int)starMode,
                jackalTactic = _jackalPack != null ? (int)_jackalPack.CurrentTactic : 0,
                starOrigin = ToSerializable(starOrigin),
                crescentOrigin = ToSerializable(crescentOrigin)
            };

            for (var index = 0; index < _wolfCombatants.Count; index++)
            {
                var combat = _wolfCombatants[index];
                var progression = index < _wolfProgressions.Count ? _wolfProgressions[index] : null;
                if (combat == null || progression == null)
                {
                    continue;
                }

                data.wolves.Add(new WolfSessionData
                {
                    progression = progression.CaptureSnapshot(),
                    normalizedHealth = combat.Health != null ? combat.Health.NormalizedHealth : 1f,
                    downed = combat.IsDowned
                });
            }

            foreach (var animal in _herdAnimals)
            {
                if (animal == null)
                {
                    continue;
                }

                data.herd.Add(new HerdSessionData
                {
                    animalType = (int)animal.AnimalType,
                    normalizedHealth = animal.Health != null ? animal.Health.NormalizedHealth : 1f,
                    lost = animal.IsLost,
                    panic01 = animal.Panic01
                });
            }

            return data;
        }

        public void RestoreSessionData(FormationSessionData data)
        {
            if (data == null)
            {
                return;
            }

            _progressionSnapshots.Clear();
            if (data.wolves != null)
            {
                foreach (var wolf in data.wolves)
                {
                    if (wolf?.progression != null)
                    {
                        _progressionSnapshots[wolf.progression.WolfIndex] = wolf.progression;
                    }
                }
            }

            crescentMode = System.Enum.IsDefined(typeof(CrescentMode), data.crescentMode)
                ? (CrescentMode)data.crescentMode
                : CrescentMode.Balanced;
            starMode = System.Enum.IsDefined(typeof(StarMode), data.starMode)
                ? (StarMode)data.starMode
                : StarMode.Balanced;
            starOrigin = ToVector3(data.starOrigin);
            crescentOrigin = ToVector3(data.crescentOrigin);

            ClearPreview();
            EnsureJackalPack();
            _jackalPack.Initialize(crescentOrigin, starOrigin);
            _battlePhase = PrototypeBattlePhase.Preparation;
            _waveRewardsGranted = false;
            _waveNumber = Mathf.Max(1, data.waveNumber);
            SpawnGroundMarkings();
            SpawnWolves();
            SpawnHerd();
            SpawnJackals();
            ApplyCrescentMode(false);
            ApplyStarMode(false);
            SetWolfCombatEnabled(false);

            if (System.Enum.IsDefined(typeof(JackalPackTactic), data.jackalTactic))
            {
                _jackalPack.TrySetPlannedTactic((JackalPackTactic)data.jackalTactic);
            }

            if (data.wolves != null)
            {
                var count = Mathf.Min(data.wolves.Count, _wolfCombatants.Count);
                for (var index = 0; index < count; index++)
                {
                    var saved = data.wolves[index];
                    _wolfCombatants[index]?.Health?.RestoreState(saved.normalizedHealth, saved.downed);
                }
            }

            if (data.herd != null)
            {
                var count = Mathf.Min(data.herd.Count, _herdAnimals.Count);
                for (var index = 0; index < count; index++)
                {
                    var saved = data.herd[index];
                    _herdAnimals[index]?.RestoreState(saved.normalizedHealth, saved.lost, saved.panic01);
                }
            }
        }

        private static SerializableVector3 ToSerializable(Vector3 value)
        {
            return new SerializableVector3(value.x, value.y, value.z);
        }

        private static Vector3 ToVector3(SerializableVector3 value)
        {
            return new Vector3(value.x, value.y, value.z);
        }

        public void GrantExperienceToAllWolves(int amount)
        {
            if (amount <= 0)
            {
                return;
            }

            foreach (var progression in _wolfProgressions)
            {
                progression?.AddExperience(amount);
            }
        }

        public void TriggerHerdPanicTest()
        {
            foreach (var animal in _herdAnimals)
            {
                if (animal != null && !animal.IsLost)
                {
                    animal.ForcePanic(starOrigin, 3.5f);
                }
            }
        }

        public void AdvanceJackalTactic()
        {
            EnsureJackalPack();
            _jackalPack.CyclePlannedTactic();
        }

        public bool SetJackalTactic(JackalPackTactic tactic)
        {
            EnsureJackalPack();
            return _jackalPack.TrySetPlannedTactic(tactic);
        }

        private void SpawnGroundMarkings()
        {
            var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name = "Bozkır Zemin";
            ground.transform.SetParent(transform);
            ground.transform.localScale = new Vector3(6f, 1f, 5f);
            ground.GetComponent<Renderer>().sharedMaterial = CreateMaterial(new Color(0.37f, 0.33f, 0.18f));
            _spawned.Add(ground);
        }

        private void SpawnWolves()
        {
            var points = GenerateCurrentCrescentPoints();

            for (var index = 0; index < points.Count; index++)
            {
                var starterHealer = index == Mathf.Min(wolfCount - 1, 4);
                var wolf = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                wolf.name = starterHealer ? $"Şifacı_Kurt_{index + 1:00}" : $"Kurt_{index + 1:00}";
                wolf.transform.SetParent(transform);
                wolf.transform.position = points[index] + Vector3.up * 0.75f;
                wolf.transform.localScale = new Vector3(0.8f, 0.75f, 1.2f);
                wolf.transform.rotation = Quaternion.LookRotation(Vector3.forward);
                wolf.GetComponent<Renderer>().sharedMaterial = CreateMaterial(
                    starterHealer
                        ? new Color(0.18f, 0.56f, 0.46f)
                        : new Color(0.28f, 0.34f, 0.42f));

                var selectable = wolf.AddComponent<SelectableWolf>();
                selectable.Initialize(index, wolf.transform.position);

                _progressionSnapshots.TryGetValue(index, out var snapshot);
                var progression = wolf.AddComponent<WolfProgression>();
                progression.Initialize(index, snapshot, starterHealer);

                var combat = wolf.AddComponent<WolfCombatController>();
                combat.Initialize(wolfHealth, wolfDamage);

                var healthBar = wolf.AddComponent<WorldHealthBar>();
                healthBar.Initialize(combat.Health, 1.85f, 1.25f, new Color(0.2f, 0.72f, 0.32f));

                _wolves.Add(selectable);
                _wolfCombatants.Add(combat);
                _wolfProgressions.Add(progression);
                _spawned.Add(wolf);
            }
        }

        private void SpawnHerd()
        {
            var points = GenerateCurrentStarPoints();
            var regionSlots = new Dictionary<StarRegion, int>();

            for (var index = 0; index < points.Count; index++)
            {
                var point = points[index];
                var region = StarFormation.ClassifyRegion(point, starOrigin, CurrentStarRadius * 0.24f);
                regionSlots.TryGetValue(region, out var regionSlot);
                regionSlots[region] = regionSlot + 1;

                var animalType = ChooseAnimalType(region, regionSlot);
                var profile = GetAnimalProfile(animalType);
                var animal = GameObject.CreatePrimitive(profile.Primitive);
                animal.name = $"{GetAnimalDisplayName(animalType)}_{index + 1:00}";
                animal.transform.SetParent(transform);
                animal.transform.position = point + Vector3.up * profile.Height;
                animal.transform.localScale = profile.Scale;
                animal.transform.rotation = Quaternion.LookRotation(Vector3.forward);
                animal.GetComponent<Renderer>().sharedMaterial = CreateMaterial(profile.Color);

                var controller = animal.AddComponent<HerdAnimalController>();
                controller.Initialize(
                    animalType,
                    region,
                    animal.transform.position,
                    profile.Health,
                    profile.Speed,
                    profile.DefenceDamage,
                    profile.Color);

                var healthBar = animal.AddComponent<WorldHealthBar>();
                var healthBarWidth = profile.DefenceDamage > 0f || profile.Health >= 100f ? 1.05f : 0.72f;
                healthBar.Initialize(controller.Health, profile.Height + 1.15f, healthBarWidth, new Color(0.2f, 0.68f, 0.88f));

                _herdAnimals.Add(controller);
                _spawned.Add(animal);
            }
        }

        private void SpawnJackals()
        {
            if (jackalCount <= 0)
            {
                return;
            }

            EnsureJackalPack();
            _jackalSpawnAnchor = crescentOrigin;
            for (var index = 0; index < jackalCount; index++)
            {
                var role = ChooseJackalRole(index);
                var profile = JackalRoleCatalog.Get(role);
                var t = jackalCount == 1 ? 0.5f : index / (float)(jackalCount - 1);
                var jackal = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                jackal.name = $"{JackalRoleNames.GetDisplayName(role)}_{index + 1:00}";
                jackal.transform.SetParent(transform);
                jackal.transform.position = GetJackalSpawnPosition(index, t, role);
                jackal.transform.localScale = profile.Scale;
                jackal.transform.rotation = Quaternion.LookRotation(Vector3.back);
                jackal.GetComponent<Renderer>().sharedMaterial = CreateMaterial(profile.Color);

                var combat = jackal.AddComponent<JackalCombatController>();
                combat.Initialize(
                    jackalHealth,
                    jackalDamage,
                    jackalSpeed,
                    role,
                    _jackalPack,
                    index);

                var healthBar = jackal.AddComponent<WorldHealthBar>();
                var barColor = role == JackalRole.Leader
                    ? new Color(0.98f, 0.48f, 0.1f)
                    : role == JackalRole.Howler
                        ? new Color(0.7f, 0.3f, 0.92f)
                        : new Color(0.82f, 0.2f, 0.14f);
                healthBar.Initialize(combat.Health, profile.Scale.y + 1.1f, 1.05f, barColor);

                _jackals.Add(combat);
                _spawned.Add(jackal);
            }
        }

        public void ReturnWolvesToFormation()
        {
            foreach (var wolf in _wolves)
            {
                if (wolf != null && wolf.IsOperational)
                {
                    var combat = wolf.GetComponent<WolfCombatController>();
                    combat?.CancelRescue();
                    wolf.ReturnToFormation();
                }
            }
        }

        private void ApplyCrescentMode(bool returnOperationalWolves)
        {
            var points = GenerateCurrentCrescentPoints();
            var count = Mathf.Min(points.Count, _wolves.Count);
            for (var index = 0; index < count; index++)
            {
                var wolf = _wolves[index];
                if (wolf == null)
                {
                    continue;
                }

                var formationPosition = points[index] + Vector3.up * 0.75f;
                wolf.SetFormationPosition(formationPosition);
                if (returnOperationalWolves && wolf.IsOperational)
                {
                    var combat = wolf.GetComponent<WolfCombatController>();
                    combat?.CancelRescue();
                    wolf.ReturnToFormation();
                }
            }
        }

        private void ApplyStarMode(bool returnActiveAnimals)
        {
            var points = GenerateCurrentStarPoints();
            var count = Mathf.Min(points.Count, _herdAnimals.Count);
            for (var index = 0; index < count; index++)
            {
                var animal = _herdAnimals[index];
                if (animal == null)
                {
                    continue;
                }

                var formationPosition = points[index] + Vector3.up * animal.transform.position.y;
                var region = StarFormation.ClassifyRegion(points[index], starOrigin, CurrentStarRadius * 0.24f);
                animal.SetFormationPosition(formationPosition, region);
                if (returnActiveAnimals && !animal.IsLost)
                {
                    animal.CalmAndReturn();
                }
            }
        }

        private IReadOnlyList<Vector3> GenerateCurrentCrescentPoints()
        {
            var widthMultiplier = crescentMode switch
            {
                CrescentMode.Tight => 0.72f,
                CrescentMode.Wide => 1.28f,
                _ => 1f
            };
            var depthMultiplier = crescentMode switch
            {
                CrescentMode.Tight => 0.78f,
                CrescentMode.Wide => 1.18f,
                _ => 1f
            };

            return CrescentFormation.Generate(
                wolfCount,
                crescentWidth * widthMultiplier,
                crescentDepth * depthMultiplier,
                crescentOrigin,
                Vector3.forward);
        }

        private IReadOnlyList<Vector3> GenerateCurrentStarPoints()
        {
            return StarFormation.GenerateFilled(herdCount, CurrentStarRadius, 0.44f, starOrigin);
        }

        private float CurrentStarRadius => starMode switch
        {
            StarMode.Tight => starRadius * 0.76f,
            StarMode.Open => starRadius * 1.25f,
            _ => starRadius
        };

        private float CalculateCrescentIntegrity()
        {
            if (_wolves.Count == 0)
            {
                return 0f;
            }

            var total = 0f;
            foreach (var wolf in _wolves)
            {
                if (wolf == null || !wolf.IsOperational)
                {
                    continue;
                }

                var distance = Vector3.Distance(wolf.transform.position, wolf.FormationPosition);
                var score = 1f - Mathf.InverseLerp(fullIntegrityDistance, zeroIntegrityDistance, distance);
                total += Mathf.Clamp01(score);
            }

            return Mathf.Clamp01(total / _wolves.Count);
        }

        private float CalculateStarIntegrity()
        {
            if (_herdAnimals.Count == 0)
            {
                return 0f;
            }

            var total = 0f;
            foreach (var animal in _herdAnimals)
            {
                if (animal == null || animal.IsLost)
                {
                    continue;
                }

                var distance = Vector3.Distance(animal.transform.position, animal.FormationPosition);
                var score = 1f - Mathf.InverseLerp(fullStarIntegrityDistance, zeroStarIntegrityDistance, distance);
                total += Mathf.Clamp01(score);
            }

            return Mathf.Clamp01(total / _herdAnimals.Count);
        }

        private float CalculateAverageHerdPanic()
        {
            var active = 0;
            var total = 0f;
            foreach (var animal in _herdAnimals)
            {
                if (animal == null || animal.IsLost)
                {
                    continue;
                }

                active++;
                total += animal.Panic01;
            }

            return active == 0 ? 0f : Mathf.Clamp01(total / active);
        }

        private int CountActiveWolves()
        {
            var count = 0;
            foreach (var wolf in _wolfCombatants)
            {
                if (wolf != null && !wolf.IsDowned) count++;
            }
            return count;
        }

        private int CountActiveHerd()
        {
            var count = 0;
            foreach (var animal in _herdAnimals)
            {
                if (animal != null && !animal.IsLost) count++;
            }
            return count;
        }

        private int CountPanickedHerd()
        {
            var count = 0;
            foreach (var animal in _herdAnimals)
            {
                if (animal != null && animal.IsPanicked) count++;
            }
            return count;
        }

        private int CountActiveHealers()
        {
            var count = 0;
            foreach (var progression in _wolfProgressions)
            {
                if (progression == null || !progression.CanHeal)
                {
                    continue;
                }

                var combat = progression.GetComponent<WolfCombatController>();
                if (combat != null && !combat.IsDowned)
                {
                    count++;
                }
            }
            return count;
        }

        private int CountWoundedWolves()
        {
            var count = 0;
            foreach (var wolf in _wolfCombatants)
            {
                if (wolf != null && !wolf.IsDowned && wolf.Health.NormalizedHealth < 0.999f)
                {
                    count++;
                }
            }
            return count;
        }

        private int CountWoundedHerd()
        {
            var count = 0;
            foreach (var animal in _herdAnimals)
            {
                if (animal != null && !animal.IsLost && animal.Health.NormalizedHealth < 0.999f)
                {
                    count++;
                }
            }
            return count;
        }

        private int CountTreatableHerd()
        {
            var count = 0;
            foreach (var animal in _herdAnimals)
            {
                if (animal != null
                    && !animal.IsLost
                    && (animal.Health.NormalizedHealth < 0.999f || animal.Panic01 > 0.01f))
                {
                    count++;
                }
            }
            return count;
        }

        private int CountRemainingJackals()
        {
            var count = 0;
            foreach (var jackal in _jackals)
            {
                if (jackal != null && !jackal.IsDefeated) count++;
            }
            return count;
        }

        private void CompleteBattle(PrototypeBattlePhase result)
        {
            _battlePhase = result;
            _jackalPack?.StopBattle();
            SetWolfCombatEnabled(false);

            if (result == PrototypeBattlePhase.Victory && !_waveRewardsGranted)
            {
                _waveRewardsGranted = true;
                foreach (var progression in _wolfProgressions)
                {
                    if (progression == null)
                    {
                        continue;
                    }

                    var combat = progression.GetComponent<WolfCombatController>();
                    progression.GrantWaveCompletionExperience(combat != null && !combat.IsDowned);
                }
            }
        }

        private void SetWolfCombatEnabled(bool enabled)
        {
            foreach (var wolf in _wolfCombatants)
            {
                wolf?.SetCombatEnabled(enabled);
            }
        }

        private void CaptureWolfProgression()
        {
            _progressionSnapshots.Clear();
            foreach (var progression in _wolfProgressions)
            {
                if (progression == null)
                {
                    continue;
                }

                var snapshot = progression.CaptureSnapshot();
                _progressionSnapshots[snapshot.WolfIndex] = snapshot;
            }
        }

        private int GetHighestWolfLevel()
        {
            var highest = 0;
            foreach (var progression in _wolfProgressions)
            {
                if (progression != null)
                {
                    highest = Mathf.Max(highest, progression.Level);
                }
            }
            return highest;
        }

        private int GetTotalUnspentTrainingPoints()
        {
            var total = 0;
            foreach (var progression in _wolfProgressions)
            {
                if (progression != null)
                {
                    total += progression.UnspentTrainingPoints;
                }
            }
            return total;
        }

        private void EnsureJackalPack()
        {
            if (_jackalPack == null)
            {
                _jackalPack = GetComponent<JackalPackCoordinator>();
            }

            if (_jackalPack == null)
            {
                _jackalPack = gameObject.AddComponent<JackalPackCoordinator>();
            }
        }

        private static JackalRole ChooseJackalRole(int index)
        {
            if (index == 0)
            {
                return JackalRole.Leader;
            }

            if (index == 1)
            {
                return JackalRole.Howler;
            }

            return ((index - 2) % 5) switch
            {
                0 => JackalRole.Brute,
                1 => JackalRole.Runner,
                2 => JackalRole.Sneaky,
                3 => JackalRole.Raider,
                _ => JackalRole.Runner
            };
        }

        private Vector3 GetJackalSpawnPosition(int index, float t, JackalRole role)
        {
            if (role == JackalRole.Leader)
            {
                return new Vector3(crescentOrigin.x, 0.92f, crescentOrigin.z + 14.25f);
            }

            if (role == JackalRole.Howler)
            {
                return new Vector3(crescentOrigin.x - 4.2f, 0.72f, crescentOrigin.z + 13.5f);
            }

            return new Vector3(
                crescentOrigin.x + Mathf.Lerp(-13f, 13f, t),
                role == JackalRole.Brute ? 0.88f : 0.65f,
                crescentOrigin.z + 11f + Mathf.Sin(index * 1.7f) * 1.5f);
        }

        private static HerdAnimalType ChooseAnimalType(StarRegion region, int slot)
        {
            return region switch
            {
                StarRegion.Center => slot switch
                {
                    0 => HerdAnimalType.Calf,
                    1 => HerdAnimalType.Lamb,
                    _ => slot % 3 == 0 ? HerdAnimalType.Lamb : HerdAnimalType.Sheep
                },
                StarRegion.Front => slot switch
                {
                    0 => HerdAnimalType.Bull,
                    1 => HerdAnimalType.Ram,
                    _ => HerdAnimalType.Sheep
                },
                StarRegion.FrontRight or StarRegion.FrontLeft => (slot % 3) switch
                {
                    0 => HerdAnimalType.Goat,
                    1 => HerdAnimalType.Kid,
                    _ => HerdAnimalType.Sheep
                },
                _ => (slot % 3) switch
                {
                    0 => HerdAnimalType.Cow,
                    1 => HerdAnimalType.Calf,
                    _ => HerdAnimalType.Sheep
                }
            };
        }

        private static HerdVisualProfile GetAnimalProfile(HerdAnimalType type)
        {
            return type switch
            {
                HerdAnimalType.Lamb => new HerdVisualProfile(PrimitiveType.Sphere, new Vector3(0.52f, 0.42f, 0.66f), new Color(0.95f, 0.92f, 0.82f), 0.35f, 38f, 3.15f, 0f),
                HerdAnimalType.Goat => new HerdVisualProfile(PrimitiveType.Capsule, new Vector3(0.58f, 0.55f, 0.82f), new Color(0.72f, 0.69f, 0.62f), 0.55f, 62f, 3.25f, 0f),
                HerdAnimalType.Kid => new HerdVisualProfile(PrimitiveType.Capsule, new Vector3(0.42f, 0.42f, 0.62f), new Color(0.82f, 0.78f, 0.68f), 0.42f, 42f, 3.45f, 0f),
                HerdAnimalType.Cow => new HerdVisualProfile(PrimitiveType.Capsule, new Vector3(1.05f, 0.78f, 1.35f), new Color(0.42f, 0.24f, 0.13f), 0.78f, 115f, 2.25f, 0f),
                HerdAnimalType.Calf => new HerdVisualProfile(PrimitiveType.Capsule, new Vector3(0.7f, 0.58f, 0.9f), new Color(0.58f, 0.34f, 0.18f), 0.58f, 65f, 2.65f, 0f),
                HerdAnimalType.Bull => new HerdVisualProfile(PrimitiveType.Capsule, new Vector3(1.18f, 0.9f, 1.5f), new Color(0.25f, 0.13f, 0.08f), 0.9f, 185f, 2.75f, 30f),
                HerdAnimalType.Ram => new HerdVisualProfile(PrimitiveType.Capsule, new Vector3(0.88f, 0.68f, 1.08f), new Color(0.66f, 0.61f, 0.52f), 0.68f, 112f, 3.05f, 19f),
                _ => new HerdVisualProfile(PrimitiveType.Sphere, new Vector3(0.72f, 0.55f, 0.9f), new Color(0.88f, 0.86f, 0.76f), 0.45f, 58f, 2.75f, 0f)
            };
        }

        private static string GetAnimalDisplayName(HerdAnimalType type)
        {
            return type switch
            {
                HerdAnimalType.Lamb => "Kuzu",
                HerdAnimalType.Goat => "Keçi",
                HerdAnimalType.Kid => "Oğlak",
                HerdAnimalType.Cow => "İnek",
                HerdAnimalType.Calf => "Buzağı",
                HerdAnimalType.Bull => "Boğa",
                HerdAnimalType.Ram => "Koç",
                _ => "Koyun"
            };
        }

        private static Material CreateMaterial(Color color)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            return new Material(shader) { color = color };
        }

        private void RelocatePreparedJackalsToCurrentAnchor()
        {
            var translation = crescentOrigin - _jackalSpawnAnchor;
            translation.y = 0f;
            if (translation.sqrMagnitude > 0.000001f)
            {
                foreach (var jackal in _jackals)
                {
                    if (jackal != null && !jackal.IsDefeated)
                    {
                        jackal.transform.position += translation;
                    }
                }
                _jackalSpawnAnchor = crescentOrigin;
            }

            _jackalPack?.UpdateAnchors(crescentOrigin, starOrigin);
        }

        private void ClearJackalsOnly()
        {
            foreach (var jackal in _jackals)
            {
                if (jackal == null)
                {
                    continue;
                }

                var jackalObject = jackal.gameObject;
                _spawned.Remove(jackalObject);
                jackalObject.SetActive(false);
                if (Application.isPlaying)
                {
                    Destroy(jackalObject);
                }
                else
                {
                    DestroyImmediate(jackalObject);
                }
            }

            _jackals.Clear();
            _jackalPack?.StopBattle();
        }

        private void ClearPreview()
        {
            foreach (var item in _spawned)
            {
                if (item == null) continue;
                item.SetActive(false);
                if (Application.isPlaying) Destroy(item);
                else DestroyImmediate(item);
            }
            _spawned.Clear();
            _wolves.Clear();
            _wolfCombatants.Clear();
            _wolfProgressions.Clear();
            _herdAnimals.Clear();
            _jackals.Clear();
        }

        private readonly struct HerdVisualProfile
        {
            public HerdVisualProfile(
                PrimitiveType primitive,
                Vector3 scale,
                Color color,
                float height,
                float health,
                float speed,
                float defenceDamage)
            {
                Primitive = primitive;
                Scale = scale;
                Color = color;
                Height = height;
                Health = health;
                Speed = speed;
                DefenceDamage = defenceDamage;
            }

            public PrimitiveType Primitive { get; }
            public Vector3 Scale { get; }
            public Color Color { get; }
            public float Height { get; }
            public float Health { get; }
            public float Speed { get; }
            public float DefenceDamage { get; }
        }
    }
}
