using Bozkurt.Core.Save;
using Bozkurt.Networking;
using NUnit.Framework;

namespace Bozkurt.Tests
{
    public sealed class CloudSaveMergePolicyTests
    {
        [Test]
        public void NewerRemoteRevision_IsSelected()
        {
            var local = SaveData.CreateNew();
            local.saveRevision = 4;
            var remote = SaveData.CreateNew();
            remote.saveRevision = 5;

            Assert.That(CloudSaveMergePolicy.ShouldUseRemote(local, remote), Is.True);
        }

        [Test]
        public void OlderRemoteRevision_IsRejected()
        {
            var local = SaveData.CreateNew();
            local.saveRevision = 8;
            var remote = SaveData.CreateNew();
            remote.saveRevision = 7;

            Assert.That(CloudSaveMergePolicy.ShouldUseRemote(local, remote), Is.False);
        }
    }
}
