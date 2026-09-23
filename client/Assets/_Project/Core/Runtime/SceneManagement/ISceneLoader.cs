using System.Threading;
using System.Threading.Tasks;

namespace Bozkurt.Core.SceneManagement
{
    public interface ISceneLoader
    {
        Task LoadSingleAsync(string sceneName, CancellationToken cancellationToken = default);
    }
}
