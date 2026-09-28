# Sürüm ve GitHub Releases / Versioning and GitHub Releases

## Türkçe

Her tamamlanan iş bir sürüm alır: `vMAJOR.MINOR.PATCH`. Yama/hata düzeltmesi için `patch`, yeni özellik için `minor`, uyumsuz değişiklik için `major` seçin. Sürümü iş tamamlanınca, commit'ten önce ilerletin:

```bash
npm run release:version -- patch --tr "Türkçe değişiklik notu" --en "English change note"
```

Birden fazla değişiklik için `--tr` ve `--en` seçeneklerini tekrarlayabilirsiniz. Her iki dil zorunludur. Önce sonucu görmek için aynı komuta `--dry-run` ekleyin. Araç `package.json`, `package-lock.json`, `releases.json`, `CHANGELOG.md` ve README'deki güncel sürümü birlikte günceller. Oyun içindeki sürüm geçmişi `releases.json` dosyasını okur. `npm version` tek başına bu kayıtları tamamlamaz.

Sonra doğrulama ve teslim dosyalarını oluşturun:

```bash
npm run verify
npm run format:check
npm run count:lines
npm run backup
```

`docs/WEB-VALIDATION.md` içindeki sonuçları güncelleyin; temiz ZIP'i belge değişikliklerinden sonra üretin. README, sürüm ve değişiklikleri commit'e dahil edin. `main` dalına birleşme veya doğrudan push, [Web checks, containers and release](../.github/workflows/web-ci.yml) akışını çalıştırır. Pull request kontrolü de sürümün hedef `main` sürümünden büyük olduğunu doğrular.

Yayın sırası:

1. Kaynak/çeviri/sürüm kontrolleri, biçim, birim/API ve tarayıcı testleri; üretim ve görsel önizleme derlemesi.
2. Docker imajı, dört Dokploy servisi, sağlık, giriş ve analiz kontrolleri.
3. Aynı CI koşusunun ZIP, SHA-256 ve `preview/index.html` dosyalarını indirme; ZIP sağlama toplamını doğrulama.
4. Test edilen commit'e açıklamalı `vX.Y.Z` etiketi ekleme ve yalnızca bu sürümün CHANGELOG TR/EN bölümüyle GitHub Release yayımlama.

Başarısız kontroller sürüm yayımlamaz. Pull request veya `master` dalı Release oluşturmaz. Yayın işi yalnızca `contents: write` izni ve GitHub'ın geçici `GITHUB_TOKEN` değerini kullanır; kişisel erişim anahtarı gerekmez. Mevcut etiket başka commit'e işaret ediyorsa iş hata verir ve etiketi taşımaz. Aynı commit'in yayımlanmış sürümü tekrar çalıştırmada değiştirilmez; yarım kalan taslak yayın tamamlanabilir.

Yayın aşamasındaki geçici hatadan sonra aynı koşuda **Re-run failed jobs** kullanılabilir. Baştan doğrulamak için Actions'ta **Run workflow** seçin ve `main` dalını kullanın. Elle çalıştırma da kontrolleri tamamlamadan yayımlamaz. Yeni kod commit'i için yeni sürüm gerekir; yeniden çalıştırma sürümü ilerletmez.

Güncel sürüm [README](../README.md), oyun içi geçmiş ve [GitHub Releases](https://github.com/emindemirciai/Bozkurt-Obasi/releases/latest) bölümünde görünür. Depo özel olduğu için sürüm ve indirmelere erişim GitHub depo izinlerine bağlıdır. Release yayımlanması Dokploy dağıtımının başarılı olduğunu kanıtlamaz; Dokploy kendi `main` push tetikleyicisi ve ortam ayarlarını kullanır.

## English

Each completed update receives `vMAJOR.MINOR.PATCH`: `patch` for fixes, `minor` for features, `major` for breaking changes. Advance the version after finishing the work and before committing:

```bash
npm run release:version -- patch --tr "Türkçe değişiklik notu" --en "English change note"
```

Repeat `--tr` and `--en` for multiple changes. Both languages are required; add `--dry-run` to preview the update. The tool updates `package.json`, `package-lock.json`, `releases.json`, `CHANGELOG.md`, and current version references in README together. The in-game history reads `releases.json`. Using `npm version` alone does not complete these records.

Run `npm run verify`, `npm run format:check`, `npm run count:lines` and `npm run backup`. Update `docs/WEB-VALIDATION.md`, then produce the final clean ZIP after documentation changes. Commit the code, version and notes together.

A merge or push to `main` runs [Web checks, containers and release](../.github/workflows/web-ci.yml). PR checks require a version newer than the target `main` version. After source, formatting, unit/API, browser, build and four-service Docker checks pass, the release job downloads artifacts from that same run and verifies the ZIP checksum. It creates an annotated `vX.Y.Z` tag at the tested commit and publishes the exact version's TR/EN CHANGELOG section with the source ZIP, SHA-256 file and visual `index.html`.

Failed checks do not publish. PRs and `master` do not publish. Only the release job receives `contents: write`, using GitHub's temporary `GITHUB_TOKEN`; no personal token is required. A tag pointing elsewhere fails instead of moving. Rerunning an already published version at the same commit leaves it unchanged; an interrupted draft can be completed.

Use **Re-run failed jobs** for a transient release-stage failure. Use **Run workflow** on `main` to repeat all checks and publishing. Manual runs still require successful checks. New code commits require a newer version; rerunning does not advance the version.

The current version appears in [README](../README.md), the in-game history and [GitHub Releases](https://github.com/emindemirciai/Bozkurt-Obasi/releases/latest). This private repository requires repository access to view releases or download assets. A published Release does not confirm a successful Dokploy deployment; Dokploy has its own `main` push trigger and environment settings.

GitHub references: [workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions), [release creation and assets](https://cli.github.com/manual/gh_release_create), [artifacts between jobs](https://docs.github.com/en/actions/tutorials/store-and-share-data).
