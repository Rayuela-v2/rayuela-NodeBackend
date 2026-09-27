# 🎮 Vanishing Badges Indicators Simulator

The **Vanishing Badges Simulator** is an interactive testbed and visualization tool implementing the adaptive gamification indicators and mathematical definitions from the research paper (*Vanishing Badges Game Adaptation — D. Torres & M. Dalponte Ayastuy, September 18, 2026 Revision*).

It allows researchers, administrators, and developers to simulate check-in interactions across a cohort of players and evaluate how individual interest decay ($i_3$), achievable sets ($AB(p)$), ignored badge sets ($ignored\_by(p)$), and community interest ($CII(b)$) behave over time.

---

## 🚀 Launch Options

* <a href="vanishing_badges_simulator.html" target="_blank" class="docsify-external-link" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background-color: #4f46e5; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 12px;">Launch Fullscreen Simulator in New Tab ↗</a>
* Or explore the interactive sandbox embedded directly below:

---

## 🕹️ Interactive Simulator Sandbox

<iframe src="./vanishing_badges_simulator.html" style="width: 100%; height: 860px; border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,0.35); background-color: #090d16;" allowfullscreen></iframe>

---

## 📐 Implemented Theoretical Model (Sept 18, 2026 Revision)

The simulator replicates the formal mathematical definitions from **§3 & §4** of the latest specification:

### 1. Mathematical Indicators (§3)

* **Definition 3.1: Achievable Badges ($AB(p)$)**:
  $$AB(p) = \{\, b \in \text{Badges} \mid \forall prev \in \text{prerequisites}(b),\, prev \in B_p \,\}$$
  * A badge is achievable to player $p$ when all prerequisite badges have been earned ($B_p$ denotes the set of badges earned by player $p$). Root badges without prerequisites are achievable upon joining.

* **Definition 3.2: Individual Interest Indicator ($i_3(p, b)$)**:
  $$i_3(p, b) = \begin{cases} \dfrac{1}{\text{now} - t_0(p, b)} & : b \in AB(p) \\[6pt] 1 & : b \notin AB(p) \end{cases}$$
  * Inverse of elapsed time since $t_0(p, b)$ (the timestamp when prerequisites for badge $b$ were met by player $p$). As time passes without completing badge $b$, $i_3(p, b) \to 0$.

* **Definition 3.3: Ignored Badges ($ignored\_by(p)$)**:
  $$ignored\_by(p) = \{\, b \in AB(p) \setminus B_p \mid i_3(p, b) < x \,\}$$
  * Subset of achievable, unearned badges for player $p$ whose individual interest has fallen below reference threshold $x$.

* **Definition 3.4: Community Interest Indicator ($CII(b)$)**:
  $$CII(b) = \operatorname{median}\left( \{\, i_3(p, b) \mid p \in ep(b) \,\} \right) \quad \text{where } ep(b) = \{\, p \in P \mid b \in AB(p) \setminus B_p \,\}$$
  * Median of individual interest $i_3(p, b)$ across all players currently eligible for badge $b$.

---

### 2. Trigger & Candidate Filtering Criteria (§4)

1. **Section 4.1 — Trigger Condition**:
   $$\text{Trigger Adaptation} \iff \exists b \in \text{Candidates} : CII(b) < x$$
   * Evaluates whether any candidate badge is ignored by the community (community interest falls below reference value $x$).
2. **Section 4.2.1 — Candidate Badge Filtering (Listing 2)**:
   $$\text{filtered\_badges} = \text{badges} - \text{all\_player\_badges} - \text{ur\_badges}$$
   * Excludes badges already earned by everyone in the community ($\text{all\_player\_badges}$) and badges unattainable by anyone because prerequisites have not yet been met ($\text{ur\_badges}$).
3. **Section 4.2.2 — Candidate Sorting (Listing 3)**:
   * Ranks candidate badges in ascending order of $CII(b)$ to identify the most neglected badges in the dependency graph.
