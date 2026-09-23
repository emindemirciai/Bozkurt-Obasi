#if UNITY_EDITOR
using System;
using System.IO;
using Bozkurt.Core;
using Bozkurt.Core.Bootstrap;
using Bozkurt.Gameplay.Camps;
using Bozkurt.Gameplay.Prototype;
using Bozkurt.Gameplay.Quests;
using Bozkurt.Gameplay.Save;
using Bozkurt.Gameplay.World;
using Bozkurt.Input;
using Bozkurt.Networking;
using Bozkurt.UI;
using UnityEditor;
using UnityEditor.Events;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Bozkurt.Editor
{
    [InitializeOnLoad]
    public static class Wp00ProjectSetup
    {
        private const string SetupMarker = "ProjectSettings/BozkurtWp11OnlineFoundationSetup.complete";
        private const string SceneDirectory = "Assets/_Project/Scenes";
        private const string SettingsDirectory = "Assets/_Project/Settings";

        static Wp00ProjectSetup()
        {
            EditorApplication.delayCall += TryAutomaticSetup;
        }

        [MenuItem("Bozkurt/Project/Run Current Setup (WP-11 Çevrim İçi Temel)")]
        public static void RunSetupFromMenu()
        {
            RunSetup(true);
        }

        private static void TryAutomaticSetup()
        {
            if (Application.isBatchMode || File.Exists(SetupMarker) || EditorApplication.isPlayingOrWillChangePlaymode)
            {
                return;
            }

            RunSetup(false);
        }

        private static void RunSetup(bool showDialog)
        {
            try
            {
                Directory.CreateDirectory(SceneDirectory);
                Directory.CreateDirectory(SettingsDirectory);
                ConfigurePlayerSettings();
                BozkurtBuildPipeline.ConfigurePlayerSettingsForAllTargets();
                ConfigureRenderPipeline();
                CreateBootstrapScene();
                CreateMainMenuScene();
                CreatePrototypeScene();
                ConfigureBuildScenes();
                File.WriteAllText(SetupMarker, DateTime.UtcNow.ToString("O"));
                AssetDatabase.SaveAssets();
                AssetDatabase.Refresh();

                if (showDialog)
                {
                    EditorUtility.DisplayDialog(
                        "Bozkurt WP-11 Çevrim İçi Temel",
                        "Nakama misafir hesabı, profil, arkadaşlık ve bulut kayıt temeli kuruldu. Önce infrastructure/nakama içindeki yerel sunucuyu başlatın.",
                        "Tamam");
                }

                Debug.Log("Bozkurt WP-11 online foundation setup completed successfully.");
            }
            catch (Exception exception)
            {
                Debug.LogException(exception);
                if (showDialog)
                {
                    EditorUtility.DisplayDialog(
                        "Bozkurt WP-11 Çevrim İçi Temel Kurulum Hatası",
                        exception.Message,
                        "Kapat");
                }
            }
        }

        private static void ConfigurePlayerSettings()
        {
            PlayerSettings.productName = GameConstants.ProductName;
            PlayerSettings.companyName = "Emin Demirci Games";
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.colorSpace = ColorSpace.Linear;
        }

        private static void ConfigureRenderPipeline()
        {
            const string rendererPath = SettingsDirectory + "/Bozkurt_UniversalRenderer.asset";
            const string pipelinePath = SettingsDirectory + "/Bozkurt_URP.asset";

            var rendererData = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(rendererPath);
            if (rendererData == null)
            {
                rendererData = ScriptableObject.CreateInstance<UniversalRendererData>();
                AssetDatabase.CreateAsset(rendererData, rendererPath);
            }

            var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(pipelinePath);
            if (pipeline == null)
            {
                pipeline = UniversalRenderPipelineAsset.Create(rendererData);
                pipeline.name = "Bozkurt URP";
                pipeline.shadowDistance = 40f;
                pipeline.msaaSampleCount = 2;
                AssetDatabase.CreateAsset(pipeline, pipelinePath);
            }

            GraphicsSettings.defaultRenderPipeline = pipeline;
            QualitySettings.renderPipeline = pipeline;
        }

        private static void CreateBootstrapScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var bootstrap = new GameObject("GameBootstrapper");
            bootstrap.AddComponent<GameBootstrapper>();
            bootstrap.AddComponent<NakamaServiceInstaller>();
            EditorSceneManager.SaveScene(scene, $"{SceneDirectory}/{SceneNames.Bootstrap}.unity");
        }

        private static void CreateMainMenuScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            CreateCamera(new Vector3(0f, 5f, -10f), Quaternion.Euler(20f, 0f, 0f), false);
            CreateDirectionalLight();
            var controller = new GameObject("MainMenuController").AddComponent<MainMenuController>();
            var onlineController = new GameObject("OnlineMenuController").AddComponent<OnlineMenuController>();
            CreateEventSystem();

            var canvas = CreateCanvas("MainMenuCanvas");
            var panel = CreatePanel(canvas.transform, new Color(0.05f, 0.07f, 0.09f, 0.92f));
            panel.rectTransform.sizeDelta = new Vector2(980f, 640f);
            CreateText(panel.transform, GameConstants.ProductName, 42, new Vector2(0f, 205f), new Vector2(900f, 80f));
            CreateText(panel.transform, "WP-11 Çevrim İçi Hesap ve Bulut Kayıt", 22, new Vector2(0f, 145f), new Vector2(760f, 55f));
            CreateButton(panel.transform, "Prototipi Başlat", new Vector2(0f, 55f), controller.StartPrototype);
            CreateButton(panel.transform, "Çevrim İçi", new Vector2(0f, -25f), onlineController.ToggleOnlinePanel);
            CreateButton(panel.transform, "Çıkış", new Vector2(0f, -105f), controller.QuitGame);

            var onlinePanel = CreateAnchoredPanel(
                canvas.transform,
                "OnlinePanel",
                new Vector2(1120f, 760f),
                new Vector2(0.5f, 0.5f),
                Vector2.zero,
                new Color(0.025f, 0.04f, 0.055f, 0.985f));
            onlinePanel.GetComponent<Image>().raycastTarget = true;
            CreateText(onlinePanel.transform, "Çevrim İçi Merkez", 30, new Vector2(0f, 325f), new Vector2(620f, 50f));
            CreateButton(onlinePanel.transform, "×", new Vector2(510f, 330f), onlineController.ClosePanel, size: new Vector2(44f, 40f), fontSize: 24);
            var serverText = CreateText(onlinePanel.transform, string.Empty, 16, new Vector2(-300f, 280f), new Vector2(470f, 34f), TextAnchor.MiddleLeft);
            var onlineStatusText = CreateText(onlinePanel.transform, string.Empty, 16, new Vector2(250f, 280f), new Vector2(520f, 34f), TextAnchor.MiddleLeft);
            CreateButton(onlinePanel.transform, "Bağlan", new Vector2(430f, 225f), onlineController.Connect, size: new Vector2(150f, 42f), fontSize: 17);

            CreateText(onlinePanel.transform, "Kullanıcı adı", 16, new Vector2(-410f, 220f), new Vector2(200f, 32f), TextAnchor.MiddleLeft);
            var usernameInput = CreateInputField(onlinePanel.transform, "kullanici_adi", new Vector2(-190f, 220f), new Vector2(300f, 42f));
            CreateText(onlinePanel.transform, "Görünen ad", 16, new Vector2(-410f, 165f), new Vector2(200f, 32f), TextAnchor.MiddleLeft);
            var displayNameInput = CreateInputField(onlinePanel.transform, "Görünen ad", new Vector2(-190f, 165f), new Vector2(300f, 42f));
            CreateButton(onlinePanel.transform, "Profili Kaydet", new Vector2(100f, 192f), onlineController.SaveProfile, size: new Vector2(190f, 46f), fontSize: 17);

            CreateText(onlinePanel.transform, "Arkadaş kullanıcı adı", 16, new Vector2(-380f, 90f), new Vector2(250f, 32f), TextAnchor.MiddleLeft);
            var friendInput = CreateInputField(onlinePanel.transform, "arkadas_adi", new Vector2(-120f, 90f), new Vector2(350f, 42f));
            CreateButton(onlinePanel.transform, "İstek Gönder", new Vector2(180f, 90f), onlineController.AddFriend, size: new Vector2(180f, 42f), fontSize: 16);
            CreateButton(onlinePanel.transform, "Listeyi Yenile", new Vector2(390f, 90f), onlineController.RefreshFriends, size: new Vector2(180f, 42f), fontSize: 16);

            var friendsPanel = CreateAnchoredPanel(
                onlinePanel.transform,
                "FriendsPanel",
                new Vector2(980f, 250f),
                new Vector2(0.5f, 0.5f),
                new Vector2(0f, -75f),
                new Color(0.055f, 0.075f, 0.09f, 0.92f));
            CreateText(friendsPanel.transform, "Arkadaşlar", 19, new Vector2(0f, 100f), new Vector2(900f, 32f), TextAnchor.MiddleLeft);
            var friendsText = CreateText(friendsPanel.transform, string.Empty, 15, new Vector2(0f, -10f), new Vector2(900f, 170f), TextAnchor.UpperLeft);

            CreateButton(onlinePanel.transform, "Buluta Yükle", new Vector2(-150f, -265f), onlineController.UploadCloudSave, size: new Vector2(200f, 46f), fontSize: 17);
            CreateButton(onlinePanel.transform, "Buluttan İndir", new Vector2(80f, -265f), onlineController.DownloadCloudSave, size: new Vector2(210f, 46f), fontSize: 17);
            var onlineMessageText = CreateText(onlinePanel.transform, string.Empty, 15, new Vector2(0f, -325f), new Vector2(980f, 60f), TextAnchor.MiddleLeft);

            onlineController.ConfigureUi(
                onlinePanel,
                onlineStatusText,
                serverText,
                usernameInput,
                displayNameInput,
                friendInput,
                friendsText,
                onlineMessageText);

            EditorSceneManager.SaveScene(scene, $"{SceneDirectory}/{SceneNames.MainMenu}.unity");
        }

        private static void CreatePrototypeScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var camera = CreateCamera(new Vector3(-17f, 22f, -24f), Quaternion.Euler(48f, 35f, 0f), true);
            camera.gameObject.AddComponent<IsometricCameraController>();
            CreateDirectionalLight();
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.55f, 0.56f, 0.58f);

            var prototype = new GameObject("FormationPrototype").AddComponent<FormationPrototypeController>();
            _ = new GameObject("PrototypeSelectionController").AddComponent<PrototypeSelectionController>();
            _ = new GameObject("PrototypeWorldController").AddComponent<PrototypeWorldController>();
            _ = new GameObject("PrototypeCampController").AddComponent<PrototypeCampController>();
            _ = new GameObject("PrototypeQuestController").AddComponent<PrototypeQuestController>();
            _ = new GameObject("PrototypeSessionSaveController").AddComponent<PrototypeSessionSaveController>();
            CreateEventSystem();

            var hudController = new GameObject("PrototypeHudController").AddComponent<PrototypeHudController>();
            var canvas = CreateCanvas("PrototypeHUD");

            var statusPanel = CreateAnchoredPanel(
                canvas.transform,
                "CompactStatusPanel",
                new Vector2(760f, 108f),
                new Vector2(0f, 1f),
                new Vector2(390f, -62f),
                new Color(0.035f, 0.055f, 0.075f, 0.86f));
            var statusText = CreateText(
                statusPanel.transform,
                string.Empty,
                16,
                Vector2.zero,
                new Vector2(730f, 88f),
                TextAnchor.MiddleLeft);

            var logPanel = CreateAnchoredPanel(
                canvas.transform,
                "EventLogPanel",
                new Vector2(525f, 175f),
                new Vector2(1f, 0f),
                new Vector2(-277f, 128f),
                new Color(0.035f, 0.055f, 0.075f, 0.84f));
            CreateText(logPanel.transform, "Olay Akışı", 17, new Vector2(0f, 67f), new Vector2(485f, 28f), TextAnchor.MiddleLeft);
            var eventLogText = CreateText(
                logPanel.transform,
                string.Empty,
                14,
                new Vector2(0f, -12f),
                new Vector2(485f, 125f),
                TextAnchor.LowerLeft);

            var categoryBar = CreateAnchoredPanel(
                canvas.transform,
                "CategoryBar",
                new Vector2(1035f, 62f),
                new Vector2(0f, 0f),
                new Vector2(547f, 35f),
                new Color(0.035f, 0.055f, 0.075f, 0.9f));
            CreateButton(categoryBar.transform, "Kurt", new Vector2(-450f, 0f), hudController.ToggleWolfCommands, size: new Vector2(120f, 44f), fontSize: 17);
            CreateButton(categoryBar.transform, "Çakal", new Vector2(-300f, 0f), hudController.ToggleJackalCommands, size: new Vector2(120f, 44f), fontSize: 17);
            CreateButton(categoryBar.transform, "Sürü", new Vector2(-150f, 0f), hudController.ToggleHerdCommands, size: new Vector2(120f, 44f), fontSize: 17);
            CreateButton(categoryBar.transform, "Dünya", new Vector2(0f, 0f), hudController.ToggleWorldCommands, size: new Vector2(120f, 44f), fontSize: 17);
            CreateButton(categoryBar.transform, "Kamp", new Vector2(150f, 0f), hudController.ToggleCampCommands, size: new Vector2(120f, 44f), fontSize: 17);
            CreateButton(categoryBar.transform, "Görev", new Vector2(300f, 0f), hudController.ToggleQuestPanel, size: new Vector2(120f, 44f), fontSize: 17);
            CreateButton(categoryBar.transform, "Savaş", new Vector2(450f, 0f), hudController.ToggleBattleCommands, size: new Vector2(120f, 44f), fontSize: 17);

            CreateButton(canvas.transform, "Ana Menü", new Vector2(-78f, -34f), hudController.ReturnToMenu, new Vector2(1f, 1f), new Vector2(130f, 44f), 18);

            var wolfPanel = CreateCommandPanel(canvas.transform, "WolfCommandsPanel");
            CreateButton(wolfPanel.transform, "Sıkı Hilal", new Vector2(-320f, 0f), hudController.SetTightCrescent, size: new Vector2(145f, 46f), fontSize: 17);
            CreateButton(wolfPanel.transform, "Dengeli Hilal", new Vector2(-160f, 0f), hudController.SetBalancedCrescent, size: new Vector2(145f, 46f), fontSize: 17);
            CreateButton(wolfPanel.transform, "Geniş Hilal", new Vector2(0f, 0f), hudController.SetWideCrescent, size: new Vector2(145f, 46f), fontSize: 17);
            CreateButton(wolfPanel.transform, "Hilale Dön", new Vector2(160f, 0f), hudController.ReturnWolvesToFormation, size: new Vector2(145f, 46f), fontSize: 17);
            CreateButton(wolfPanel.transform, "Şifacıyı Seç", new Vector2(320f, 0f), hudController.SelectHealer, size: new Vector2(145f, 46f), fontSize: 17);

            var jackalPanel = CreateCommandPanel(canvas.transform, "JackalCommandsPanel");
            CreateButton(jackalPanel.transform, "Doğrudan", new Vector2(-320f, 0f), hudController.SetDirectJackalTactic, size: new Vector2(145f, 46f), fontSize: 17);
            CreateButton(jackalPanel.transform, "Sol Kanat", new Vector2(-160f, 0f), hudController.SetLeftJackalTactic, size: new Vector2(145f, 46f), fontSize: 17);
            CreateButton(jackalPanel.transform, "Sağ Kanat", new Vector2(0f, 0f), hudController.SetRightJackalTactic, size: new Vector2(145f, 46f), fontSize: 17);
            CreateButton(jackalPanel.transform, "Çift Kanat", new Vector2(160f, 0f), hudController.SetSplitJackalTactic, size: new Vector2(145f, 46f), fontSize: 17);
            CreateButton(jackalPanel.transform, "Sürü Hücumu", new Vector2(320f, 0f), hudController.SetHerdRushJackalTactic, size: new Vector2(145f, 46f), fontSize: 17);

            var herdPanel = CreateCommandPanel(canvas.transform, "HerdCommandsPanel");
            CreateButton(herdPanel.transform, "Sıkı Yıldız", new Vector2(-315f, 0f), hudController.SetTightStar, size: new Vector2(140f, 46f), fontSize: 16);
            CreateButton(herdPanel.transform, "Dengeli Yıldız", new Vector2(-158f, 0f), hudController.SetBalancedStar, size: new Vector2(155f, 46f), fontSize: 16);
            CreateButton(herdPanel.transform, "Açık Yıldız", new Vector2(0f, 0f), hudController.SetOpenStar, size: new Vector2(140f, 46f), fontSize: 16);
            CreateButton(herdPanel.transform, "Sürüyü Topla", new Vector2(158f, 0f), hudController.ReturnHerdToFormation, size: new Vector2(150f, 46f), fontSize: 16);
            CreateButton(herdPanel.transform, "Sürüyü Tedavi Et", new Vector2(318f, 0f), hudController.TreatHerd, size: new Vector2(155f, 46f), fontSize: 16);

            var worldPanel = CreateCommandPanel(canvas.transform, "WorldCommandsPanel");
            CreateButton(worldPanel.transform, "Rota Seç", new Vector2(-240f, 0f), hudController.CycleRoute, size: new Vector2(160f, 46f), fontSize: 17);
            CreateButton(worldPanel.transform, "Göçe Başla", new Vector2(-65f, 0f), hudController.StartMigration, size: new Vector2(160f, 46f), fontSize: 17);
            CreateButton(worldPanel.transform, "Kaynak Topla", new Vector2(115f, 0f), hudController.CollectResources, size: new Vector2(170f, 46f), fontSize: 17);
            CreateButton(worldPanel.transform, "Havayı Değiştir", new Vector2(300f, 0f), hudController.CycleWeather, size: new Vector2(180f, 46f), fontSize: 17);

            var campPanel = CreateCommandPanel(canvas.transform, "CampCommandsPanel");
            CreateButton(campPanel.transform, "Kamp Kur", new Vector2(-270f, 0f), hudController.EstablishCamp, size: new Vector2(170f, 46f), fontSize: 17);
            CreateButton(campPanel.transform, "Yapı Seç", new Vector2(-85f, 0f), hudController.CycleCampBuilding, size: new Vector2(170f, 46f), fontSize: 17);
            CreateButton(campPanel.transform, "Yapıyı Kur", new Vector2(100f, 0f), hudController.BuildCampBuilding, size: new Vector2(170f, 46f), fontSize: 17);
            CreateButton(campPanel.transform, "Kampta Dinlen", new Vector2(290f, 0f), hudController.RestAtCamp, size: new Vector2(185f, 46f), fontSize: 17);

            var battlePanel = CreateCommandPanel(canvas.transform, "BattleCommandsPanel");
            CreateButton(battlePanel.transform, "Yeni Savaş", new Vector2(-180f, 0f), hudController.PrepareNextBattle, size: new Vector2(175f, 46f), fontSize: 17);
            CreateButton(battlePanel.transform, "Savaşı Başlat", new Vector2(10f, 0f), hudController.StartBattle, size: new Vector2(185f, 46f), fontSize: 17);
            CreateButton(battlePanel.transform, "Alanı Sıfırla", new Vector2(210f, 0f), hudController.ResetCombat, size: new Vector2(185f, 46f), fontSize: 17);

            var popup = CreateAnchoredPanel(
                canvas.transform,
                "WolfProgressionPopup",
                new Vector2(485f, 430f),
                new Vector2(1f, 0.5f),
                new Vector2(-260f, 25f),
                new Color(0.035f, 0.055f, 0.075f, 0.96f));
            CreateText(popup.transform, "Kurt Gelişimi", 24, new Vector2(-20f, 180f), new Vector2(350f, 46f), TextAnchor.MiddleCenter);
            CreateButton(popup.transform, "×", new Vector2(210f, 182f), hudController.CloseWolfPopup, size: new Vector2(42f, 38f), fontSize: 24);
            var popupText = CreateText(popup.transform, string.Empty, 16, new Vector2(0f, 30f), new Vector2(435f, 285f), TextAnchor.UpperLeft);
            CreateButton(popup.transform, "Muhafız", new Vector2(-165f, -180f), hudController.TrainGuardian, size: new Vector2(105f, 44f), fontSize: 16);
            CreateButton(popup.transform, "Avcı", new Vector2(-55f, -180f), hudController.TrainHunter, size: new Vector2(100f, 44f), fontSize: 16);
            CreateButton(popup.transform, "Lider", new Vector2(55f, -180f), hudController.TrainLeader, size: new Vector2(100f, 44f), fontSize: 16);
            CreateButton(popup.transform, "Şifacı", new Vector2(165f, -180f), hudController.TrainHealer, size: new Vector2(105f, 44f), fontSize: 16);

            var questPopup = CreateAnchoredPanel(
                canvas.transform,
                "QuestPopup",
                new Vector2(540f, 500f),
                new Vector2(0f, 0.5f),
                new Vector2(285f, 40f),
                new Color(0.035f, 0.055f, 0.075f, 0.97f));
            CreateText(questPopup.transform, "Görevler", 25, new Vector2(-15f, 215f), new Vector2(390f, 42f), TextAnchor.MiddleCenter);
            CreateButton(questPopup.transform, "×", new Vector2(235f, 218f), hudController.CloseQuestPopup, size: new Vector2(42f, 38f), fontSize: 24);
            var questPopupText = CreateText(questPopup.transform, string.Empty, 16, new Vector2(0f, 5f), new Vector2(490f, 365f), TextAnchor.UpperLeft);
            CreateButton(questPopup.transform, "Takip Edileni Değiştir", new Vector2(0f, -218f), hudController.CycleTrackedQuest, size: new Vector2(240f, 42f), fontSize: 16);

            var narratorPanel = CreateAnchoredPanel(
                canvas.transform,
                "NarratorPanel",
                new Vector2(760f, 76f),
                new Vector2(0.5f, 1f),
                new Vector2(0f, -55f),
                new Color(0.055f, 0.065f, 0.08f, 0.9f));
            var narratorText = CreateText(narratorPanel.transform, string.Empty, 18, Vector2.zero, new Vector2(710f, 58f), TextAnchor.MiddleCenter);

            var resultPopup = CreateAnchoredPanel(
                canvas.transform,
                "QuestResultPopup",
                new Vector2(650f, 430f),
                new Vector2(0.5f, 0.5f),
                new Vector2(0f, 20f),
                new Color(0.035f, 0.055f, 0.075f, 0.985f));
            var resultText = CreateText(resultPopup.transform, string.Empty, 18, new Vector2(0f, 25f), new Vector2(580f, 320f), TextAnchor.UpperLeft);
            CreateButton(resultPopup.transform, "Ödülleri Al", new Vector2(0f, -170f), hudController.CloseQuestResult, size: new Vector2(200f, 48f), fontSize: 18);

            hudController.ConfigureUi(
                statusText,
                eventLogText,
                popupText,
                questPopupText,
                narratorText,
                resultText,
                wolfPanel,
                jackalPanel,
                herdPanel,
                worldPanel,
                campPanel,
                battlePanel,
                popup,
                questPopup,
                narratorPanel,
                resultPopup);

            EditorSceneManager.SaveScene(scene, $"{SceneDirectory}/{SceneNames.FormationPrototype}.unity");
        }

        private static Camera CreateCamera(Vector3 position, Quaternion rotation, bool isMain)
        {
            var gameObject = new GameObject(isMain ? "Main Camera" : "Camera");
            gameObject.tag = "MainCamera";
            gameObject.transform.SetPositionAndRotation(position, rotation);
            var camera = gameObject.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.18f, 0.24f, 0.28f);
            camera.nearClipPlane = 0.1f;
            camera.farClipPlane = 300f;
            gameObject.AddComponent<AudioListener>();
            return camera;
        }

        private static void CreateDirectionalLight()
        {
            var lightObject = new GameObject("Directional Light");
            lightObject.transform.rotation = Quaternion.Euler(48f, -35f, 0f);
            var light = lightObject.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.15f;
            light.shadows = LightShadows.Soft;
        }

        private static void CreateEventSystem()
        {
            var eventSystem = new GameObject("EventSystem");
            eventSystem.AddComponent<EventSystem>();
            eventSystem.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();
        }

        private static Canvas CreateCanvas(string name)
        {
            var canvasObject = new GameObject(name);
            var canvas = canvasObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.matchWidthOrHeight = 0.5f;
            canvasObject.AddComponent<GraphicRaycaster>();
            return canvas;
        }

        private static Image CreatePanel(Transform parent, Color color)
        {
            var panelObject = new GameObject("Panel", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            panelObject.transform.SetParent(parent, false);
            var rect = panelObject.GetComponent<RectTransform>();
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.sizeDelta = new Vector2(980f, 520f);
            panelObject.GetComponent<Image>().color = color;
            return panelObject.GetComponent<Image>();
        }

        private static GameObject CreateAnchoredPanel(
            Transform parent,
            string name,
            Vector2 size,
            Vector2 anchor,
            Vector2 anchoredPosition,
            Color color)
        {
            var panelObject = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            panelObject.transform.SetParent(parent, false);
            var rect = panelObject.GetComponent<RectTransform>();
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;
            var image = panelObject.GetComponent<Image>();
            image.color = color;
            image.raycastTarget = false;
            return panelObject;
        }

        private static GameObject CreateCommandPanel(Transform parent, string name)
        {
            return CreateAnchoredPanel(
                parent,
                name,
                new Vector2(900f, 66f),
                new Vector2(0f, 0f),
                new Vector2(480f, 102f),
                new Color(0.035f, 0.055f, 0.075f, 0.94f));
        }

        private static Text CreateText(
            Transform parent,
            string content,
            int fontSize,
            Vector2 anchoredPosition,
            Vector2 size,
            TextAnchor alignment = TextAnchor.MiddleCenter,
            Vector2? anchor = null)
        {
            var textObject = new GameObject("Text", typeof(RectTransform), typeof(CanvasRenderer), typeof(Text));
            textObject.transform.SetParent(parent, false);
            var rect = textObject.GetComponent<RectTransform>();
            var anchorValue = anchor ?? new Vector2(0.5f, 0.5f);
            rect.anchorMin = anchorValue;
            rect.anchorMax = anchorValue;
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;
            var text = textObject.GetComponent<Text>();
            text.text = content;
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = fontSize;
            text.alignment = alignment;
            text.color = Color.white;
            text.raycastTarget = false;
            return text;
        }

        private static InputField CreateInputField(
            Transform parent,
            string placeholder,
            Vector2 anchoredPosition,
            Vector2 size)
        {
            var fieldObject = new GameObject("InputField", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(InputField));
            fieldObject.transform.SetParent(parent, false);
            var rect = fieldObject.GetComponent<RectTransform>();
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;
            fieldObject.GetComponent<Image>().color = new Color(0.12f, 0.16f, 0.2f, 1f);

            var text = CreateText(fieldObject.transform, string.Empty, 17, Vector2.zero, new Vector2(size.x - 24f, size.y - 8f), TextAnchor.MiddleLeft);
            var placeholderText = CreateText(fieldObject.transform, placeholder, 16, Vector2.zero, new Vector2(size.x - 24f, size.y - 8f), TextAnchor.MiddleLeft);
            placeholderText.color = new Color(0.72f, 0.75f, 0.78f, 0.75f);

            var input = fieldObject.GetComponent<InputField>();
            input.textComponent = text;
            input.placeholder = placeholderText;
            input.lineType = InputField.LineType.SingleLine;
            input.characterLimit = 32;
            return input;
        }

        private static Button CreateButton(
            Transform parent,
            string label,
            Vector2 anchoredPosition,
            UnityEngine.Events.UnityAction callback,
            Vector2? anchor = null,
            Vector2? size = null,
            int fontSize = 22)
        {
            var buttonObject = new GameObject(label, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button));
            buttonObject.transform.SetParent(parent, false);
            var rect = buttonObject.GetComponent<RectTransform>();
            var anchorValue = anchor ?? new Vector2(0.5f, 0.5f);
            rect.anchorMin = anchorValue;
            rect.anchorMax = anchorValue;
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size ?? new Vector2(360f, 62f);
            buttonObject.GetComponent<Image>().color = new Color(0.18f, 0.28f, 0.36f, 0.98f);
            var button = buttonObject.GetComponent<Button>();
            UnityEventTools.AddPersistentListener(button.onClick, callback);
            CreateText(buttonObject.transform, label, fontSize, Vector2.zero, rect.sizeDelta);
            return button;
        }

        private static void ConfigureBuildScenes()
        {
            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene($"{SceneDirectory}/{SceneNames.Bootstrap}.unity", true),
                new EditorBuildSettingsScene($"{SceneDirectory}/{SceneNames.MainMenu}.unity", true),
                new EditorBuildSettingsScene($"{SceneDirectory}/{SceneNames.FormationPrototype}.unity", true)
            };
        }
    }
}
#endif
