# 🎮 Vanishing Badges Heuristics Simulator

The **Vanishing Badges Simulator** is an interactive testbed and visualization tool implementing the adaptive gamification heuristics and mathematical definitions from the research paper (*Vanishing Badges: Adaptive Gamification for Crowdsourced Citizen Science*).

It allows researchers, administrators, and developers to observe how individual participation, community interest decay, and period motivation trigger badge fading in real-time.

---

## 🚀 Launch Options

* <a href="vanishing_badges_simulator.html" target="_blank" class="docsify-external-link" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background-color: #4f46e5; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 12px;">Launch Fullscreen Simulator in New Tab ↗</a>
* Or explore the fully functional interactive sandbox embedded directly below:

---

## 🕹️ Interactive Simulator Sandbox

<iframe src="./vanishing_badges_simulator.html" style="width: 100%; height: 860px; border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,0.35); background-color: #090d16;" allowfullscreen></iframe>

---

## 📐 Implemented Theoretical Model

The simulator faithfully replicates the mathematical definitions and procedural pipeline from **§3 & §4** of the reference paper:

### 1. Mathematical Indicators (§3)

* **Definition 3.1: Estimated Contributions at Award Time ($ET_b$) & Eligible Players ($ep(b)$)**:
  * Identifies the set of participants $ep(b)$ who have satisfied all prerequisite badges in the Directed Acyclic Graph (DAG) but have not yet earned badge $b$.
  * Calculates average historical effort $ET_b$ across earned users (or structural topological fallback).

* **Definition 3.2: Individual Interest Indicator ($i_3(p, b)$)**:
  $$i_3(p, b) = \begin{cases} \frac{1}{t_p - t_0(p, b)} & \text{if } p \in ep(b) \\ 1.0 & \text{if } p \notin ep(b) \end{cases}$$
  * Tracks recency and abandonment. As elapsed days $\Delta t = \text{now} - t_0$ increase without completing badge $b$, $i_3(p, b) \to 0$.

* **Definition 3.3: Community Interest Indicator ($CII(b)$)**:
  $$CII(b) = \text{median}\left( \{ i_3(p, b) : p \in ep(b) \} \right)$$
  * Measures collective abandonment across all eligible players. Low $CII(b)$ ranks badges neglected by the community.

* **Definition 3.4 & 3.5: Player Motivation ($PMI$), Relative Motivation ($relPMI$) & Community Motivation ($CMI$)**:
  $$PMI(p) = |\{ s \in S : cnum(p, s) \ge cnum(p, \text{prev}(s)) \text{ and } [cnum(p, s) + cnum(p, \text{prev}(s))] \ne 0 \}|$$
  $$relPMI(p) = \frac{PMI(p)}{\text{avg}(PMI)}$$
  $$CMI = \text{median}\left( \{ relPMI(p) : p \in P \} \right)$$
  * Evaluates community-wide momentum across sliding engagement periods.

---

### 2. Adaptation Heuristic Pipeline (§4)

1. **Step 1 — Period Trigger Check**: At the conclusion of each engagement window $s$, the engine computes $CMI$. If $CMI < \text{threshold}$ (default: $0.75$), an adaptation cycle is triggered.
2. **Step 2 — Badge Candidate Selection**: Ranks badges by Community Interest $CII(b)$ ascending. Selects the candidate badge with lowest non-zero interest among eligible unearned badges.
3. **Step 3 — Fading Transition**: Transitions the selected badge status to `faded`, initiating a countdown window ($\Delta T_{\text{fade}}$) with an explicit `expiresAt` deadline.
4. **Step 4 — Community Window & Permanent Retention**: During the fading countdown, community members can prioritize missions to earn the badge permanently before expiration.
