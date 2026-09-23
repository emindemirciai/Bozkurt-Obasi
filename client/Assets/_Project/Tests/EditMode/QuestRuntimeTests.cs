using Bozkurt.Gameplay.Quests;
using NUnit.Framework;

namespace Bozkurt.Tests.EditMode
{
    public sealed class QuestRuntimeTests
    {
        [Test]
        public void Objectives_AdvanceSequentially()
        {
            var definition = new QuestDefinition(
                "test",
                QuestType.Main,
                "Test",
                "",
                new[]
                {
                    new QuestObjective(QuestActionType.CollectResources, "Kaynak"),
                    new QuestObjective(QuestActionType.WinBattle, "Savaş", 2)
                });
            var runtime = new QuestRuntime(definition);

            Assert.That(runtime.Apply(QuestActionType.WinBattle, 1, "", out _), Is.False);
            Assert.That(runtime.Apply(QuestActionType.CollectResources, 1, "", out var firstDone), Is.True);
            Assert.That(firstDone, Is.True);
            Assert.That(runtime.Apply(QuestActionType.WinBattle, 1, "", out var secondDone), Is.True);
            Assert.That(secondDone, Is.False);
            Assert.That(runtime.Apply(QuestActionType.WinBattle, 1, "", out secondDone), Is.True);
            Assert.That(secondDone, Is.True);
            Assert.That(runtime.IsCompleted, Is.True);
        }

        [Test]
        public void TargetedObjective_RequiresMatchingContext()
        {
            var definition = new QuestDefinition(
                "target",
                QuestType.Main,
                "Target",
                "",
                new[] { new QuestObjective(QuestActionType.ReachLocation, "Ulaş", 1, "Su Gözü") });
            var runtime = new QuestRuntime(definition);

            Assert.That(runtime.Apply(QuestActionType.ReachLocation, 1, "Yüksek Otlak", out _), Is.False);
            Assert.That(runtime.Apply(QuestActionType.ReachLocation, 1, "Su Gözü", out _), Is.True);
            Assert.That(runtime.IsCompleted, Is.True);
        }
    }
}
