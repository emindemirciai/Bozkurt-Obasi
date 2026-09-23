# WP-04 Hotfix 01

`FormationPrototypeController.ChooseAnimalType` içindeki iki switch expression düzeltildi.

Hatalı biçim:

```csharp
slot % 3 switch
```

Düzeltilen biçim:

```csharp
(slot % 3) switch
```

Bu değişiklik CS0019 derleme hatasını giderir.
