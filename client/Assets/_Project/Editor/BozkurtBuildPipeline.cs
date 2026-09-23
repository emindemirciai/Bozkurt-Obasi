#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using Bozkurt.Core;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Bozkurt.Editor
{
    public static class BozkurtBuildPipeline
    {
        private const string ApplicationIdentifier = "com.emindemirci.bozkurtobasi";
        private const string Version = "0.10.0";
        private const int AndroidVersionCode = 10;

        [MenuItem("Bozkurt/Build/WebGL Release")]
        public static void BuildWebGlFromMenu() => BuildWebGl(true);

        [MenuItem("Bozkurt/Build/Android Test APK")]
        public static void BuildAndroidApkFromMenu() => BuildAndroid(false, true);

        [MenuItem("Bozkurt/Build/Android Play AAB")]
        public static void BuildAndroidAabFromMenu() => BuildAndroid(true, true);

        [MenuItem("Bozkurt/Build/Windows Test")]
        public static void BuildWindowsFromMenu() => BuildWindows(true);

        public static void BuildWebGlCommandLine() => BuildWebGl(false);
        public static void BuildAndroidApkCommandLine() => BuildAndroid(false, false);
        public static void BuildAndroidAabCommandLine() => BuildAndroid(true, false);
        public static void BuildWindowsCommandLine() => BuildWindows(false);

        public static void ConfigurePlayerSettingsForAllTargets()
        {
            PlayerSettings.companyName = "Emin Demirci Games";
            PlayerSettings.productName = GameConstants.ProductName;
            PlayerSettings.bundleVersion = Version;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, ApplicationIdentifier);
            PlayerSettings.Android.bundleVersionCode = AndroidVersionCode;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);

            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Brotli;
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.WebGL.debugSymbolMode = WebGLDebugSymbolMode.Off;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.None;
            PlayerSettings.WebGL.wasm2023 = true;
            PlayerSettings.WebGL.maximumMemorySize = 1024;
        }

        private static void BuildWebGl(bool reveal)
        {
            ConfigurePlayerSettingsForAllTargets();
            var output = GetOutputDirectory("WebGL");
            var report = Build(BuildTarget.WebGL, output, BuildOptions.CleanBuildCache);
            Finish(report, output, reveal);
        }

        private static void BuildAndroid(bool appBundle, bool reveal)
        {
            ConfigurePlayerSettingsForAllTargets();
            EditorUserBuildSettings.buildAppBundle = appBundle;
            var filename = appBundle ? "Bozkurt-Obasi.aab" : "Bozkurt-Obasi-Test.apk";
            var output = Path.Combine(GetOutputDirectory("Android"), filename);
            var report = Build(BuildTarget.Android, output, BuildOptions.CleanBuildCache);
            Finish(report, output, reveal);
        }

        private static void BuildWindows(bool reveal)
        {
            ConfigurePlayerSettingsForAllTargets();
            var output = Path.Combine(GetOutputDirectory("Windows"), "Bozkurt-Obasi.exe");
            var report = Build(BuildTarget.StandaloneWindows64, output, BuildOptions.None);
            Finish(report, output, reveal);
        }

        private static BuildReport Build(BuildTarget target, string outputPath, BuildOptions options)
        {
            var scenes = EditorBuildSettings.scenes
                .Where(scene => scene.enabled)
                .Select(scene => scene.path)
                .ToArray();
            if (scenes.Length == 0)
            {
                throw new InvalidOperationException("No enabled build scenes were found.");
            }

            var directory = Path.HasExtension(outputPath)
                ? Path.GetDirectoryName(outputPath)
                : outputPath;
            if (!string.IsNullOrWhiteSpace(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = outputPath,
                target = target,
                options = options
            });
            WriteManifest(report, target, outputPath);
            return report;
        }

        private static string GetOutputDirectory(string platform)
        {
            var repositoryRoot = Directory.GetParent(Application.dataPath)?.Parent?.FullName
                ?? throw new DirectoryNotFoundException("Repository root could not be resolved.");
            return Path.Combine(repositoryRoot, "Builds", platform);
        }

        private static void WriteManifest(BuildReport report, BuildTarget target, string outputPath)
        {
            var directory = Path.HasExtension(outputPath)
                ? Path.GetDirectoryName(outputPath)
                : outputPath;
            if (string.IsNullOrWhiteSpace(directory))
            {
                return;
            }

            Directory.CreateDirectory(directory);
            var manifest = new BuildManifest
            {
                product = GameConstants.ProductName,
                version = Version,
                unityVersion = Application.unityVersion,
                target = target.ToString(),
                result = report.summary.result.ToString(),
                totalSizeBytes = report.summary.totalSize.ToString(),
                errors = report.summary.totalErrors,
                warnings = report.summary.totalWarnings,
                finishedAtUtc = DateTime.UtcNow.ToString("O")
            };
            File.WriteAllText(
                Path.Combine(directory, "build-manifest.json"),
                JsonUtility.ToJson(manifest, true));
        }

        private static void Finish(BuildReport report, string outputPath, bool reveal)
        {
            if (report.summary.result != BuildResult.Succeeded)
            {
                throw new BuildFailedException(
                    $"Build failed: {report.summary.totalErrors} errors, {report.summary.totalWarnings} warnings.");
            }

            Debug.Log($"Build succeeded: {outputPath} ({report.summary.totalSize} bytes)");
            if (reveal)
            {
                EditorUtility.RevealInFinder(outputPath);
            }
        }

        [Serializable]
        private sealed class BuildManifest
        {
            public string product;
            public string version;
            public string unityVersion;
            public string target;
            public string result;
            public string totalSizeBytes;
            public int errors;
            public int warnings;
            public string finishedAtUtc;
        }
    }
}
#endif
