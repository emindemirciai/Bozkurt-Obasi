namespace Bozkurt.Gameplay.Combat
{
    public enum JackalRole
    {
        Raider = 0,
        Runner = 1,
        Brute = 2,
        Sneaky = 3,
        Howler = 4,
        Leader = 5
    }

    public enum JackalPackTactic
    {
        DirectAssault = 0,
        LeftFlank = 1,
        RightFlank = 2,
        SplitFlank = 3,
        HerdRush = 4
    }

    public static class JackalRoleNames
    {
        public static string GetDisplayName(JackalRole role)
        {
            return role switch
            {
                JackalRole.Runner => "Koşucu",
                JackalRole.Brute => "Ağır",
                JackalRole.Sneaky => "Sinsi",
                JackalRole.Howler => "Uluyan",
                JackalRole.Leader => "Lider",
                _ => "Yağmacı"
            };
        }

        public static string GetTacticDisplayName(JackalPackTactic tactic)
        {
            return tactic switch
            {
                JackalPackTactic.LeftFlank => "Sol kanat baskısı",
                JackalPackTactic.RightFlank => "Sağ kanat baskısı",
                JackalPackTactic.SplitFlank => "Çift kanat kuşatması",
                JackalPackTactic.HerdRush => "Sürüye toplu hücum",
                _ => "Doğrudan saldırı"
            };
        }
    }
}
