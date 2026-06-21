# Gamification & Badges Architecture

Rayuela incorporates a pluggable, adaptive gamification engine designed to reward user contributions through points, badges, and leaderboards.

This page explains how the gamification entities are structured in the database, how badge prerequisite DAGs work, and provides an interactive concept map.

---

## 🗺️ Interactive Concepts & Badge Map

Below is an interactive explorer that visualizes Rayuela's gamification architecture. 
* **Concepts Tab**: Explores relationships between Projects, Users, Tasks, and Gamification engines.
* **Prerequisite DAG Tab**: Explores the Directed Acyclic Graph (DAG) for badge requirements.
* *Click nodes to slide open detail cards showing database attributes and source code references.*

<iframe src="./badge-mindmap.html" style="width: 100%; height: 750px; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); background-color: #0b0f19;" allowfullscreen></iframe>

---

## 🧬 Core Database Schemas

### 1. Gamification Configuration (`GamificationTemplate`)
Configured per **Project** (connected via `projectId`), the gamification configuration defines what points and badges are active.
* **File Reference**: `src/module/gamification/persistence/gamification.schema.ts`

```typescript
export class BadgeTemplate {
  _id: string;
  projectId: string;
  name: string;
  description: string;
  imageUrl: string;
  checkinsAmount: number;     // Checkin quantity trigger threshold
  mustContribute: boolean;     // Must resolve a Task (not just check coordinates)
  previousBadges: string[];    // Prerequisite badge dependencies (DAG)
  taskType: string;            // Filter by task type (e.g. photo, audio, text)
  areaId: string;              // Filter by Area ID boundary
  timeIntervalId: string;      // Filter by TimeInterval schedule
}
```

### 2. User Game Profile (`GameProfile`)
Tracks the individual user's score and earned badges in the context of a single project.
* **File Reference**: `src/module/auth/users/user.entity.ts`

```typescript
export interface GameProfile {
  projectId: string;
  points: number;
  badges: string[]; // List of earned badge names
  active: boolean;  // Project subscription state
}
```

---

## 🏆 Pluggable Gamification Engines

Rayuela uses a strategy pattern to calculate rewards and standing layouts:

| Engine Type | Strategy Interface | Default Implementation | Responsibility |
| :--- | :--- | :--- | :--- |
| **Badge Engine** | `BadgeEngine` | `BasicBadgeEngine` | Evaluates if a new check-in unlocks any Badge Rules. |
| **Points Engine** | `PointsEngine` | `PointsEngine` | Calculates score rewards based on active point multipliers. |
| **Leaderboard Engine** | `LeaderboardEngine` | `BasicLeaderboardEngine` | Rebuilds user standings (Points-first or Badges-first). |

### Rules Validation Sequence
During a user check-in, `BasicBadgeEngine` evaluates matching badge rules. A rule matches if and only if:
1. **Prerequisites Check**: The user already possesses all badges in `previousBadges`.
2. **Task Type Match**: The check-in matches the rule's `taskType` filter.
3. **Time Slot Match**: The check-in timestamp satisfies the rule's `timeIntervalId` schedule.
4. **Geo-fence Match**: The coordinates lie within the polygon bound to `areaId`.
5. **Contribution Match**: If `mustContribute` is true, the check-in must resolve an active `Task` (`contributesTo` is populated).
