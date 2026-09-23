using System;

namespace Bozkurt.Networking
{
    [Serializable]
    public sealed class FriendSummary
    {
        public string UserId = string.Empty;
        public string Username = string.Empty;
        public string DisplayName = string.Empty;
        public int State;

        public string RelationshipLabel => State switch
        {
            0 => "Arkadaş",
            1 => "Davet gönderildi",
            2 => "Davet bekliyor",
            3 => "Engellendi",
            _ => "Bilinmiyor"
        };

        public string VisibleName => string.IsNullOrWhiteSpace(DisplayName) ? Username : DisplayName;
    }
}
