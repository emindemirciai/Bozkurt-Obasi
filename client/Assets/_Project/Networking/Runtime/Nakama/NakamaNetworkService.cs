using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Bozkurt.Core.Save;
using Bozkurt.Core.Services;
using Nakama;
using UnityEngine;

namespace Bozkurt.Networking
{
    public sealed class NakamaNetworkService : INetworkService
    {
        private const string CloudCollection = "bozkurt_player";
        private const string CloudSaveKey = "main_save";

        private readonly List<FriendSummary> _friends = new();
        private IClient _client;
        private ISession _session;
        private IApiAccount _account;
        private bool _isConnecting;

        public event Action StateChanged;

        public bool IsAuthenticated => _session != null;
        public string ServerAddress => NakamaConnectionSettings.Address;
        public string StatusMessage { get; private set; } = "Çevrim dışı. Tek oyunculu oyun kullanılabilir.";
        public string UserId => _account?.User?.Id ?? _session?.UserId ?? string.Empty;
        public string Username => _account?.User?.Username ?? _session?.Username ?? string.Empty;
        public string DisplayName => _account?.User?.DisplayName ?? string.Empty;
        public IReadOnlyList<FriendSummary> Friends => _friends;

        public async Task<bool> ConnectAsync(CancellationToken cancellationToken = default)
        {
            if (IsAuthenticated)
            {
                return await RefreshAccountAsync(cancellationToken);
            }

            if (_isConnecting)
            {
                return false;
            }

            _isConnecting = true;
            SetStatus($"Sunucuya bağlanılıyor: {ServerAddress}");

            try
            {
                _client ??= new Client(
                    NakamaConnectionSettings.Scheme,
                    NakamaConnectionSettings.Host,
                    NakamaConnectionSettings.Port,
                    NakamaConnectionSettings.ServerKey,
                    UnityWebRequestAdapter.Instance)
                {
                    Timeout = 8
                };

                cancellationToken.ThrowIfCancellationRequested();
                _session = await _client.AuthenticateDeviceAsync(NakamaDeviceId.GetOrCreate());
                cancellationToken.ThrowIfCancellationRequested();
                _account = await _client.GetAccountAsync(_session);
                SetStatus($"Bağlandı: {VisibleAccountName()}");
                return true;
            }
            catch (OperationCanceledException)
            {
                SetStatus("Bağlantı iptal edildi.");
                return false;
            }
            catch (ApiResponseException exception)
            {
                SetStatus($"Nakama hatası ({exception.StatusCode}): {exception.Message}");
                return false;
            }
            catch (Exception exception)
            {
                SetStatus($"Sunucuya ulaşılamadı: {exception.Message}");
                return false;
            }
            finally
            {
                _isConnecting = false;
            }
        }

        public async Task<bool> RefreshAccountAsync(CancellationToken cancellationToken = default)
        {
            if (!await EnsureConnectedAsync(cancellationToken))
            {
                return false;
            }

            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                _account = await _client.GetAccountAsync(_session);
                SetStatus($"Profil güncellendi: {VisibleAccountName()}");
                return true;
            }
            catch (Exception exception)
            {
                SetStatus($"Profil alınamadı: {exception.Message}");
                return false;
            }
        }

        public async Task<bool> UpdateProfileAsync(string username, string displayName, CancellationToken cancellationToken = default)
        {
            if (!await EnsureConnectedAsync(cancellationToken))
            {
                return false;
            }

            username = username?.Trim() ?? string.Empty;
            displayName = displayName?.Trim() ?? string.Empty;
            if (username.Length < 3)
            {
                SetStatus("Kullanıcı adı en az 3 karakter olmalı.");
                return false;
            }

            try
            {
                await _client.UpdateAccountAsync(_session, username, displayName, null, "tr", null, null);
                _account = await _client.GetAccountAsync(_session);

                if (GameServices.Registry.TryResolve<ISaveService>(out var saveService) && saveService.Current != null)
                {
                    saveService.Current.playerName = string.IsNullOrWhiteSpace(displayName) ? username : displayName;
                    await saveService.SaveAsync(saveService.Current, cancellationToken);
                }

                SetStatus($"Profil kaydedildi: {VisibleAccountName()}");
                return true;
            }
            catch (ApiResponseException exception)
            {
                SetStatus($"Profil kaydedilemedi ({exception.StatusCode}): {exception.Message}");
                return false;
            }
            catch (Exception exception)
            {
                SetStatus($"Profil kaydedilemedi: {exception.Message}");
                return false;
            }
        }

        public async Task<bool> RefreshFriendsAsync(CancellationToken cancellationToken = default)
        {
            if (!await EnsureConnectedAsync(cancellationToken))
            {
                return false;
            }

            try
            {
                var result = await _client.ListFriendsAsync(_session, state: null, limit: 100, cursor: null);
                _friends.Clear();
                foreach (var friend in result.Friends)
                {
                    _friends.Add(new FriendSummary
                    {
                        UserId = friend.User.Id,
                        Username = friend.User.Username,
                        DisplayName = friend.User.DisplayName,
                        State = Convert.ToInt32(friend.State)
                    });
                }

                SetStatus($"Arkadaş listesi yenilendi: {_friends.Count} kayıt.");
                return true;
            }
            catch (Exception exception)
            {
                SetStatus($"Arkadaş listesi alınamadı: {exception.Message}");
                return false;
            }
        }

        public async Task<bool> AddFriendByUsernameAsync(string username, CancellationToken cancellationToken = default)
        {
            if (!await EnsureConnectedAsync(cancellationToken))
            {
                return false;
            }

            username = username?.Trim() ?? string.Empty;
            if (username.Length < 3)
            {
                SetStatus("Arkadaş kullanıcı adı en az 3 karakter olmalı.");
                return false;
            }

            if (string.Equals(username, Username, StringComparison.OrdinalIgnoreCase))
            {
                SetStatus("Kendi hesabını arkadaş olarak ekleyemezsin.");
                return false;
            }

            try
            {
                await _client.AddFriendsAsync(_session, Array.Empty<string>(), new[] { username });
                SetStatus($"Arkadaşlık isteği gönderildi: {username}");
                await RefreshFriendsAsync(cancellationToken);
                return true;
            }
            catch (ApiResponseException exception)
            {
                SetStatus($"Arkadaş eklenemedi ({exception.StatusCode}): {exception.Message}");
                return false;
            }
            catch (Exception exception)
            {
                SetStatus($"Arkadaş eklenemedi: {exception.Message}");
                return false;
            }
        }

        public async Task<bool> UploadCloudSaveAsync(CancellationToken cancellationToken = default)
        {
            if (!await EnsureConnectedAsync(cancellationToken))
            {
                return false;
            }

            if (!GameServices.Registry.TryResolve<ISaveService>(out var saveService) || saveService.Current == null)
            {
                SetStatus("Yerel kayıt bulunamadı.");
                return false;
            }

            try
            {
                await saveService.SaveAsync(saveService.Current, cancellationToken);
                var envelope = new CloudSaveEnvelope
                {
                    uploadedAtUnix = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                    save = saveService.Current
                };
                var write = new WriteStorageObject
                {
                    Collection = CloudCollection,
                    Key = CloudSaveKey,
                    Value = JsonUtility.ToJson(envelope),
                    PermissionRead = 1,
                    PermissionWrite = 1
                };
                await _client.WriteStorageObjectsAsync(_session, new[] { write });
                SetStatus($"Bulut kaydı yüklendi. Revizyon: {saveService.Current.saveRevision}");
                return true;
            }
            catch (Exception exception)
            {
                SetStatus($"Bulut kaydı yüklenemedi: {exception.Message}");
                return false;
            }
        }

        public async Task<bool> DownloadCloudSaveAsync(CancellationToken cancellationToken = default)
        {
            if (!await EnsureConnectedAsync(cancellationToken))
            {
                return false;
            }

            if (!GameServices.Registry.TryResolve<ISaveService>(out var saveService))
            {
                SetStatus("Yerel kayıt servisi bulunamadı.");
                return false;
            }

            try
            {
                var read = new StorageObjectId
                {
                    Collection = CloudCollection,
                    Key = CloudSaveKey,
                    UserId = _session.UserId
                };
                var result = await _client.ReadStorageObjectsAsync(_session, new[] { read });
                CloudSaveEnvelope envelope = null;
                foreach (var item in result.Objects)
                {
                    envelope = JsonUtility.FromJson<CloudSaveEnvelope>(item.Value);
                    break;
                }

                if (envelope?.save == null)
                {
                    SetStatus("Bu hesapta bulut kaydı yok.");
                    return false;
                }

                if (!CloudSaveMergePolicy.ShouldUseRemote(saveService.Current, envelope.save))
                {
                    SetStatus("Yerel kayıt buluttaki kayıt kadar yeni veya daha yeni. Değişiklik yapılmadı.");
                    return false;
                }

                await saveService.SaveAsync(envelope.save, cancellationToken);
                SetStatus($"Bulut kaydı indirildi. Revizyon: {saveService.Current.saveRevision}");
                return true;
            }
            catch (Exception exception)
            {
                SetStatus($"Bulut kaydı indirilemedi: {exception.Message}");
                return false;
            }
        }

        private async Task<bool> EnsureConnectedAsync(CancellationToken cancellationToken)
        {
            return IsAuthenticated || await ConnectAsync(cancellationToken);
        }

        private string VisibleAccountName()
        {
            return string.IsNullOrWhiteSpace(DisplayName) ? Username : DisplayName;
        }

        private void SetStatus(string message)
        {
            StatusMessage = message;
            Debug.Log($"[Nakama] {message}");
            StateChanged?.Invoke();
        }
    }
}
