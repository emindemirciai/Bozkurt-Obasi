using System.Threading;
using System.Threading.Tasks;

namespace Bozkurt.Core.Services
{
    public interface IGameService
    {
        bool IsInitialized { get; }
        Task InitializeAsync(CancellationToken cancellationToken);
        Task ShutdownAsync(CancellationToken cancellationToken);
    }
}
