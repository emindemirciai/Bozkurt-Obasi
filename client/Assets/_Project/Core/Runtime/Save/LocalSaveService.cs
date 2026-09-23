using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace Bozkurt.Core.Save
{
    public sealed class LocalSaveService : ISaveService
    {
        private readonly string _savePath;
        private readonly string _backupPath;
        private readonly string _temporaryPath;

        public SaveData Current { get; private set; }

        public LocalSaveService(string saveDirectory = null)
        {
            var directory = string.IsNullOrWhiteSpace(saveDirectory)
                ? Application.persistentDataPath
                : saveDirectory;

            Directory.CreateDirectory(directory);
            _savePath = Path.Combine(directory, GameConstants.SaveFileName);
            _backupPath = Path.Combine(directory, GameConstants.BackupSaveFileName);
            _temporaryPath = _savePath + ".tmp";
        }

        public async Task<SaveData> LoadOrCreateAsync(CancellationToken cancellationToken = default)
        {
            Current = await TryLoadAsync(_savePath, cancellationToken)
                ?? await TryLoadAsync(_backupPath, cancellationToken)
                ?? SaveData.CreateNew();

            var upgraded = SaveDataMigration.UpgradeToCurrent(Current);
            if (!File.Exists(_savePath) || upgraded)
            {
                await SaveAsync(Current, cancellationToken);
            }

            return Current;
        }

        public async Task SaveAsync(SaveData saveData, CancellationToken cancellationToken = default)
        {
            if (saveData == null)
            {
                throw new ArgumentNullException(nameof(saveData));
            }

            cancellationToken.ThrowIfCancellationRequested();
            SaveDataMigration.UpgradeToCurrent(saveData);
            saveData.version = GameConstants.CurrentSaveVersion;
            saveData.saveRevision = Math.Max(0, saveData.saveRevision) + 1;
            saveData.lastPlatform = Application.platform.ToString();
            saveData.updatedAtUnix = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var json = JsonUtility.ToJson(saveData, true);
            File.WriteAllText(_temporaryPath, json, Encoding.UTF8);

            ValidateJson(File.ReadAllText(_temporaryPath, Encoding.UTF8));

            if (File.Exists(_savePath))
            {
                File.Copy(_savePath, _backupPath, true);
                File.Delete(_savePath);
            }

            File.Move(_temporaryPath, _savePath);
            Current = saveData;
            await Task.CompletedTask;
        }

        private static async Task<SaveData> TryLoadAsync(string path, CancellationToken cancellationToken)
        {
            if (!File.Exists(path))
            {
                return null;
            }

            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                var json = File.ReadAllText(path, Encoding.UTF8);
                await Task.CompletedTask;
                return ValidateJson(json);
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or InvalidDataException)
            {
                Debug.LogWarning($"Save file could not be read: {path}\n{exception.Message}");
                return null;
            }
        }

        private static SaveData ValidateJson(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                throw new InvalidDataException("Save content is empty.");
            }

            var data = JsonUtility.FromJson<SaveData>(json);
            if (data == null || data.version <= 0 || string.IsNullOrWhiteSpace(data.playerId))
            {
                throw new InvalidDataException("Save content is invalid.");
            }

            return data;
        }
    }
}
