using System.Collections.Generic;
using Bozkurt.Core;
using Bozkurt.Core.SceneManagement;
using Bozkurt.Core.Services;
using Bozkurt.Gameplay.Camps;
using Bozkurt.Gameplay.Combat;
using Bozkurt.Gameplay.Progression;
using Bozkurt.Gameplay.Quests;
using Bozkurt.Gameplay.Save;
using Bozkurt.Gameplay.Prototype;
using Bozkurt.Gameplay.World;
using UnityEngine;
using UnityEngine.UI;

namespace Bozkurt.UI
{
    public sealed class PrototypeHudController : MonoBehaviour
    {
        private const int MaximumLogLines = 7;

        private readonly List<string> _eventLines = new();
        private FormationPrototypeController _prototype;
        private PrototypeSelectionController _selection;
        private PrototypeWorldController _world;
        private PrototypeCampController _camp;
        private PrototypeQuestController _quests;
        private PrototypeSessionSaveController _sessionSave;

        [Header("Compact HUD")]
        [SerializeField] private Text compactStatusText;
        [SerializeField] private Text eventLogText;
        [SerializeField] private Text wolfPopupText;
        [SerializeField] private Text questPopupText;
        [SerializeField] private Text narratorText;
        [SerializeField] private Text questResultText;

        [Header("Grouped command panels")]
        [SerializeField] private GameObject wolfCommandsPanel;
        [SerializeField] private GameObject jackalCommandsPanel;
        [SerializeField] private GameObject herdCommandsPanel;
        [SerializeField] private GameObject worldCommandsPanel;
        [SerializeField] private GameObject campCommandsPanel;
        [SerializeField] private GameObject battleCommandsPanel;
        [SerializeField] private GameObject wolfProgressionPopup;
        [SerializeField] private GameObject questPopup;
        [SerializeField] private GameObject narratorPanel;
        [SerializeField] private GameObject questResultPopup;

        private PrototypeBattlePhase _lastBattlePhase;
        private string _lastTacticName = string.Empty;
        private string _lastWeatherName = string.Empty;
        private string _lastLocationName = string.Empty;
        private string _lastMigrationStatus = string.Empty;
        private string _lastCommandMessage = string.Empty;
        private WolfProgression _popupProgression;
        private bool _popupDismissedForCurrentSelection;
        private bool _stateTrackingInitialized;
        private bool _questEventsSubscribed;
        private bool _saveEventsSubscribed;

        private void Awake()
        {
            FindControllers();
            CloseAllCommandPanels();
            SetPopupVisible(false);
            SetActive(questPopup, false);
            SetActive(narratorPanel, false);
            SetActive(questResultPopup, false);
        }

        private void Start()
        {
            FindControllers();
            AppendLog("WP-10 aktif: otomatik kayıt, WebGL/APK derleme ve dağıtım araçları hazır.");
            RefreshAllUi();
        }

        private void Update()
        {
            FindControllers();
            if (_prototype == null)
            {
                return;
            }

            RefreshCompactStatus();
            RefreshWolfPopup();
            RefreshQuestUi();
            TrackStateChanges();
        }

        public void ConfigureUi(
            Text status,
            Text log,
            Text popupText,
            Text missionText,
            Text narrator,
            Text resultText,
            GameObject wolfPanel,
            GameObject jackalPanel,
            GameObject herdPanel,
            GameObject worldPanel,
            GameObject campPanel,
            GameObject battlePanel,
            GameObject progressionPopup,
            GameObject missionPopup,
            GameObject narratorBanner,
            GameObject resultPopup)
        {
            compactStatusText = status;
            eventLogText = log;
            wolfPopupText = popupText;
            questPopupText = missionText;
            narratorText = narrator;
            questResultText = resultText;
            wolfCommandsPanel = wolfPanel;
            jackalCommandsPanel = jackalPanel;
            herdCommandsPanel = herdPanel;
            worldCommandsPanel = worldPanel;
            campCommandsPanel = campPanel;
            battleCommandsPanel = battlePanel;
            wolfProgressionPopup = progressionPopup;
            questPopup = missionPopup;
            narratorPanel = narratorBanner;
            questResultPopup = resultPopup;
            CloseAllCommandPanels();
            SetPopupVisible(false);
            SetActive(questPopup, false);
            SetActive(narratorPanel, false);
            SetActive(questResultPopup, false);
            RefreshAllUi();
        }

        public async void ReturnToMenu()
        {
            FindControllers();
            if (_sessionSave != null)
            {
                await _sessionSave.SaveNowAsync(false);
            }

            var loader = GameServices.Registry.Resolve<ISceneLoader>();
            await loader.LoadSingleAsync(SceneNames.MainMenu);
        }

        public void ToggleWolfCommands() => ToggleExclusivePanel(wolfCommandsPanel);
        public void ToggleJackalCommands() => ToggleExclusivePanel(jackalCommandsPanel);
        public void ToggleHerdCommands() => ToggleExclusivePanel(herdCommandsPanel);
        public void ToggleWorldCommands() => ToggleExclusivePanel(worldCommandsPanel);
        public void ToggleCampCommands() => ToggleExclusivePanel(campCommandsPanel);
        public void ToggleBattleCommands() => ToggleExclusivePanel(battleCommandsPanel);

        public void ToggleQuestPanel()
        {
            CloseAllCommandPanels();
            SetActive(questPopup, questPopup != null && !questPopup.activeSelf);
        }

        public void CloseQuestPopup() => SetActive(questPopup, false);

        public void CycleTrackedQuest()
        {
            FindControllers();
            _quests?.CycleTrackedQuest();
            RefreshQuestUi();
        }

        public void CloseQuestResult()
        {
            FindControllers();
            _quests?.ClaimQuestResult();
            RefreshQuestUi();
        }

        public void CloseWolfPopup()
        {
            _popupDismissedForCurrentSelection = true;
            SetPopupVisible(false);
        }

        public void SetTightCrescent()
        {
            FindControllers();
            _prototype?.SetTightCrescent();
            AppendLog("Kurt formasyonu: Sıkı Hilal.");
        }

        public void SetBalancedCrescent()
        {
            FindControllers();
            _prototype?.SetBalancedCrescent();
            AppendLog("Kurt formasyonu: Dengeli Hilal.");
        }

        public void SetWideCrescent()
        {
            FindControllers();
            _prototype?.SetWideCrescent();
            AppendLog("Kurt formasyonu: Geniş Hilal.");
        }

        public void ReturnWolvesToFormation()
        {
            FindControllers();
            _prototype?.ReturnWolvesToFormation();
            AppendLog("Kurtlar hilal noktalarına çağrıldı.");
        }

        public void RestoreWolves()
        {
            FindControllers();
            _prototype?.RestoreAllWolves();
            AppendLog("Kurtların canı yenilendi ve hilal düzenine dönmeleri emredildi.");
        }

        public void SelectHealer()
        {
            FindControllers();
            _selection?.SelectFirstHealer();
            AppendLog("Şifacı kurt seçildi. Gelişim penceresinden Şifacı becerisini yükseltebilirsin.");
        }

        public void SetDirectJackalTactic() => SetJackalTactic(JackalPackTactic.DirectAssault);
        public void SetLeftJackalTactic() => SetJackalTactic(JackalPackTactic.LeftFlank);
        public void SetRightJackalTactic() => SetJackalTactic(JackalPackTactic.RightFlank);
        public void SetSplitJackalTactic() => SetJackalTactic(JackalPackTactic.SplitFlank);
        public void SetHerdRushJackalTactic() => SetJackalTactic(JackalPackTactic.HerdRush);

        public void SetTightStar()
        {
            FindControllers();
            _prototype?.SetTightStar();
            AppendLog("Sürü formasyonu: Sıkı Yıldız.");
        }

        public void SetBalancedStar()
        {
            FindControllers();
            _prototype?.SetBalancedStar();
            AppendLog("Sürü formasyonu: Dengeli Yıldız.");
        }

        public void SetOpenStar()
        {
            FindControllers();
            _prototype?.SetOpenStar();
            AppendLog("Sürü formasyonu: Açık Yıldız.");
        }

        public void ReturnHerdToFormation()
        {
            FindControllers();
            _prototype?.ReturnHerdToFormation();
            AppendLog("Dağılan sürü yıldız düzenine çağrıldı.");
        }

        public void TreatHerd()
        {
            FindControllers();
            if (_prototype == null || _world == null)
            {
                return;
            }

            if (_prototype.TreatableHerdCount <= 0)
            {
                AppendLog("Sürüde tedavi gerektiren yaralı veya panikleyen hayvan yok.");
                return;
            }

            if (!_world.TryConsumeHerbs(1))
            {
                AppendLog("Sürü tedavisi için en az 1 şifalı bitki gerekiyor.");
                return;
            }

            var affected = _prototype.TreatHerd();
            AppendLog($"Sürü tedavi edildi: {affected} hayvana müdahale edildi, 1 şifalı bitki kullanıldı.");
            if (affected > 0)
            {
                _quests?.NotifyAction(QuestActionType.TreatHerd);
            }
        }

        public void CycleRoute()
        {
            FindControllers();
            _world?.CycleRoute();
            if (_world != null)
            {
                AppendLog($"Rota seçildi: {_world.SelectedRouteName}.");
            }
        }

        public void StartMigration()
        {
            FindControllers();
            _world?.StartMigration();
            if (_world != null)
            {
                AppendLog(_world.IsMigrating
                    ? $"Göç başladı: {_world.SelectedRouteName}."
                    : "Göç başlatılamadı. Su, yem veya savaş durumunu kontrol et.");
            }
        }

        public void CollectResources()
        {
            FindControllers();
            var previousWater = _world != null ? _world.Water : 0;
            var previousFeed = _world != null ? _world.Feed : 0;
            var previousHerbs = _world != null ? _world.Herbs : 0;
            var previousWood = _world != null ? _world.Wood : 0;
            var previousStone = _world != null ? _world.Stone : 0;
            _world?.CollectResources();
            if (_world == null)
            {
                return;
            }

            var gainedWater = _world.Water - previousWater;
            var gainedFeed = _world.Feed - previousFeed;
            var gainedHerbs = _world.Herbs - previousHerbs;
            var gainedWood = _world.Wood - previousWood;
            var gainedStone = _world.Stone - previousStone;
            var totalGained = gainedWater + gainedFeed + gainedHerbs + gainedWood + gainedStone;
            AppendLog(totalGained > 0
                ? $"Kaynak: +{gainedWater} su, +{gainedFeed} yem, +{gainedHerbs} şifa, +{gainedWood} odun, +{gainedStone} taş."
                : "Yakında toplanabilir kaynak bulunamadı.");
            if (totalGained > 0)
            {
                _quests?.NotifyAction(QuestActionType.CollectResources);
            }
        }

        public void CycleWeather()
        {
            FindControllers();
            _world?.CycleWeatherForTest();
            if (_world != null)
            {
                _lastWeatherName = _world.WeatherName;
                AppendLog($"Hava değişti: {_world.WeatherName}.");
            }
        }

        public void EstablishCamp()
        {
            FindControllers();
            if (_camp == null)
            {
                return;
            }

            if (_camp.EstablishFieldCamp(out var message))
            {
                _quests?.NotifyAction(QuestActionType.EstablishCamp);
            }
            AppendLog(message);
        }

        public void CycleCampBuilding()
        {
            FindControllers();
            if (_camp == null)
            {
                return;
            }

            _camp.CycleSelectedBuilding();
            var profile = CampBuildingCatalog.Get(_camp.SelectedBuilding);
            AppendLog($"Yapı seçildi: {profile.DisplayName} — {profile.WoodCost} odun, {profile.StoneCost} taş, {profile.HerbCost} şifa.");
        }

        public void BuildCampBuilding()
        {
            FindControllers();
            if (_camp == null)
            {
                return;
            }

            var selectedBuilding = _camp.SelectedBuildingName;
            if (_camp.BuildSelectedBuilding(out var message))
            {
                _quests?.NotifyAction(QuestActionType.BuildStructure, 1, selectedBuilding);
            }
            AppendLog(message);
        }

        public void RestAtCamp()
        {
            FindControllers();
            if (_camp == null)
            {
                return;
            }

            if (_camp.RestAtCurrentCamp(out var message))
            {
                _quests?.NotifyAction(QuestActionType.RestAtCamp);
            }
            AppendLog(message);
        }

        public void PrepareNextBattle()
        {
            FindControllers();
            if (_prototype == null)
            {
                return;
            }

            var previousWave = _prototype.WaveNumber;
            _prototype.PrepareNextBattle();
            AppendLog(_prototype.WaveNumber > previousWave
                ? $"Dalga {_prototype.WaveNumber} hazırlandı. Çakal taktiğini seçip savaşı başlat."
                : "Yeni savaş şu anda hazırlanamadı.");
        }

        public void StartBattle()
        {
            FindControllers();
            if (_prototype == null)
            {
                return;
            }

            var wasPreparing = _prototype.IsPreparingBattle;
            _prototype.StartBattle();
            _lastBattlePhase = _prototype.BattlePhase;
            AppendLog(wasPreparing && _prototype.IsBattleActive
                ? $"Dalga {_prototype.WaveNumber} başladı — {_prototype.CurrentJackalTacticName}."
                : "Savaş başlatılamadı. Önce yeni dalga hazırla.");
        }

        public void ResetCombat()
        {
            FindControllers();
            _prototype?.ResetCombat();
            if (_prototype != null)
            {
                _lastBattlePhase = _prototype.BattlePhase;
                _lastTacticName = _prototype.CurrentJackalTacticName;
            }
            AppendLog("Savaş alanı başlangıç düzenine sıfırlandı.");
        }

        public void TrainGuardian()
        {
            FindControllers();
            _selection?.TrainSelectedGuardian();
            RefreshWolfPopupText();
        }

        public void TrainHunter()
        {
            FindControllers();
            _selection?.TrainSelectedHunter();
            RefreshWolfPopupText();
        }

        public void TrainLeader()
        {
            FindControllers();
            _selection?.TrainSelectedLeader();
            RefreshWolfPopupText();
        }

        public void TrainHealer()
        {
            FindControllers();
            var progression = _selection != null ? _selection.PrimarySelectedProgression : null;
            var previousRanks = progression != null ? progression.HealerRanks : -1;
            _selection?.TrainSelectedHealer();
            if (progression != null && progression.HealerRanks > previousRanks)
            {
                _quests?.NotifyAction(QuestActionType.TrainHealer);
            }
            RefreshWolfPopupText();
        }

        private void SetJackalTactic(JackalPackTactic tactic)
        {
            FindControllers();
            if (_prototype == null)
            {
                return;
            }

            if (_prototype.SetJackalTactic(tactic))
            {
                _lastTacticName = JackalRoleNames.GetTacticDisplayName(tactic);
                AppendLog($"Çakal taktiği seçildi: {_lastTacticName}.");
            }
            else
            {
                AppendLog("Çakal taktiği yalnızca savaş hazırlığındayken değiştirilebilir.");
            }
        }

        private void FindControllers()
        {
            if (_prototype == null)
            {
                _prototype = FindFirstObjectByType<FormationPrototypeController>();
            }

            if (_selection == null)
            {
                _selection = FindFirstObjectByType<PrototypeSelectionController>();
            }

            if (_world == null)
            {
                _world = FindFirstObjectByType<PrototypeWorldController>();
            }

            if (_camp == null)
            {
                _camp = FindFirstObjectByType<PrototypeCampController>();
            }

            if (_quests == null)
            {
                _quests = FindFirstObjectByType<PrototypeQuestController>();
            }

            if (_quests != null && !_questEventsSubscribed)
            {
                _quests.EventRaised += AppendLog;
                _questEventsSubscribed = true;
            }

            if (_sessionSave == null)
            {
                _sessionSave = FindFirstObjectByType<PrototypeSessionSaveController>();
            }

            if (_sessionSave != null && !_saveEventsSubscribed)
            {
                _sessionSave.EventRaised += AppendLog;
                _saveEventsSubscribed = true;
            }
        }

        private void RefreshAllUi()
        {
            RefreshCompactStatus();
            RefreshWolfPopup();
            RefreshQuestUi();
            RefreshEventLog();
        }

        private void RefreshCompactStatus()
        {
            if (compactStatusText == null || _prototype == null)
            {
                return;
            }

            var crescentPercent = Mathf.RoundToInt(_prototype.CrescentIntegrity01 * 100f);
            var starPercent = Mathf.RoundToInt(_prototype.StarIntegrity01 * 100f);
            var worldLine = _world == null
                ? "Dünya yükleniyor..."
                : $"{_world.TimeLabel}  |  {_world.WeatherName}  |  {_world.CurrentLocationName}  |  Su {_world.Water} Yem {_world.Feed} Ş {_world.Herbs} Od {_world.Wood} Ta {_world.Stone}";
            var rescueLine = GetRescueStatus();
            compactStatusText.text =
                $"{worldLine}\n" +
                $"D{_prototype.WaveNumber} {_prototype.BattlePhaseName}  |  K {_prototype.ActiveWolfCount}/{_prototype.TotalWolfCount}  Ş {_prototype.ActiveHealerCount}  |  S {_prototype.ActiveHerdCount}/{_prototype.TotalHerdCount}  |  Ç {_prototype.RemainingJackalCount}\n" +
                $"Hilal {_prototype.CurrentCrescentModeName} %{crescentPercent}  |  Yıldız {_prototype.CurrentStarModeName} %{starPercent}  |  Yaralı K{_prototype.WoundedWolfCount}/S{_prototype.WoundedHerdCount}  |  {_prototype.CurrentJackalTacticName}{rescueLine}";
        }

        private string GetRescueStatus()
        {
            var wolves = FindObjectsByType<WolfCombatController>(FindObjectsSortMode.None);
            foreach (var wolf in wolves)
            {
                if (wolf == null || !wolf.IsRescuing)
                {
                    continue;
                }

                var percent = Mathf.RoundToInt(wolf.RescueProgress01 * 100f);
                return $"  |  Kurtarma %{percent}";
            }

            return string.Empty;
        }

        private void RefreshWolfPopup()
        {
            var selectedProgression = _selection != null && _selection.SelectedCount == 1
                ? _selection.PrimarySelectedProgression
                : null;

            if (selectedProgression != _popupProgression)
            {
                _popupProgression = selectedProgression;
                _popupDismissedForCurrentSelection = false;
                SetPopupVisible(_popupProgression != null);
            }
            else if (_popupProgression == null)
            {
                SetPopupVisible(false);
            }
            else if (!_popupDismissedForCurrentSelection)
            {
                SetPopupVisible(true);
            }

            RefreshWolfPopupText();
        }

        private void RefreshWolfPopupText()
        {
            if (wolfPopupText == null)
            {
                return;
            }

            if (_popupProgression == null)
            {
                wolfPopupText.text = "Bir kurt seçildiğinde gelişim bilgileri burada gösterilir.";
                return;
            }

            var combat = _popupProgression.GetComponent<WolfCombatController>();
            var healthText = combat != null && combat.Health != null
                ? $"Can: {Mathf.CeilToInt(combat.Health.CurrentHealth)}/{Mathf.CeilToInt(combat.Health.MaximumHealth)}"
                : "Can bilgisi yok";

            wolfPopupText.text =
                $"{_popupProgression.gameObject.name}\n" +
                $"Seviye {_popupProgression.Level}  |  XP {_popupProgression.CurrentExperience}/{_popupProgression.ExperienceRequiredForNextLevel}\n" +
                $"{healthText}  |  Eğitim puanı: {_popupProgression.UnspentTrainingPoints}\n\n" +
                $"Muhafız: {_popupProgression.GuardianRanks}  |  Avcı: {_popupProgression.HunterRanks}\n" +
                $"Lider: {_popupProgression.LeaderRanks}  |  Şifacı: {_popupProgression.HealerRanks}\n" +
                $"Şifa gücü: {_popupProgression.HealingAmount:0}  |  Menzil: {_popupProgression.HealingRange:0.0}\n\n" +
                $"Katkı: {_popupProgression.DamageContribution:0} hasar  |  {_popupProgression.HealingContribution:0} şifa\n" +
                $"{_popupProgression.DefeatedJackals} çakal  |  {_popupProgression.RescuedWolves} kurtarma  |  {_popupProgression.HerdHealingApplications} sürü tedavisi";
        }

        private void RefreshQuestUi()
        {
            if (_quests == null)
            {
                SetActive(narratorPanel, false);
                SetActive(questResultPopup, false);
                return;
            }

            if (questPopupText != null)
            {
                questPopupText.text = _quests.QuestPanelText;
            }

            if (narratorText != null)
            {
                narratorText.text = _quests.NarratorText;
            }
            SetActive(narratorPanel, _quests.IsNarratorVisible);

            if (questResultText != null)
            {
                questResultText.text = _quests.HasQuestResult
                    ? $"{_quests.QuestResultTitle}\n\n{_quests.QuestResultBody}"
                    : string.Empty;
            }
            SetActive(questResultPopup, _quests.HasQuestResult);
        }

        private void TrackStateChanges()
        {
            if (!_stateTrackingInitialized)
            {
                _lastBattlePhase = _prototype.BattlePhase;
                _lastTacticName = _prototype.CurrentJackalTacticName;
                _lastWeatherName = _world != null ? _world.WeatherName : string.Empty;
                _lastLocationName = _world != null ? _world.CurrentLocationName : string.Empty;
                _lastMigrationStatus = _world != null ? _world.MigrationStatusName : string.Empty;
                _stateTrackingInitialized = true;
                return;
            }

            if (_prototype.BattlePhase != _lastBattlePhase)
            {
                _lastBattlePhase = _prototype.BattlePhase;
                AppendLog(_prototype.BattlePhase switch
                {
                    PrototypeBattlePhase.Victory => $"Dalga {_prototype.WaveNumber} püskürtüldü.",
                    PrototypeBattlePhase.Defeat => "Savunma hattı kırıldı.",
                    PrototypeBattlePhase.Active => $"Savaş başladı: {_prototype.CurrentJackalTacticName}.",
                    _ => "Savaş hazırlığı başladı."
                });
            }

            if (_prototype.CurrentJackalTacticName != _lastTacticName)
            {
                _lastTacticName = _prototype.CurrentJackalTacticName;
                AppendLog($"Çakal taktiği: {_lastTacticName}.");
            }

            if (_world != null)
            {
                if (_world.WeatherName != _lastWeatherName)
                {
                    _lastWeatherName = _world.WeatherName;
                    AppendLog($"Hava: {_lastWeatherName}.");
                }

                if (_world.CurrentLocationName != _lastLocationName)
                {
                    _lastLocationName = _world.CurrentLocationName;
                    AppendLog($"Konum: {_lastLocationName}.");
                }

                if (_world.MigrationStatusName != _lastMigrationStatus)
                {
                    _lastMigrationStatus = _world.MigrationStatusName;
                    AppendLog($"Göç durumu: {_lastMigrationStatus}.");
                }
            }

            if (_selection != null)
            {
                var command = _selection.CommandMessage;
                if (string.IsNullOrEmpty(command))
                {
                    _lastCommandMessage = string.Empty;
                }
                else if (command != _lastCommandMessage)
                {
                    _lastCommandMessage = command;
                    AppendLog(command);
                }
            }
        }

        private void ToggleExclusivePanel(GameObject target)
        {
            if (target == null)
            {
                return;
            }

            var shouldOpen = !target.activeSelf;
            CloseAllCommandPanels();
            target.SetActive(shouldOpen);
        }

        private void CloseAllCommandPanels()
        {
            SetActive(wolfCommandsPanel, false);
            SetActive(jackalCommandsPanel, false);
            SetActive(herdCommandsPanel, false);
            SetActive(worldCommandsPanel, false);
            SetActive(campCommandsPanel, false);
            SetActive(battleCommandsPanel, false);
        }

        private void SetPopupVisible(bool visible)
        {
            SetActive(wolfProgressionPopup, visible);
        }

        private void AppendLog(string message)
        {
            if (string.IsNullOrWhiteSpace(message))
            {
                return;
            }

            var prefix = _world != null ? $"[{_world.WorldHour:00}:00] " : string.Empty;
            var line = prefix + message.Trim();
            if (_eventLines.Count > 0 && _eventLines[_eventLines.Count - 1] == line)
            {
                return;
            }

            _eventLines.Add(line);
            while (_eventLines.Count > MaximumLogLines)
            {
                _eventLines.RemoveAt(0);
            }

            RefreshEventLog();
        }

        private void RefreshEventLog()
        {
            if (eventLogText != null)
            {
                eventLogText.text = string.Join("\n", _eventLines);
            }
        }

        private void OnDestroy()
        {
            if (_quests != null && _questEventsSubscribed)
            {
                _quests.EventRaised -= AppendLog;
                _questEventsSubscribed = false;
            }

            if (_sessionSave != null && _saveEventsSubscribed)
            {
                _sessionSave.EventRaised -= AppendLog;
                _saveEventsSubscribed = false;
            }
        }

        private static void SetActive(GameObject target, bool active)
        {
            if (target != null && target.activeSelf != active)
            {
                target.SetActive(active);
            }
        }
    }
}
