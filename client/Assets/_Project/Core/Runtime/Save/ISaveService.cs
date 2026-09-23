using System.Threading;
using System.Threading.Tasks;

namespace Bozkurt.Core.Save
{
    public interface ISaveService
    {
        SaveData Current { get; }
        Task<SaveData> LoadOrCreateAsync(CancellationToken cancellationToken = default);
        Task SaveAsync(SaveData saveData, CancellationToken cancellationToken = default);
    }
}
