namespace Bozkurt.Gameplay.Progression
{
    public enum WolfTrainingPath
    {
        Guardian = 0,
        Hunter = 1,
        Leader = 2,
        Healer = 3
    }

    public static class WolfTrainingPathNames
    {
        public static string GetDisplayName(WolfTrainingPath path)
        {
            return path switch
            {
                WolfTrainingPath.Guardian => "Muhafız",
                WolfTrainingPath.Hunter => "Avcı",
                WolfTrainingPath.Leader => "Lider",
                WolfTrainingPath.Healer => "Şifacı",
                _ => "Bilinmeyen"
            };
        }
    }
}
