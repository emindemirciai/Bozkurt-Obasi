using System.Collections.Generic;

namespace Bozkurt.Gameplay.Quests
{
    public sealed class QuestDefinition
    {
        public QuestDefinition(
            string id,
            QuestType type,
            string title,
            string narrative,
            IReadOnlyList<QuestObjective> objectives,
            int rewardWater = 0,
            int rewardFeed = 0,
            int rewardHerbs = 0,
            int rewardWood = 0,
            int rewardStone = 0,
            int rewardExperience = 0)
        {
            Id = id;
            Type = type;
            Title = title;
            Narrative = narrative;
            Objectives = objectives;
            RewardWater = rewardWater;
            RewardFeed = rewardFeed;
            RewardHerbs = rewardHerbs;
            RewardWood = rewardWood;
            RewardStone = rewardStone;
            RewardExperience = rewardExperience;
        }

        public string Id { get; }
        public QuestType Type { get; }
        public string Title { get; }
        public string Narrative { get; }
        public IReadOnlyList<QuestObjective> Objectives { get; }
        public int RewardWater { get; }
        public int RewardFeed { get; }
        public int RewardHerbs { get; }
        public int RewardWood { get; }
        public int RewardStone { get; }
        public int RewardExperience { get; }
    }
}
