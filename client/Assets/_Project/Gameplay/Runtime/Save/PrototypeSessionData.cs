using System;
using System.Collections.Generic;
using Bozkurt.Gameplay.Progression;

namespace Bozkurt.Gameplay.Save
{
    [Serializable]
    public sealed class PrototypeSessionData
    {
        public int schemaVersion = 1;
        public long capturedAtUnix;
        public FormationSessionData formation = new();
        public WorldSessionData world = new();
        public CampSessionData camps = new();
        public QuestSessionData quests = new();
    }

    [Serializable]
    public sealed class FormationSessionData
    {
        public int waveNumber = 1;
        public int crescentMode = 1;
        public int starMode = 1;
        public int jackalTactic;
        public SerializableVector3 starOrigin;
        public SerializableVector3 crescentOrigin;
        public List<WolfSessionData> wolves = new();
        public List<HerdSessionData> herd = new();
    }

    [Serializable]
    public sealed class WolfSessionData
    {
        public WolfProgressionSnapshot progression = new();
        public float normalizedHealth = 1f;
        public bool downed;
    }

    [Serializable]
    public sealed class HerdSessionData
    {
        public int animalType;
        public float normalizedHealth = 1f;
        public bool lost;
        public float panic01;
    }

    [Serializable]
    public sealed class WorldSessionData
    {
        public int water;
        public int feed;
        public int herbs;
        public int wood;
        public int stone;
        public int waterCapacity;
        public int feedCapacity;
        public int herbCapacity;
        public int woodCapacity;
        public int stoneCapacity;
        public int worldDay = 1;
        public float worldHour = 8f;
        public int weatherIndex;
        public int currentWaypointIndex;
        public int selectedWaypointIndex = 1;
        public bool migrating;
        public List<bool> waypointAvailability = new();
    }

    [Serializable]
    public sealed class CampSessionData
    {
        public int selectedBuilding;
        public int fieldCampSequence;
        public List<CampSiteSessionData> sites = new();
    }

    [Serializable]
    public sealed class CampSiteSessionData
    {
        public string name = string.Empty;
        public SerializableVector3 center;
        public bool mainBase;
        public List<int> buildings = new();
    }

    [Serializable]
    public sealed class QuestSessionData
    {
        public int mainDefinitionIndex;
        public int trackedQuestIndex;
        public QuestRuntimeSessionData mainQuest;
        public List<QuestRuntimeSessionData> sideQuests = new();
    }

    [Serializable]
    public sealed class QuestRuntimeSessionData
    {
        public string definitionId = string.Empty;
        public int objectiveIndex;
        public int currentProgress;
        public bool completed;
    }

    [Serializable]
    public struct SerializableVector3
    {
        public float x;
        public float y;
        public float z;

        public SerializableVector3(float xValue, float yValue, float zValue)
        {
            x = xValue;
            y = yValue;
            z = zValue;
        }
    }
}
