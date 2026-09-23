using System;
using System.Collections.Generic;

namespace Bozkurt.Core.Save
{
    [Serializable]
    public sealed class SaveData
    {
        public int version = GameConstants.CurrentSaveVersion;
        public int saveRevision;
        public string playerId = Guid.NewGuid().ToString("N");
        public string playerName = "Misafir";
        public string lastPlatform = string.Empty;
        public long createdAtUnix;
        public long updatedAtUnix;
        public int completedPrototypeRuns;
        public List<string> unlockedContentIds = new();
        public string prototypeSessionJson = string.Empty;

        public static SaveData CreateNew()
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            return new SaveData
            {
                createdAtUnix = now,
                updatedAtUnix = now
            };
        }
    }
}
