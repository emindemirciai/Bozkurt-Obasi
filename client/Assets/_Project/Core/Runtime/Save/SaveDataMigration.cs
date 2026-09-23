namespace Bozkurt.Core.Save
{
    public static class SaveDataMigration
    {
        public static bool UpgradeToCurrent(SaveData data)
        {
            if (data == null)
            {
                return false;
            }

            var changed = false;
            if (data.version < 2)
            {
                data.prototypeSessionJson ??= string.Empty;
                data.lastPlatform ??= string.Empty;
                data.saveRevision = 0;
                data.version = 2;
                changed = true;
            }

            if (data.version != GameConstants.CurrentSaveVersion)
            {
                data.version = GameConstants.CurrentSaveVersion;
                changed = true;
            }

            data.unlockedContentIds ??= new System.Collections.Generic.List<string>();
            data.playerName ??= "Misafir";
            data.prototypeSessionJson ??= string.Empty;
            data.lastPlatform ??= string.Empty;
            return changed;
        }
    }
}
