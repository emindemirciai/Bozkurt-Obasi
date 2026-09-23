using System;
using Bozkurt.Core;
using Bozkurt.Core.SceneManagement;
using Bozkurt.Core.Services;
using UnityEngine;

namespace Bozkurt.UI
{
    public sealed class MainMenuController : MonoBehaviour
    {
        public async void StartPrototype()
        {
            try
            {
                var sceneLoader = GameServices.Registry.Resolve<ISceneLoader>();
                await sceneLoader.LoadSingleAsync(SceneNames.FormationPrototype);
            }
            catch (Exception exception)
            {
                Debug.LogException(exception);
            }
        }

        public void QuitGame()
        {
            Application.Quit();
        }
    }
}
