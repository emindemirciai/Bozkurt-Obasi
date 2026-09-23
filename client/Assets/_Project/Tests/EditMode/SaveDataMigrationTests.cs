using Bozkurt.Core;
using Bozkurt.Core.Save;
using NUnit.Framework;

namespace Bozkurt.Tests.EditMode
{
    public sealed class SaveDataMigrationTests
    {
        [Test]
        public void UpgradeToCurrent_ConvertsVersionOneData()
        {
            var data = SaveData.CreateNew();
            data.version = 1;
            data.prototypeSessionJson = null;

            var changed = SaveDataMigration.UpgradeToCurrent(data);

            Assert.That(changed, Is.True);
            Assert.That(data.version, Is.EqualTo(GameConstants.CurrentSaveVersion));
            Assert.That(data.prototypeSessionJson, Is.Not.Null);
        }
    }
}
