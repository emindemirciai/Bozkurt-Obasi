using System;
using Bozkurt.Core.Save;

namespace Bozkurt.Networking
{
    [Serializable]
    public sealed class CloudSaveEnvelope
    {
        public int schemaVersion = 1;
        public long uploadedAtUnix;
        public SaveData save;
    }
}
