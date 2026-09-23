using System;
using System.Collections;
using System.Threading.Tasks;
using Bozkurt.Core.Save;
using Bozkurt.Core.Services;
using Bozkurt.Gameplay.Camps;
using Bozkurt.Gameplay.Prototype;
using Bozkurt.Gameplay.Quests;
using Bozkurt.Gameplay.World;
using UnityEngine;

namespace Bozkurt.Gameplay.Save
{
    [DefaultExecutionOrder(500)]
    [DisallowMultipleComponent]
    public sealed class PrototypeSessionSaveController : MonoBehaviour
    {
        [SerializeField, Min(5f)] private float autosaveIntervalSeconds = 20f;

        private FormationPrototypeController _formation;
        private PrototypeWorldController _world;
        private PrototypeCampController _camps;
        private PrototypeQuestController _quests;
        private float _nextAutosaveAt;
        private bool _restored;
        private bool _saveInProgress;
        private bool _quitting;

        public event Action<string> EventRaised;
        public bool HasRestoredSession => _restored;

        private IEnumerator Start()
        {
            yield return null;
            FindControllers();
            RestoreCurrentSession();
            _nextAutosaveAt = Time.unscaledTime + autosaveIntervalSeconds;
        }

        private void Update()
        {
            if (!_restored || _saveInProgress || Time.unscaledTime < _nextAutosaveAt)
            {
                return;
            }

            _nextAutosaveAt = Time.unscaledTime + autosaveIntervalSeconds;
            _ = SaveNowAsync(false);
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused)
            {
                _ = SaveNowAsync(false);
            }
        }

        private void OnApplicationQuit()
        {
            _quitting = true;
        }

        private void OnDisable()
        {
            if (!_quitting && _restored)
            {
                _ = SaveNowAsync(false);
            }
        }

        public void SaveNow()
        {
            _ = SaveNowAsync(true);
        }

        public async Task SaveNowAsync(bool announce)
        {
            if (_saveInProgress)
            {
                return;
            }

            FindControllers();
            if (_formation == null || _world == null || _camps == null || _quests == null)
            {
                return;
            }

            if (!GameServices.Registry.TryResolve<ISaveService>(out var saveService) || saveService.Current == null)
            {
                return;
            }

            _saveInProgress = true;
            try
            {
                var session = new PrototypeSessionData
                {
                    capturedAtUnix = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                    formation = _formation.CaptureSessionData(),
                    world = _world.CaptureSessionData(),
                    camps = _camps.CaptureSessionData(),
                    quests = _quests.CaptureSessionData()
                };

                saveService.Current.prototypeSessionJson = JsonUtility.ToJson(session);
                await saveService.SaveAsync(saveService.Current);
                if (announce)
                {
                    EventRaised?.Invoke("Oyun kaydedildi.");
                }
            }
            catch (Exception exception)
            {
                Debug.LogException(exception);
                EventRaised?.Invoke("Kayıt sırasında hata oluştu; önceki yedek korunuyor.");
            }
            finally
            {
                _saveInProgress = false;
            }
        }

        private void RestoreCurrentSession()
        {
            _restored = true;
            if (!GameServices.Registry.TryResolve<ISaveService>(out var saveService)
                || saveService.Current == null
                || string.IsNullOrWhiteSpace(saveService.Current.prototypeSessionJson))
            {
                EventRaised?.Invoke("Yeni yerel oyun kaydı oluşturuldu.");
                return;
            }

            try
            {
                var session = JsonUtility.FromJson<PrototypeSessionData>(saveService.Current.prototypeSessionJson);
                if (session == null || session.schemaVersion <= 0)
                {
                    throw new InvalidOperationException("Prototype session data is invalid.");
                }

                _formation?.RestoreSessionData(session.formation);
                _world?.RestoreSessionData(session.world);
                _camps?.RestoreSessionData(session.camps);
                _quests?.RestoreSessionData(session.quests);
                EventRaised?.Invoke("Yerel kayıt yüklendi. Aktif savaş güvenli hazırlık aşamasından devam eder.");
            }
            catch (Exception exception)
            {
                Debug.LogWarning($"Prototype session could not be restored: {exception.Message}");
                saveService.Current.prototypeSessionJson = string.Empty;
                EventRaised?.Invoke("Kayıt oturumu okunamadı; yeni prototip oturumu başlatıldı.");
            }
        }

        private void FindControllers()
        {
            if (_formation == null) _formation = FindFirstObjectByType<FormationPrototypeController>();
            if (_world == null) _world = FindFirstObjectByType<PrototypeWorldController>();
            if (_camps == null) _camps = FindFirstObjectByType<PrototypeCampController>();
            if (_quests == null) _quests = FindFirstObjectByType<PrototypeQuestController>();
        }
    }
}
