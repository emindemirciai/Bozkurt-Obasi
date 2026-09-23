using Bozkurt.Core.Services;
using UnityEngine;

namespace Bozkurt.Networking
{
    [DefaultExecutionOrder(-9000)]
    public sealed class NakamaServiceInstaller : MonoBehaviour
    {
        private void Awake()
        {
            if (!GameServices.Registry.TryResolve<INetworkService>(out _))
            {
                GameServices.Registry.Register<INetworkService>(new NakamaNetworkService());
            }
        }
    }
}
