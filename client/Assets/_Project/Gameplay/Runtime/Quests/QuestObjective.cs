using System;

namespace Bozkurt.Gameplay.Quests
{
    [Serializable]
    public sealed class QuestObjective
    {
        public QuestObjective(QuestActionType action, string description, int requiredAmount = 1, string target = "")
        {
            Action = action;
            Description = description ?? string.Empty;
            RequiredAmount = Math.Max(1, requiredAmount);
            Target = target ?? string.Empty;
        }

        public QuestActionType Action { get; }
        public string Description { get; }
        public int RequiredAmount { get; }
        public string Target { get; }

        public bool Matches(QuestActionType action, string context)
        {
            if (Action != action)
            {
                return false;
            }

            if (string.IsNullOrWhiteSpace(Target))
            {
                return true;
            }

            return !string.IsNullOrWhiteSpace(context)
                && context.IndexOf(Target, StringComparison.OrdinalIgnoreCase) >= 0;
        }
    }
}
