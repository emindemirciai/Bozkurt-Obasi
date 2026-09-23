using System;
using System.Threading;
using System.Threading.Tasks;
using Bozkurt.Core.Save;
using Bozkurt.Core.SceneManagement;
using Bozkurt.Core.Services;
using UnityEngine;

namespace Bozkurt.Core.Bootstrap
{
    [DefaultExecutionOrder(-10000)]
    public sealed class GameBootstrapper : MonoBehaviour
    {
        private CancellationTokenSource _lifetime;
        private bool _isBootstrapping;

        public static GameBootstrapper Instance { get; private set; }

        private async void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
            _lifetime = new CancellationTokenSource();

            try
            {
                await BootstrapAsync(_lifetime.Token);
            }
            catch (OperationCanceledException)
            {
                Debug.Log("Bootstrap cancelled.");
            }
            catch (Exception exception)
            {
                Debug.LogException(exception);
            }
        }

        private async Task BootstrapAsync(CancellationToken cancellationToken)
        {
            if (_isBootstrapping)
            {
                return;
            }

            _isBootstrapping = true;
            GameServices.Registry.Clear();

            var sceneLoader = new SceneLoader();
            var saveService = new LocalSaveService();
            GameServices.Registry.Register<ISceneLoader>(sceneLoader);
            GameServices.Registry.Register<ISaveService>(saveService);

            await saveService.LoadOrCreateAsync(cancellationToken);
            await sceneLoader.LoadSingleAsync(SceneNames.MainMenu, cancellationToken);
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                _ = SaveCurrentAsync();
            }
        }

        private void OnApplicationQuit()
        {
            _lifetime?.Cancel();
            _lifetime?.Dispose();
        }

        private static async Task SaveCurrentAsync()
        {
            if (!GameServices.Registry.TryResolve<ISaveService>(out var saveService) || saveService.Current == null)
            {
                return;
            }

            try
            {
                await saveService.SaveAsync(saveService.Current);
            }
            catch (Exception exception)
            {
                Debug.LogException(exception);
            }
        }
    }
}
