using System.Text;
using Bozkurt.Core.Services;
using Bozkurt.Networking;
using UnityEngine;
using UnityEngine.UI;

namespace Bozkurt.UI
{
    public sealed class OnlineMenuController : MonoBehaviour
    {
        [SerializeField] private GameObject onlinePanel;
        [SerializeField] private Text statusText;
        [SerializeField] private Text serverText;
        [SerializeField] private InputField usernameInput;
        [SerializeField] private InputField displayNameInput;
        [SerializeField] private InputField friendInput;
        [SerializeField] private Text friendsText;
        [SerializeField] private Text messageText;

        private INetworkService _network;
        private bool _busy;

        public void ConfigureUi(
            GameObject panel,
            Text status,
            Text server,
            InputField username,
            InputField displayName,
            InputField friend,
            Text friends,
            Text message)
        {
            onlinePanel = panel;
            statusText = status;
            serverText = server;
            usernameInput = username;
            displayNameInput = displayName;
            friendInput = friend;
            friendsText = friends;
            messageText = message;
            SetPanelVisible(false);
            RefreshUi();
        }

        private void OnDestroy()
        {
            if (_network != null)
            {
                _network.StateChanged -= RefreshUi;
            }
        }

        public async void ToggleOnlinePanel()
        {
            if (onlinePanel == null)
            {
                return;
            }

            var shouldOpen = !onlinePanel.activeSelf;
            SetPanelVisible(shouldOpen);
            if (!shouldOpen)
            {
                return;
            }

            ResolveNetwork();
            RefreshUi();
            if (_network != null && !_network.IsAuthenticated)
            {
                await RunOperationAsync(() => _network.ConnectAsync(), "Misafir hesapla bağlantı kuruluyor...");
            }
        }

        public void ClosePanel() => SetPanelVisible(false);

        public async void Connect()
        {
            ResolveNetwork();
            if (_network != null)
            {
                await RunOperationAsync(() => _network.ConnectAsync(), "Sunucuya bağlanılıyor...");
            }
        }

        public async void SaveProfile()
        {
            ResolveNetwork();
            if (_network != null)
            {
                await RunOperationAsync(
                    () => _network.UpdateProfileAsync(usernameInput?.text, displayNameInput?.text),
                    "Profil kaydediliyor...");
            }
        }

        public async void RefreshFriends()
        {
            ResolveNetwork();
            if (_network != null)
            {
                await RunOperationAsync(() => _network.RefreshFriendsAsync(), "Arkadaş listesi yenileniyor...");
            }
        }

        public async void AddFriend()
        {
            ResolveNetwork();
            if (_network != null)
            {
                await RunOperationAsync(
                    () => _network.AddFriendByUsernameAsync(friendInput?.text),
                    "Arkadaşlık isteği gönderiliyor...");
            }
        }

        public async void UploadCloudSave()
        {
            ResolveNetwork();
            if (_network != null)
            {
                await RunOperationAsync(() => _network.UploadCloudSaveAsync(), "Kayıt buluta yükleniyor...");
            }
        }

        public async void DownloadCloudSave()
        {
            ResolveNetwork();
            if (_network != null)
            {
                await RunOperationAsync(() => _network.DownloadCloudSaveAsync(), "Bulut kaydı kontrol ediliyor...");
            }
        }

        private async System.Threading.Tasks.Task RunOperationAsync(
            System.Func<System.Threading.Tasks.Task<bool>> operationFactory,
            string busyMessage)
        {
            if (_busy)
            {
                return;
            }

            _busy = true;
            SetMessage(busyMessage);
            try
            {
                await operationFactory();
            }
            finally
            {
                _busy = false;
                RefreshUi();
            }
        }

        private void ResolveNetwork()
        {
            if (_network != null)
            {
                return;
            }

            if (GameServices.Registry.TryResolve<INetworkService>(out var service))
            {
                _network = service;
                _network.StateChanged += RefreshUi;
            }
        }

        private void RefreshUi()
        {
            ResolveNetwork();
            if (_network == null)
            {
                SetText(statusText, "Çevrim içi servis yüklenemedi.");
                return;
            }

            SetText(serverText, $"Sunucu: {_network.ServerAddress}");
            SetText(statusText, _network.IsAuthenticated
                ? $"Bağlı | Kullanıcı: {_network.Username} | Kimlik: {ShortId(_network.UserId)}"
                : "Çevrim dışı | Tek oyunculu oyun çalışmaya devam eder.");
            SetMessage(_network.StatusMessage);

            if (_network.IsAuthenticated)
            {
                if (usernameInput != null && !usernameInput.isFocused)
                {
                    usernameInput.text = _network.Username;
                }

                if (displayNameInput != null && !displayNameInput.isFocused)
                {
                    displayNameInput.text = _network.DisplayName;
                }
            }

            var builder = new StringBuilder();
            if (_network.Friends.Count == 0)
            {
                builder.Append("Arkadaş listesi boş. Kullanıcı adıyla istek gönderebilirsin.");
            }
            else
            {
                foreach (var friend in _network.Friends)
                {
                    builder.Append("• ")
                        .Append(friend.VisibleName)
                        .Append(" (@")
                        .Append(friend.Username)
                        .Append(") — ")
                        .Append(friend.RelationshipLabel)
                        .AppendLine();
                }
            }

            SetText(friendsText, builder.ToString());
        }

        private void SetPanelVisible(bool visible)
        {
            if (onlinePanel != null)
            {
                onlinePanel.SetActive(visible);
            }
        }

        private void SetMessage(string value) => SetText(messageText, value);

        private static void SetText(Text text, string value)
        {
            if (text != null)
            {
                text.text = value ?? string.Empty;
            }
        }

        private static string ShortId(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return "-";
            }

            return value.Length <= 8 ? value : value.Substring(0, 8);
        }
    }
}
