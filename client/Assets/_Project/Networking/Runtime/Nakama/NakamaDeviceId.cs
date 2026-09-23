using System;
using UnityEngine;

namespace Bozkurt.Networking
{
    public static class NakamaDeviceId
    {
        private const string DeviceIdKey = "bozkurt.nakama.device_id";

        public static string GetOrCreate()
        {
            var existing = PlayerPrefs.GetString(DeviceIdKey, string.Empty);
            if (!string.IsNullOrWhiteSpace(existing))
            {
                return existing;
            }

#if UNITY_WEBGL && !UNITY_EDITOR
            var deviceId = Guid.NewGuid().ToString("N");
#else
            var deviceId = SystemInfo.deviceUniqueIdentifier;
            if (string.IsNullOrWhiteSpace(deviceId) || deviceId == SystemInfo.unsupportedIdentifier)
            {
                deviceId = Guid.NewGuid().ToString("N");
            }
#endif
            PlayerPrefs.SetString(DeviceIdKey, deviceId);
            PlayerPrefs.Save();
            return deviceId;
        }
    }
}
