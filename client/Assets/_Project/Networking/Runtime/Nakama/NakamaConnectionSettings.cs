using UnityEngine;

namespace Bozkurt.Networking
{
    public static class NakamaConnectionSettings
    {
        private const string SchemeKey = "bozkurt.nakama.scheme";
        private const string HostKey = "bozkurt.nakama.host";
        private const string PortKey = "bozkurt.nakama.port";
        private const string ServerKeyKey = "bozkurt.nakama.server_key";

        public static string Scheme => PlayerPrefs.GetString(SchemeKey, "http");
        public static string Host => PlayerPrefs.GetString(HostKey, "127.0.0.1");
        public static int Port => PlayerPrefs.GetInt(PortKey, 7350);
        public static string ServerKey => PlayerPrefs.GetString(ServerKeyKey, "defaultkey");
        public static string Address => $"{Scheme}://{Host}:{Port}";

        public static void Save(string scheme, string host, int port, string serverKey)
        {
            PlayerPrefs.SetString(SchemeKey, string.IsNullOrWhiteSpace(scheme) ? "http" : scheme.Trim());
            PlayerPrefs.SetString(HostKey, string.IsNullOrWhiteSpace(host) ? "127.0.0.1" : host.Trim());
            PlayerPrefs.SetInt(PortKey, Mathf.Clamp(port, 1, 65535));
            PlayerPrefs.SetString(ServerKeyKey, string.IsNullOrWhiteSpace(serverKey) ? "defaultkey" : serverKey.Trim());
            PlayerPrefs.Save();
        }
    }
}
