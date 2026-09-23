# HOTFIX-01 — Unity Input System assembly reference

## Düzeltilen hata

`PrototypeSelectionController.cs` dosyası `UnityEngine.InputSystem` ad alanını kullanıyordu; ancak bu dosyanın derlendiği `Bozkurt.Gameplay` assembly tanımı `Unity.InputSystem` assembly'sine doğrudan referans vermiyordu.

## Uygulanan düzeltme

`client/Assets/_Project/Gameplay/Bozkurt.Gameplay.asmdef` dosyasına aşağıdaki assembly referansı eklendi:

```text
Unity.InputSystem
```

Unity assembly definition bağımlılıkları geçişli olmadığından, `Bozkurt.Gameplay` assembly'sinin `Bozkurt.Input` üzerinden dolaylı referansı yeterli değildir.
