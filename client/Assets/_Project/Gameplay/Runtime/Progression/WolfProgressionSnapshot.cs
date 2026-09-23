using System;

namespace Bozkurt.Gameplay.Progression
{
    [Serializable]
    public sealed class WolfProgressionSnapshot
    {
        public int WolfIndex;
        public int Level = 1;
        public int CurrentExperience;
        public int UnspentTrainingPoints;
        public int GuardianRanks;
        public int HunterRanks;
        public int LeaderRanks;
        public int HealerRanks;
        public float DamageContribution;
        public float HealingContribution;
        public int DefeatedJackals;
        public int RescuedWolves;
        public int HealingApplications;
        public int HerdHealingApplications;
    }
}
