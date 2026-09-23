using Bozkurt.Core.Save;

namespace Bozkurt.Networking
{
    public static class CloudSaveMergePolicy
    {
        public static bool ShouldUseRemote(SaveData local, SaveData remote)
        {
            if (remote == null)
            {
                return false;
            }

            if (local == null)
            {
                return true;
            }

            if (remote.saveRevision != local.saveRevision)
            {
                return remote.saveRevision > local.saveRevision;
            }

            return remote.updatedAtUnix > local.updatedAtUnix;
        }
    }
}
