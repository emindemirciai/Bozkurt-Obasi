using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Bozkurt.Gameplay.Camps;
using Bozkurt.Gameplay.Prototype;
using Bozkurt.Gameplay.Save;
using Bozkurt.Gameplay.World;
using UnityEngine;

namespace Bozkurt.Gameplay.Quests
{
    [DisallowMultipleComponent]
    public sealed class PrototypeQuestController : MonoBehaviour
    {
        [SerializeField, Min(2f)] private float narratorDuration = 5.5f;

        private readonly List<QuestDefinition> _mainDefinitions = new();
        private readonly List<QuestRuntime> _sideQuests = new();
        private readonly Queue<QuestRuntime> _completedResults = new();
        private readonly Queue<string> _narratorQueue = new();

        private FormationPrototypeController _formation;
        private PrototypeWorldController _world;
        private PrototypeCampController _camp;
        private QuestRuntime _mainQuest;
        private int _mainDefinitionIndex;
        private int _trackedQuestIndex;
        private string _lastLocation = string.Empty;
        private PrototypeBattlePhase _lastBattlePhase;
        private string _narratorText = string.Empty;
        private float _narratorUntil;
        private bool _initialized;

        public event Action<string> EventRaised;

        public bool HasQuestResult => _completedResults.Count > 0;
        public bool IsNarratorVisible => !string.IsNullOrWhiteSpace(_narratorText) && Time.unscaledTime < _narratorUntil;
        public string NarratorText => IsNarratorVisible ? _narratorText : string.Empty;
        public string QuestResultTitle => HasQuestResult ? $"Görev Tamamlandı: {_completedResults.Peek().Definition.Title}" : string.Empty;
        public string QuestResultBody => HasQuestResult ? BuildResultBody(_completedResults.Peek()) : string.Empty;
        public string QuestPanelText => BuildQuestPanelText();
        public string TrackedQuestText => BuildTrackedQuestText();

        private void Awake()
        {
            BuildDefinitions();
            FindControllers();
        }

        private void Start()
        {
            FindControllers();
            ActivateFirstQuests();
            _lastLocation = _world != null ? _world.CurrentLocationName : string.Empty;
            _lastBattlePhase = _formation != null ? _formation.BattlePhase : PrototypeBattlePhase.Preparation;
            _initialized = true;
        }

        private void Update()
        {
            FindControllers();
            if (!_initialized || _formation == null || _world == null)
            {
                return;
            }

            if (_world.CurrentLocationName != _lastLocation)
            {
                _lastLocation = _world.CurrentLocationName;
                NotifyAction(QuestActionType.ReachLocation, 1, _lastLocation);
            }

            if (_formation.BattlePhase != _lastBattlePhase)
            {
                var current = _formation.BattlePhase;
                _lastBattlePhase = current;
                if (current == PrototypeBattlePhase.Victory)
                {
                    NotifyAction(QuestActionType.WinBattle);
                    if (_formation.IsUnityBonusActive)
                    {
                        NotifyAction(QuestActionType.WinBattleWithUnity);
                    }
                }
            }

            if (!IsNarratorVisible && _narratorQueue.Count > 0)
            {
                ShowNarrator(_narratorQueue.Dequeue());
            }
        }

        public QuestSessionData CaptureSessionData()
        {
            var data = new QuestSessionData
            {
                mainDefinitionIndex = _mainDefinitionIndex,
                trackedQuestIndex = _trackedQuestIndex,
                mainQuest = CaptureQuest(_mainQuest)
            };
            foreach (var sideQuest in _sideQuests)
            {
                data.sideQuests.Add(CaptureQuest(sideQuest));
            }
            return data;
        }

        public void RestoreSessionData(QuestSessionData data)
        {
            if (data == null)
            {
                return;
            }

            _completedResults.Clear();
            _narratorQueue.Clear();
            _narratorText = string.Empty;
            _mainDefinitionIndex = Mathf.Clamp(data.mainDefinitionIndex, 0, _mainDefinitions.Count);
            _trackedQuestIndex = Mathf.Max(0, data.trackedQuestIndex);
            _mainQuest = RestoreQuest(data.mainQuest, _mainDefinitions);

            _sideQuests.Clear();
            var sideDefinitions = new[] { CreateSafeCampSideQuest(), CreateHealerSideQuest() };
            if (data.sideQuests != null)
            {
                foreach (var saved in data.sideQuests)
                {
                    var restored = RestoreQuest(saved, sideDefinitions);
                    if (restored != null)
                    {
                        _sideQuests.Add(restored);
                    }
                }
            }

            if (_sideQuests.Count == 0)
            {
                _sideQuests.Add(new QuestRuntime(sideDefinitions[0]));
                _sideQuests.Add(new QuestRuntime(sideDefinitions[1]));
            }

            _lastLocation = _world != null ? _world.CurrentLocationName : string.Empty;
            _lastBattlePhase = _formation != null ? _formation.BattlePhase : PrototypeBattlePhase.Preparation;
            _initialized = true;
        }

        private static QuestRuntimeSessionData CaptureQuest(QuestRuntime quest)
        {
            if (quest == null)
            {
                return null;
            }

            return new QuestRuntimeSessionData
            {
                definitionId = quest.Definition.Id,
                objectiveIndex = quest.CurrentObjectiveIndex,
                currentProgress = quest.CurrentProgress,
                completed = quest.IsCompleted
            };
        }

        private static QuestRuntime RestoreQuest(
            QuestRuntimeSessionData saved,
            IEnumerable<QuestDefinition> definitions)
        {
            if (saved == null || string.IsNullOrWhiteSpace(saved.definitionId))
            {
                return null;
            }

            var definition = definitions.FirstOrDefault(item => item.Id == saved.definitionId);
            if (definition == null)
            {
                return null;
            }

            var quest = new QuestRuntime(definition);
            quest.RestoreState(saved.objectiveIndex, saved.currentProgress, saved.completed);
            return quest;
        }

        public void NotifyAction(QuestActionType action, int amount = 1, string context = "")
        {
            if (amount <= 0)
            {
                return;
            }

            ApplyToQuest(_mainQuest, action, amount, context);
            foreach (var sideQuest in _sideQuests)
            {
                ApplyToQuest(sideQuest, action, amount, context);
            }
        }

        public void CycleTrackedQuest()
        {
            var available = GetTrackableQuests();
            if (available.Count == 0)
            {
                _trackedQuestIndex = 0;
                return;
            }

            _trackedQuestIndex = (_trackedQuestIndex + 1) % available.Count;
            RaiseEvent($"Takip edilen görev: {available[_trackedQuestIndex].Definition.Title}.");
        }

        public void ClaimQuestResult()
        {
            if (_completedResults.Count == 0)
            {
                return;
            }

            var completed = _completedResults.Dequeue();
            RaiseEvent($"{completed.Definition.Title} ödülleri teslim alındı.");
        }

        private void ApplyToQuest(QuestRuntime quest, QuestActionType action, int amount, string context)
        {
            if (quest == null || quest.IsCompleted)
            {
                return;
            }

            var previousObjective = quest.CurrentObjective;
            if (!quest.Apply(action, amount, context, out var objectiveCompleted))
            {
                return;
            }

            if (objectiveCompleted && previousObjective != null)
            {
                RaiseEvent($"Görev ilerledi: {quest.Definition.Title} — {previousObjective.Description}.");
                QueueNarrator(BuildObjectiveNarration(action, context));
            }

            if (quest.IsCompleted)
            {
                CompleteQuest(quest);
            }
        }

        private void CompleteQuest(QuestRuntime quest)
        {
            GrantRewards(quest.Definition);
            _completedResults.Enqueue(quest);
            RaiseEvent($"Görev tamamlandı: {quest.Definition.Title}.");
            QueueNarrator($"{quest.Definition.Title} tamamlandı. Ay-yıldız topluluğu biraz daha güçlendi.");

            if (quest == _mainQuest)
            {
                _mainDefinitionIndex++;
                _mainQuest = _mainDefinitionIndex < _mainDefinitions.Count
                    ? new QuestRuntime(_mainDefinitions[_mainDefinitionIndex])
                    : null;

                if (_mainQuest != null)
                {
                    RaiseEvent($"Yeni ana görev: {_mainQuest.Definition.Title}.");
                    QueueNarrator(_mainQuest.Definition.Narrative);
                }
                else
                {
                    QueueNarrator("Başlangıç Bozkırı görev zinciri tamamlandı. Yeni bölgelerin yolu açıldı.");
                }
            }
        }

        private void GrantRewards(QuestDefinition definition)
        {
            _world?.AddResources(
                definition.RewardWater,
                definition.RewardFeed,
                definition.RewardHerbs,
                definition.RewardWood,
                definition.RewardStone);
            _formation?.GrantExperienceToAllWolves(definition.RewardExperience);
        }

        private void ActivateFirstQuests()
        {
            if (_mainDefinitions.Count > 0)
            {
                _mainQuest = new QuestRuntime(_mainDefinitions[0]);
                QueueNarrator(_mainQuest.Definition.Narrative);
                RaiseEvent($"Ana görev başladı: {_mainQuest.Definition.Title}.");
            }

            _sideQuests.Clear();
            _sideQuests.Add(new QuestRuntime(CreateSafeCampSideQuest()));
            _sideQuests.Add(new QuestRuntime(CreateHealerSideQuest()));
            RaiseEvent("İki yan görev açıldı: Güvenli Barınak ve Şifacının Yolu.");
        }

        private void BuildDefinitions()
        {
            _mainDefinitions.Clear();
            _mainDefinitions.Add(new QuestDefinition(
                "main_departure",
                QuestType.Main,
                "Bozkırdan Ayrılış",
                "Kuraklık sürüyü yola çıkardı. Önce Su Gözü'ne ulaş, kaynak topla ve ilk saldırıyı püskürt.",
                new[]
                {
                    new QuestObjective(QuestActionType.ReachLocation, "Sürüyü Su Gözü'ne ulaştır", 1, "Su Gözü"),
                    new QuestObjective(QuestActionType.CollectResources, "Su Gözü'ndeki kaynakları topla"),
                    new QuestObjective(QuestActionType.WinBattle, "Bir çakal saldırısını püskürt"),
                    new QuestObjective(QuestActionType.EstablishCamp, "Su Gözü yakınında geçici kamp kur")
                },
                rewardWater: 6,
                rewardFeed: 6,
                rewardHerbs: 2,
                rewardExperience: 40));

            _mainDefinitions.Add(new QuestDefinition(
                "main_healing_meadow",
                QuestType.Main,
                "Şifalı Çayırın İzleri",
                "Yaralıların kokusu Şifalı Çayır'a uzanıyor. Sürüyü oraya taşı ve tedavi düzenini kur.",
                new[]
                {
                    new QuestObjective(QuestActionType.ReachLocation, "Şifalı Çayır'a ulaş", 1, "Şifalı Çayır"),
                    new QuestObjective(QuestActionType.TreatHerd, "Sürüyü şifalı bitkilerle tedavi et"),
                    new QuestObjective(QuestActionType.BuildStructure, "İyileştirme Alanı kur", 1, "İyileştirme Alanı"),
                    new QuestObjective(QuestActionType.WinBattleWithUnity, "Ay-Yıldız Birliği aktifken savaşı kazan")
                },
                rewardHerbs: 3,
                rewardWood: 4,
                rewardStone: 3,
                rewardExperience: 60));

            _mainDefinitions.Add(new QuestDefinition(
                "main_high_pasture",
                QuestType.Main,
                "Yüksek Otlak Savunması",
                "Sürü büyüyor. Yüksek Otlak'a ulaş, ileri kamp kur ve bölgeyi iki saldırıya karşı koru.",
                new[]
                {
                    new QuestObjective(QuestActionType.ReachLocation, "Yüksek Otlak'a ulaş", 1, "Yüksek Otlak"),
                    new QuestObjective(QuestActionType.EstablishCamp, "Geçici bir ileri kamp kur"),
                    new QuestObjective(QuestActionType.BuildStructure, "Kampa iki yapı ekle", 2),
                    new QuestObjective(QuestActionType.WinBattle, "İki çakal saldırısını püskürt", 2)
                },
                rewardFeed: 8,
                rewardWood: 5,
                rewardStone: 4,
                rewardExperience: 80));
        }

        private static QuestDefinition CreateSafeCampSideQuest()
        {
            return new QuestDefinition(
                "side_safe_camp",
                QuestType.Side,
                "Güvenli Barınak",
                "Göç yolu üzerinde savunulabilir bir kamp kur.",
                new[]
                {
                    new QuestObjective(QuestActionType.EstablishCamp, "Ana Yurttan uzakta geçici kamp kur"),
                    new QuestObjective(QuestActionType.BuildStructure, "Geçici kampa iki yapı kur", 2)
                },
                rewardWood: 3,
                rewardStone: 2,
                rewardExperience: 25);
        }

        private static QuestDefinition CreateHealerSideQuest()
        {
            return new QuestDefinition(
                "side_healer",
                QuestType.Side,
                "Şifacının Yolu",
                "Şifacı kurdu geliştir ve sürünün yaralarını sar.",
                new[]
                {
                    new QuestObjective(QuestActionType.TrainHealer, "Bir Şifacı eğitim puanı kullan"),
                    new QuestObjective(QuestActionType.TreatHerd, "Sürüyü iki kez tedavi et", 2)
                },
                rewardHerbs: 3,
                rewardExperience: 30);
        }

        private string BuildQuestPanelText()
        {
            var builder = new StringBuilder();
            var trackable = GetTrackableQuests();
            QuestRuntime tracked = null;
            if (trackable.Count > 0)
            {
                if (_trackedQuestIndex >= trackable.Count)
                {
                    _trackedQuestIndex = 0;
                }
                tracked = trackable[_trackedQuestIndex];
            }

            if (_mainQuest != null)
            {
                builder.Append(_mainQuest == tracked ? "► " : string.Empty)
                    .Append("ANA GÖREV — ").AppendLine(_mainQuest.Definition.Title);
                builder.AppendLine(_mainQuest.Definition.Narrative);
                builder.AppendLine(_mainQuest.BuildProgressText(true));
            }
            else
            {
                builder.AppendLine("ANA GÖREV — Başlangıç zinciri tamamlandı.");
            }

            foreach (var sideQuest in _sideQuests)
            {
                builder.AppendLine()
                    .Append(sideQuest == tracked ? "► " : string.Empty)
                    .Append("YAN GÖREV — ").AppendLine(sideQuest.Definition.Title);
                builder.Append(sideQuest.BuildProgressText(true));
            }

            return builder.ToString().TrimEnd();
        }

        private string BuildTrackedQuestText()
        {
            var quests = GetTrackableQuests();
            if (quests.Count == 0)
            {
                return "Görev zinciri tamamlandı";
            }

            if (_trackedQuestIndex >= quests.Count)
            {
                _trackedQuestIndex = 0;
            }

            var quest = quests[_trackedQuestIndex];
            var objective = quest.CurrentObjective;
            return objective == null
                ? quest.Definition.Title
                : $"{quest.Definition.Title}: {objective.Description} ({quest.CurrentProgress}/{objective.RequiredAmount})";
        }

        private List<QuestRuntime> GetTrackableQuests()
        {
            var quests = new List<QuestRuntime>();
            if (_mainQuest != null && !_mainQuest.IsCompleted)
            {
                quests.Add(_mainQuest);
            }
            quests.AddRange(_sideQuests.Where(quest => !quest.IsCompleted));
            return quests;
        }

        private string BuildResultBody(QuestRuntime quest)
        {
            var definition = quest.Definition;
            var rewards = new List<string>();
            if (definition.RewardWater > 0) rewards.Add($"+{definition.RewardWater} su");
            if (definition.RewardFeed > 0) rewards.Add($"+{definition.RewardFeed} yem");
            if (definition.RewardHerbs > 0) rewards.Add($"+{definition.RewardHerbs} şifalı bitki");
            if (definition.RewardWood > 0) rewards.Add($"+{definition.RewardWood} odun");
            if (definition.RewardStone > 0) rewards.Add($"+{definition.RewardStone} taş");
            if (definition.RewardExperience > 0) rewards.Add($"her kurda +{definition.RewardExperience} XP");
            return $"{definition.Narrative}\n\nÖdüller:\n{string.Join("\n", rewards.Select(reward => "• " + reward))}";
        }

        private static string BuildObjectiveNarration(QuestActionType action, string context)
        {
            return action switch
            {
                QuestActionType.ReachLocation => $"Ay-yıldız düzeni {context} bölgesine ulaştı.",
                QuestActionType.WinBattle => "Çakallar geri çekiliyor; sürü yoluna devam edebilir.",
                QuestActionType.WinBattleWithUnity => "Hilal ve yıldız birlikte direndi. Birlik bozulmadı.",
                QuestActionType.TreatHerd => "Şifalı bitkiler ve Şifacı Kurt yaraları hafifletti.",
                QuestActionType.EstablishCamp => "Bozkırda yeni bir güvenli nokta kuruldu.",
                QuestActionType.BuildStructure => $"Kamp güçlendi: {context}.",
                QuestActionType.RestAtCamp => "Topluluk dinlendi; yolculuğa yeniden hazır.",
                QuestActionType.TrainHealer => "Şifacı Kurt yeni bir tedavi tekniği öğrendi.",
                _ => "Görev ilerledi."
            };
        }

        private void QueueNarrator(string message)
        {
            if (!string.IsNullOrWhiteSpace(message))
            {
                _narratorQueue.Enqueue(message.Trim());
            }
        }

        private void ShowNarrator(string message)
        {
            _narratorText = message;
            _narratorUntil = Time.unscaledTime + narratorDuration;
        }

        private void RaiseEvent(string message)
        {
            EventRaised?.Invoke(message);
        }

        private void FindControllers()
        {
            if (_formation == null) _formation = FindFirstObjectByType<FormationPrototypeController>();
            if (_world == null) _world = FindFirstObjectByType<PrototypeWorldController>();
            if (_camp == null) _camp = FindFirstObjectByType<PrototypeCampController>();
        }
    }
}
