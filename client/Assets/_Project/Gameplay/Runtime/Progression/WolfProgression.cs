using System;
using Bozkurt.Gameplay.Combat;
using UnityEngine;

namespace Bozkurt.Gameplay.Progression
{
    [DisallowMultipleComponent]
    public sealed class WolfProgression : MonoBehaviour
    {
        [SerializeField, Min(1)] private int level = 1;
        [SerializeField, Min(0)] private int currentExperience;
        [SerializeField, Min(0)] private int unspentTrainingPoints;
        [SerializeField, Min(0)] private int guardianRanks;
        [SerializeField, Min(0)] private int hunterRanks;
        [SerializeField, Min(0)] private int leaderRanks;
        [SerializeField, Min(0)] private int healerRanks;

        private float _damageContribution;
        private float _healingContribution;
        private int _defeatedJackals;
        private int _rescuedWolves;
        private int _healingApplications;
        private int _herdHealingApplications;

        public event Action<WolfProgression> Changed;
        public event Action<WolfProgression> LevelledUp;

        public int WolfIndex { get; private set; }
        public int Level => level;
        public int CurrentExperience => currentExperience;
        public int ExperienceRequiredForNextLevel => CalculateExperienceRequirement(level);
        public float ExperienceProgress01 => ExperienceRequiredForNextLevel <= 0
            ? 1f
            : Mathf.Clamp01(currentExperience / (float)ExperienceRequiredForNextLevel);
        public int UnspentTrainingPoints => unspentTrainingPoints;
        public int GuardianRanks => guardianRanks;
        public int HunterRanks => hunterRanks;
        public int LeaderRanks => leaderRanks;
        public int HealerRanks => healerRanks;
        public bool CanHeal => healerRanks > 0;
        public float DamageContribution => _damageContribution;
        public float HealingContribution => _healingContribution;
        public int DefeatedJackals => _defeatedJackals;
        public int RescuedWolves => _rescuedWolves;
        public int HealingApplications => _healingApplications;
        public int HerdHealingApplications => _herdHealingApplications;

        public float MaximumHealthMultiplier => 1f + guardianRanks * 0.12f;
        public float AttackDamageMultiplier => 1f + hunterRanks * 0.1f;
        public float AttackCooldownMultiplier => Mathf.Max(0.7f, 1f - hunterRanks * 0.035f);
        public float DetectionRangeBonus => leaderRanks * 0.85f;
        public float RescueDurationMultiplier => Mathf.Max(0.65f, 1f - leaderRanks * 0.08f);

        public float HealingAmount => CanHeal ? 8f + healerRanks * 5f : 0f;
        public float HealingRange => CanHeal ? 1.8f + healerRanks * 0.22f : 0f;
        public float HealingDetectionRange => CanHeal ? 6.5f + healerRanks * 0.75f : 0f;
        public float HealingCooldown => CanHeal ? Mathf.Max(0.58f, 1.75f - healerRanks * 0.12f) : float.PositiveInfinity;
        public float HerdHealingMultiplier => CanHeal ? 0.78f + healerRanks * 0.04f : 0f;

        public void Initialize(int wolfIndex, WolfProgressionSnapshot snapshot = null, bool starterHealer = false)
        {
            WolfIndex = Mathf.Max(0, wolfIndex);
            if (snapshot == null)
            {
                level = 1;
                currentExperience = 0;
                unspentTrainingPoints = 0;
                guardianRanks = 0;
                hunterRanks = 0;
                leaderRanks = 0;
                healerRanks = starterHealer ? 1 : 0;
                _damageContribution = 0f;
                _healingContribution = 0f;
                _defeatedJackals = 0;
                _rescuedWolves = 0;
                _healingApplications = 0;
                _herdHealingApplications = 0;
            }
            else
            {
                level = Mathf.Max(1, snapshot.Level);
                currentExperience = Mathf.Max(0, snapshot.CurrentExperience);
                unspentTrainingPoints = Mathf.Max(0, snapshot.UnspentTrainingPoints);
                guardianRanks = Mathf.Max(0, snapshot.GuardianRanks);
                hunterRanks = Mathf.Max(0, snapshot.HunterRanks);
                leaderRanks = Mathf.Max(0, snapshot.LeaderRanks);
                healerRanks = Mathf.Max(0, snapshot.HealerRanks);
                _damageContribution = Mathf.Max(0f, snapshot.DamageContribution);
                _healingContribution = Mathf.Max(0f, snapshot.HealingContribution);
                _defeatedJackals = Mathf.Max(0, snapshot.DefeatedJackals);
                _rescuedWolves = Mathf.Max(0, snapshot.RescuedWolves);
                _healingApplications = Mathf.Max(0, snapshot.HealingApplications);
                _herdHealingApplications = Mathf.Max(0, snapshot.HerdHealingApplications);
            }

            NormalizeExperience();
            Changed?.Invoke(this);
        }

        public void RecordDamage(float actualDamage)
        {
            if (actualDamage <= 0f)
            {
                return;
            }

            _damageContribution += actualDamage;
            AddExperience(Mathf.Max(1, Mathf.RoundToInt(actualDamage * 0.18f)));
        }

        public void RecordDefeat(JackalRole role)
        {
            _defeatedJackals++;
            var experience = role switch
            {
                JackalRole.Leader => 42,
                JackalRole.Brute => 18,
                JackalRole.Howler => 20,
                _ => 12
            };
            AddExperience(experience);
        }

        public void RecordRescue()
        {
            _rescuedWolves++;
            AddExperience(24);
        }

        public void RecordHealing(float actualHealing, bool healedHerd)
        {
            if (actualHealing <= 0f)
            {
                return;
            }

            _healingContribution += actualHealing;
            _healingApplications++;
            if (healedHerd)
            {
                _herdHealingApplications++;
            }

            AddExperience(Mathf.Max(1, Mathf.RoundToInt(actualHealing * 0.16f)));
        }

        public void GrantWaveCompletionExperience(bool wasOperational)
        {
            AddExperience(wasOperational ? 32 : 22);
        }

        public void AddExperience(int amount)
        {
            if (amount <= 0)
            {
                return;
            }

            currentExperience += amount;
            var levelUpOccurred = false;
            while (currentExperience >= ExperienceRequiredForNextLevel)
            {
                currentExperience -= ExperienceRequiredForNextLevel;
                level++;
                unspentTrainingPoints++;
                levelUpOccurred = true;
            }

            Changed?.Invoke(this);
            if (levelUpOccurred)
            {
                LevelledUp?.Invoke(this);
            }
        }

        public bool SpendTrainingPoint(WolfTrainingPath path)
        {
            if (unspentTrainingPoints <= 0)
            {
                return false;
            }

            unspentTrainingPoints--;
            switch (path)
            {
                case WolfTrainingPath.Guardian:
                    guardianRanks++;
                    break;
                case WolfTrainingPath.Hunter:
                    hunterRanks++;
                    break;
                case WolfTrainingPath.Leader:
                    leaderRanks++;
                    break;
                case WolfTrainingPath.Healer:
                    healerRanks++;
                    break;
                default:
                    unspentTrainingPoints++;
                    return false;
            }

            Changed?.Invoke(this);
            return true;
        }

        public WolfProgressionSnapshot CaptureSnapshot()
        {
            return new WolfProgressionSnapshot
            {
                WolfIndex = WolfIndex,
                Level = level,
                CurrentExperience = currentExperience,
                UnspentTrainingPoints = unspentTrainingPoints,
                GuardianRanks = guardianRanks,
                HunterRanks = hunterRanks,
                LeaderRanks = leaderRanks,
                HealerRanks = healerRanks,
                DamageContribution = _damageContribution,
                HealingContribution = _healingContribution,
                DefeatedJackals = _defeatedJackals,
                RescuedWolves = _rescuedWolves,
                HealingApplications = _healingApplications,
                HerdHealingApplications = _herdHealingApplications
            };
        }

        public static int CalculateExperienceRequirement(int currentLevel)
        {
            return 60 + Mathf.Max(0, currentLevel - 1) * 45;
        }

        private void NormalizeExperience()
        {
            while (currentExperience >= ExperienceRequiredForNextLevel)
            {
                currentExperience -= ExperienceRequiredForNextLevel;
                level++;
                unspentTrainingPoints++;
            }
        }
    }
}
