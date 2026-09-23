using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Bozkurt.Networking
{
    public interface INetworkService
    {
        event Action StateChanged;

        bool IsAuthenticated { get; }
        string ServerAddress { get; }
        string StatusMessage { get; }
        string UserId { get; }
        string Username { get; }
        string DisplayName { get; }
        IReadOnlyList<FriendSummary> Friends { get; }

        Task<bool> ConnectAsync(CancellationToken cancellationToken = default);
        Task<bool> RefreshAccountAsync(CancellationToken cancellationToken = default);
        Task<bool> UpdateProfileAsync(string username, string displayName, CancellationToken cancellationToken = default);
        Task<bool> RefreshFriendsAsync(CancellationToken cancellationToken = default);
        Task<bool> AddFriendByUsernameAsync(string username, CancellationToken cancellationToken = default);
        Task<bool> UploadCloudSaveAsync(CancellationToken cancellationToken = default);
        Task<bool> DownloadCloudSaveAsync(CancellationToken cancellationToken = default);
    }
}
