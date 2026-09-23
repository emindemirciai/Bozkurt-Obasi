# Tek komutluk yerel build araçları

PowerShell'i depo kökünde açın:

```powershell
.\tools\build\build-web.ps1
.\tools\build\serve-web.ps1
.\tools\build\build-android-apk.ps1
.\tools\build\build-android-aab.ps1
```

Unity farklı klasördeyse `-UnityPath` parametresi verin. APK test içindir. AAB için mağaza imzalama anahtarı Unity Player Settings içinde ayrıca tanımlanmalıdır; keystore GitHub'a konulmamalıdır.
