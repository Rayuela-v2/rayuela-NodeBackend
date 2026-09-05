# Adaptive Gamification: Badge Fading

Badge Fading is an adaptive gamification mechanism in Rayuela designed to dynamically react to volunteer engagement and project activity levels. When volunteer participation drops in a project or a time window begins to lapse, badges enter a temporary "fading" phase before expiring completely, providing a time-bounded incentive for the community to contribute.

---

## 1. Conceptual Model & Lifecycle

### What is Badge Fading?
Instead of immediately revoking or abruptly expiring badges, the platform transitions badges into a **Fading** state with an explicit expiration timestamp (`expiresAt`). During this fading period:
* **Community Incentive**: Volunteers can still complete missions and earn the badge before the countdown reaches zero.
* **Permanent Ownership**: When an individual volunteer earns a fading badge, it is awarded **permanently** (`earned: true` / retained forever).
* **Project-Level Rule Persistence**: A user earning the badge does **not** reset the badge rule status back to `active` for the rest of the project. The badge rule remains fading for the community until `expiresAt` elapses or until an administrator manually restores it.

```mermaid
stateDiagram-v2
    [*] --> Active: Badge created in project
    Active --> Fading: Inactivity window starts (expiresAt set)
    Fading --> Active: Admin restores badge via PATCH active
    Fading --> Expired: Window closes (expiresAt passed)
    Expired --> [*]: Unearnable for new users

    note right of Fading
        While Fading (before expiresAt):
        Volunteers can still earn the badge
        Completing missions awards it permanently
        Earned badges are kept forever
    end note
```

### Availability Computation
In the domain model (`lib/features/dashboard/domain/entities/project_detail.dart`), badge availability is deterministically evaluated using `availabilityAt(DateTime now)`:

| Status Attribute | Temporal Condition | Computed Availability | UI & Notification Behavior |
| :--- | :--- | :--- | :--- |
| `active` | Default state | `active` | Standard badge display; no warnings or countdowns. |
| `faded` | `expiresAt > now` | `fading` | Amber warning hourglass icon, active countdown ("X days left", "Y hours left"), popup alerts, and scheduled OS alarms. |
| `faded` / `expired` | `expiresAt <= now` | `expired` | Disabled/greyed-out badge; historical expiration notification; window permanently closed. |

> [!TIP]
> **Interactive Simulation Sandbox**:
> Want to see how badge fading rules, interest indicators ($i_3, CII$), and motivation scores ($PMI, CMI$) behave dynamically with simulated volunteer contributions? Try the [Vanishing Badges Simulator](adaptive-gamification/simulator.md) or <a href="vanishing_badges_simulator.html" target="_blank">open the simulator in fullscreen ↗</a>.

---

## 2. System Architecture

Rayuela implements an **offline-first, zero-server-queue** notification and alert system. The backend simply exposes the gamification state on project resources; the mobile client deterministically derives events, schedules local OS reminders, and updates reactive state.

```mermaid
flowchart TD
    subgraph DataSync["Data & Synchronization Layer"]
        API["Remote API (NestJS)"] -->|fetchProjectDetail| Rep["ProjectsRepositoryImpl"]
        Rep -->|writeDetailCache| LocalDB["ProjectsLocalSource (SQLite)"]
        Rep -->|onDetailSynced| Hook["Sync Hook Callback"]
    end

    subgraph NotifProc["Notification Processing & Scheduling"]
        Hook --> Recorder["BadgeNotificationRecorder"]
        Hook --> Scheduler["BadgeReminderScheduler"]
        Recorder -->|INSERT OR IGNORE| Dao["NotificationsDao (app_notifications)"]
        Scheduler -->|zonedSchedule| OS["Local Notifications / OS Alarms"]
    end

    subgraph ReactiveState["Reactive State Management"]
        Dao --> RevProv["notificationsRevisionProvider"]
        RevProv --> ListProv["notificationsListProvider"]
        RevProv --> UnreadProv["unreadNotificationsCountProvider"]
        RevProv --> PopupProv["pendingPopupProvider"]
    end

    subgraph UIPresentation["UI Presentation Layer"]
        UnreadProv --> Bell["NotificationBell Widget"]
        ListProv --> NotifScreen["NotificationsScreen"]
        PopupProv --> ProjScreen["ProjectDetailScreen & Popup Dialog"]
    end
```

---

## 3. Implementation Details

### 3.1 Backend REST API & Trigger Mechanisms
Backend administrators or automated gamification decay workers update a badge rule's state by sending a `PATCH` request:

```http
PATCH /v1/gamification/:projectId/badge/:badgeId/status/faded
Content-Type: application/json

{
  "expiresAt": "2026-08-25T16:00:00Z",
  "fadeReason": "Low activity detected during the last month"
}
```

To restore a badge back to normal operation:
```http
PATCH /v1/gamification/:projectId/badge/:badgeId/status/active
```

The response is embedded in the project details payload returned to mobile clients (`GET /v1/projects/:id`).

---

### 3.2 Mobile Persistence Layer (`AppDatabase` & `NotificationsDao`)
A local SQLite table `app_notifications` stores derived notifications:

* **File Reference**: `lib/core/database/database.dart`, `lib/features/notifications/data/notifications_dao.dart`
* **Schema Fields**:
  * `id TEXT PRIMARY KEY`: Deterministic fingerprint format (`$userId|$type|$projectId|$badgeName|$window`).
  * `user_id TEXT`: User isolation key (ensures multi-user separation on a shared device).
  * `type TEXT`: Event type (`badgeFading` or `badgeExpired`).
  * `project_id TEXT`: Associated project identifier.
  * `badge_name TEXT`: Target badge identifier.
  * `expires_at TEXT`: Target deadline in UTC ISO-8601 string format.
  * `fade_reason TEXT`: Contextual reason provided by project administrators.
  * `created_at TEXT`: Local derivation timestamp.
  * `read_at TEXT`: Timestamp when the user opened the Notifications screen.
  * `seen_at TEXT`: Timestamp when the in-app popup dialog was displayed or dismissed.

---

### 3.3 Event Derivation (`BadgeNotificationRecorder`)
* **File Reference**: `lib/features/notifications/domain/badge_notification_recorder.dart`
* On every project detail sync (`onDetailSynced` hook), `BadgeNotificationRecorder` evaluates all badges in the project against the current clock:
  1. **Fading Detection**: When a badge is `faded` with `expiresAt > now`, a `badgeFading` record is generated.
  2. **Expiration Detection**: When a badge has expired (`expiresAt <= now`), a `badgeExpired` record is generated **only if** the user previously received a `badgeFading` notification. This prevents *historical poisoning* (bombarding fresh app installs with years of old expired badge alerts).
  3. **Idempotency**: Records are inserted using `INSERT OR IGNORE`. If new rows are inserted, `notificationsRevisionProvider` is invalidated.

---

### 3.4 Out-of-App OS Reminders (`BadgeReminderScheduler`)
* **File Reference**: `lib/features/notifications/domain/badge_reminder_scheduler.dart`
* Leverages `flutter_local_notifications` to schedule background operating system reminders:
  * **Heads-Up Reminder**: Scheduled for 3 days before `expiresAt`.
  * **Final Call Reminder**: Scheduled for 2 hours before `expiresAt`.
* **Alarm Synchronization**: Existing scheduled alarms for the project are replaced on sync. If a badge is restored to active or expires, obsolete alarms are cancelled.
* **Payload**: Carries JSON payload `{ "projectId": "...", "badgeName": "..." }` to power deep links.

---

### 3.5 Reactive State Management (Riverpod)
* **File Reference**: `lib/features/notifications/presentation/notifications_providers.dart`
* **`notificationsRevisionProvider`**: An integer state counter incremented when DB changes occur.
* **`notificationsListProvider`**: Automatically recalculates the full list of notifications ordered by `created_at DESC`.
* **`unreadNotificationsCountProvider`**: Evaluates the number of notifications where `read_at IS NULL` for the active user.
* **`pendingPopupProvider(projectId)`**: Returns the most recent unseen (`seen_at IS NULL`) fading or expired notification for a specific project.

---

### 3.6 Presentation Views & User Journeys

#### 1. Dashboard Screen (`DashboardScreen`)
* Features the **`NotificationBell`** in the `AppBar` for authenticated users.
* Displays a badge with the unread count from `unreadNotificationsCountProvider`.
* Tapping routes the user to `/notifications`.

#### 2. Notifications Screen (`NotificationsScreen`)
* Displays notification tiles with distinct color themes:
  * **Amber / Warning**: Fading badge with dynamic countdown ("X days left", "Y hours left").
  * **Grey / Neutral**: Expired badge notice.
* **Read-State Latching**: Unread items are marked with `read_at` on screen entry using post-frame callbacks to avoid reactive build loops.
* **Tap Navigation**: Tapping a tile marks it `seen` and pushes `ProjectDetailScreen` with query parameter `?badge=<badgeName>`.

#### 3. Project Detail Screen (`ProjectDetailScreen`)
* **In-App Transition Alert (`showPendingBadgePopup`)**: When entering a project with an unseen fading badge, an `AlertDialog` pops up detailing the expiration countdown and fade reason.
* The popup immediately sets `seen_at` in SQLite so the user is only interrupted once.
* Actions:
  * *"Not now"*: Dismisses dialog.
  * *"See badge"*: Automatically opens the Badge Details bottom sheet.
* **Deep Link Badge Focus**: If navigated via `?badge=<name>`, the screen immediately triggers `_showBadgeDetails()` on first frame.

---

### 3.7 Deep Linking & Cold Launches (`NotificationTapRouter`)
* **File Reference**: `lib/features/notifications/domain/notification_tap_router.dart`
* Handles user interaction with background OS notification alerts:
  1. Catches notification payload upon tap.
  2. If the application is cold-starting, waits for authentication state to be initialized.
  3. Directs `GoRouter` to `/project/:id?badge=:badgeName`.

---

## 4. Sequence Workflows

### 4.1 Project Sync & Local Derivation
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant View as "ProjectDetailScreen / Dashboard"
    participant Repo as "ProjectsRepositoryImpl"
    participant Rec as "BadgeNotificationRecorder"
    participant DAO as "NotificationsDao (SQLite)"
    participant Sched as "BadgeReminderScheduler"
    participant OS as "OS Notification System"

    User->>View: Opens Project (App syncs)
    View->>Repo: getProjectDetail for project
    Repo->>Repo: writeDetailCache to SQLite
    
    par SQLite Cache
        Repo->>DAO: Save project cache
    and Trigger Sync Hook
        Repo->>Rec: record events for project
        Rec->>Rec: derive events from badges
        Rec->>DAO: recordAll (INSERT OR IGNORE)
        DAO-->>Rec: Return count of new rows
        
        opt When new rows inserted
            Rec-->>View: Bump notificationsRevisionProvider
        end
        
        Repo->>Sched: sync reminders for project
        Sched->>OS: Cancel previous alarms for project
        Sched->>OS: Schedule heads-up and final call alarms
    end
```

### 4.2 In-App Dialog Alert Flow
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant PView as "ProjectDetailScreen"
    participant Prov as "pendingPopupProvider"
    participant Pop as "showPendingBadgePopup Dialog"
    participant Ctrl as "NotificationsController"
    participant Sheet as "Badge Details Bottom Sheet"

    User->>PView: Enters Project Screen
    PView->>Prov: watch pendingPopupProvider
    Note over PView,Prov: Sync runs and writes new event then provider updates
    Prov-->>PView: Returns AppNotification for fading badge
    
    PView->>Ctrl: markSeen notification
    PView->>Pop: Display AlertDialog with countdown and reason
    
    alt User taps See badge
        Pop-->>PView: Returns badge name
        PView->>Sheet: Open badge details modal sheet
    else User taps Not now
        Pop-->>PView: Returns null (Dismissed)
    end
```

### 4.3 Cold-Start Background Notification Deep Link
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant OS as "Mobile OS Tray"
    participant Main as "main.dart"
    participant TapRouter as "NotificationTapRouter"
    participant Auth as "AuthController"
    participant Router as "GoRouter"
    participant PView as "ProjectDetailScreen"

    OS->>User: Shows badge fading reminder
    User->>OS: Taps Notification
    OS->>Main: Launches App (Cold Start)
    Main->>TapRouter: bind router on startup
    TapRouter->>TapRouter: launchTarget retrieves payload for badge
    
    Note over TapRouter: Await session initialization
    TapRouter->>Auth: Listen for authenticated state
    Auth-->>TapRouter: Session restored (Authenticated)
    
    TapRouter->>Router: Navigate to project with badge query param
    Router->>PView: Builds ProjectDetailScreen with focusBadge
    PView->>PView: Open badge detail modal on first frame
    PView-->>User: Badge Detail Sheet visible immediately
```

---

## 5. Engineering & Robustness Considerations

1. **Deterministic Deduplication**:
   Composite primary keys (`$userId|$type|$projectId|$badgeName|$window`) combined with `INSERT OR IGNORE` guarantee idempotency regardless of sync frequency.
2. **Historical Poisoning Protection**:
   Newly registered users or clean installations do not receive notifications for badges that expired in the past without having gone through the active fading phase on that client.
3. **Multi-User Isolation**:
   All database queries, unread counters, and in-app notifications are filtered by `user_id`, maintaining user boundaries when multiple accounts switch on the same device.
4. **Reactive Render Safety**:
   Transitions from unread to read status use latched state checks (`_markedRead`) executed inside post-frame callbacks to prevent cyclic UI re-renders in Flutter.

---

## 6. End-to-End Walkthrough & Visual Example

Below is a complete step-by-step walkthrough illustrating the lifecycle of a fading badge from the initial administrator trigger to user discovery, dialog alerts, and deep-linked exploration on mobile.

### Step 1: Administrator Triggers Badge Fading (Backend)
An administrator initiates a fading window by sending a `PATCH` request specifying an expiration deadline (e.g., 5 days in the future) and an explanatory rationale:

```http
PATCH /v1/gamification/6a41715197daf01ca5f165a1/badge/6a4a7e9b59f9a50103a3cda7/status/faded
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "expiresAt": "2026-08-29T00:38:13Z",
  "fadeReason": "Poca actividad en la zona en el último mes"
}
```

The backend updates the gamification rule to `status: "faded"`, recording `expiresAt` and `fadeReason` on the project.

<p align="center">
  <img src="images/badge-fading/screen_dashboard.png" alt="Step 1: Dashboard with active projects" style="max-width: 320px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); border: 1px solid #e2e8f0;" />
  <br>
  <em>Figure 1: Authenticated Dashboard displaying active citizen science projects.</em>
</p>

---

### Step 2: In-App Transition Alert Dialog (Mobile)
When a volunteer opens the project card (e.g., *Test Badge Fading*), the mobile client synchronizes the project details:
* `BadgeNotificationRecorder` creates records in the local SQLite table for fading badges (`Badge A`, `Badge B`).
* `showPendingBadgePopup` intercepts the unseen notification and presents a modal `AlertDialog` with the live countdown and context reason.
* The event is immediately marked `seen_at` so reopening the project does not nag the volunteer again.

<p align="center">
  <img src="images/badge-fading/screen_popup_dialog.png" alt="Step 2: In-App Popup Transition Alert" style="max-width: 320px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); border: 1px solid #e2e8f0;" />
  <br>
  <em>Figure 2: In-App popup alert notifying the volunteer of the fading badge window.</em>
</p>

---

### Step 3: Faded Badge Details & Earning Requirements
Tapping **"Ver insignia"** directly opens the Badge Details modal bottom sheet:
* Displays the amber **¡Se desvanece!** warning chip (*"Todavía podés conseguirla. Después, no."*).
* Summarizes the required missions (e.g., *2 misiones*), zone boundaries (e.g., *Zone B*), and prerequisite badges (e.g., *Badge Wellcome*).

<p align="center">
  <img src="images/badge-fading/screen_badge_detail.png" alt="Step 3: Faded Badge Detail Sheet" style="max-width: 320px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); border: 1px solid #e2e8f0;" />
  <br>
  <em>Figure 3: Badge detail sheet displaying expiration warning and contribution criteria.</em>
</p>

---

### Step 4: Dashboard Notification Bell
Back on the main application dashboard, the `NotificationBell` in the `AppBar` reflects unread items derived from synced projects:
* Reads reactively from `unreadNotificationsCountProvider`.
* Fully accessible for screen readers with localized labels.
* Tapping routes the volunteer to the dedicated Notification Center (`/notifications`).

<p align="center">
  <img src="images/badge-fading/screen_dashboard_bell.png" alt="Step 4: Dashboard Notification Bell" style="max-width: 320px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); border: 1px solid #e2e8f0;" />
  <br>
  <em>Figure 4: AppBar Notification Bell badge indicating unread notifications.</em>
</p>

---

### Step 5: Notification Center Screen (`Novedades`)
The Notification Center aggregates announcements across all subscribed projects for the volunteer:
* **Dynamic Countdown Chip**: Displays computed time remaining (e.g., *Quedan 4 días*) against the local clock.
* **Contextual Rationale**: Displays the administrator's `fadeReason` in italic subtitle.
* **Read-State Latching**: Softly highlights unread items upon entry and marks them `read_at` safely without triggering UI rebuild loops.

<p align="center">
  <img src="images/badge-fading/screen_notifications_center.png" alt="Step 5: Notification Center Screen" style="max-width: 320px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); border: 1px solid #e2e8f0;" />
  <br>
  <em>Figure 5: Notification Center list with dynamic countdown tags and reason details.</em>
</p>

---

### Step 6: Direct Deep-Link Navigation to Badge
Tapping any notification card (e.g., *«Badge A» se está desvaneciendo*) marks the notification as seen and deep-links directly via `GoRouter`:

```dart
context.pushNamed(
  AppRoute.projectDetail,
  pathParameters: {'projectId': '6a41715197daf01ca5f165a1'},
  queryParameters: {'badge': 'Badge A'},
);
```

Upon landing on `ProjectDetailScreen`, the app recognizes the `focusBadge` query parameter and immediately presents the badge modal sheet on the first frame.

<p align="center">
  <img src="images/badge-fading/screen_deeplink_badge_a.png" alt="Step 6: Deep-linked Badge Sheet on arrival" style="max-width: 320px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); border: 1px solid #e2e8f0;" />
  <br>
  <em>Figure 6: Target badge detail sheet displayed automatically upon arrival.</em>
</p>

