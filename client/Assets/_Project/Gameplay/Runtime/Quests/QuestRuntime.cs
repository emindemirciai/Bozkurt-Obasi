using System;
using System.Text;

namespace Bozkurt.Gameplay.Quests
{
    public sealed class QuestRuntime
    {
        public QuestRuntime(QuestDefinition definition)
        {
            Definition = definition ?? throw new ArgumentNullException(nameof(definition));
        }

        public QuestDefinition Definition { get; }
        public int CurrentObjectiveIndex { get; private set; }
        public int CurrentProgress { get; private set; }
        public bool IsCompleted { get; private set; }
        public QuestObjective CurrentObjective => IsCompleted || Definition.Objectives.Count == 0
            ? null
            : Definition.Objectives[CurrentObjectiveIndex];

        public bool Apply(QuestActionType action, int amount, string context, out bool objectiveCompleted)
        {
            objectiveCompleted = false;
            if (IsCompleted || CurrentObjective == null || amount <= 0 || !CurrentObjective.Matches(action, context))
            {
                return false;
            }

            CurrentProgress += amount;
            if (CurrentProgress < CurrentObjective.RequiredAmount)
            {
                return true;
            }

            objectiveCompleted = true;
            CurrentObjectiveIndex++;
            CurrentProgress = 0;
            if (CurrentObjectiveIndex >= Definition.Objectives.Count)
            {
                IsCompleted = true;
            }

            return true;
        }

        public void RestoreState(int objectiveIndex, int progress, bool completed)
        {
            IsCompleted = completed;
            CurrentObjectiveIndex = completed
                ? Definition.Objectives.Count
                : System.Math.Max(0, System.Math.Min(objectiveIndex, System.Math.Max(0, Definition.Objectives.Count - 1)));
            CurrentProgress = completed || Definition.Objectives.Count == 0
                ? 0
                : System.Math.Max(0, System.Math.Min(progress, Definition.Objectives[CurrentObjectiveIndex].RequiredAmount - 1));
        }

        public string BuildProgressText(bool includeCompletedObjectives)
        {
            var builder = new StringBuilder();
            for (var index = 0; index < Definition.Objectives.Count; index++)
            {
                var objective = Definition.Objectives[index];
                var completed = IsCompleted || index < CurrentObjectiveIndex;
                if (!includeCompletedObjectives && completed)
                {
                    continue;
                }

                if (completed)
                {
                    builder.Append("✓ ").Append(objective.Description);
                }
                else if (index == CurrentObjectiveIndex)
                {
                    builder.Append("› ").Append(objective.Description)
                        .Append("  ").Append(CurrentProgress).Append('/').Append(objective.RequiredAmount);
                }
                else
                {
                    builder.Append("○ ").Append(objective.Description);
                }

                if (index < Definition.Objectives.Count - 1)
                {
                    builder.AppendLine();
                }
            }

            return builder.ToString().TrimEnd();
        }
    }
}
