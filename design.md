# ETS Dashboard Design Brief

## Purpose
This document defines the design direction for the ETS Employee Dashboard and acts as the authoritative brief for any AI agent or developer continuing improvements. It captures the live critique from the current dashboard and translates it into an implementation-ready, page-by-page redesign plan.

This is a design specification, not a code patch. It should be treated as the source of truth for UX, hierarchy, storytelling, light/dark themes, and enterprise polish.

---

## Design Goals

### Primary outcome
The product should tell the operational story in under 5 seconds for an executive audience while remaining useful for detailed operational review.

### Success criteria
- Strong visual hierarchy from top to bottom
- Executive readability within the first screen
- Clear story arc: overview -> comparison -> drill-down
- Reduction in cognitive load
- Consistent naming and spacing across all pages
- Clean light and dark theme support
- Enterprise polish suitable for leadership presentation

---

## Global review findings

### Executive review
- The dashboard has strong domain relevance and business usefulness.
- The overall narrative is present but not front-loaded enough.
- The first view should emphasize the key operational insight before the user scans details.
- Too much information competes for attention at the top of the page.

### Power BI / Fabric review
- The dashboard structure follows analytical thinking, which is positive.
- However, the hierarchy is not yet at a presentation-grade level.
- Important insights need stronger visual weight and clearer framing.
- Labels and titles should read like business narrative rather than raw metadata.

### UX review
- Navigation is understandable and functional.
- The app is still visually dense and crowded.
- Spacing and rhythm need stronger discipline.
- Typography should establish clear content hierarchy.
- The user should be guided through the page in a consistent scan pattern.

### QA / polish review
- The product feels internally built rather than fully polished.
- Naming consistency is a visible problem.
- Some empty states and labels feel unfinished.
- The app needs stronger enterprise polish and cleaner page framing.

### Scorecard summary
- Visual Hierarchy: 6/10
- Storytelling: 6/10
- Executive Readability: 5.5/10
- Enterprise Polish: 5/10
- Accessibility: 6/10
- Scanability: 5.5/10
- Cognitive Load: 5/10

Overall: 5.7/10

---

## Theme system

### Light theme
Purpose: executive review, board presentation, daytime use, broad readability.

Design tokens:
- Background: #F7F9FC
- Surface: #FFFFFF
- Surface Elevated: #F3F6FA
- Border: #E5E7EB
- Text Primary: #0F172A
- Text Secondary: #475569
- Text Muted: #64748B
- Accent Blue: #2563EB
- Accent Cyan: #06B6D4
- Accent Green: #10B981
- Accent Amber: #F59E0B
- Accent Red: #EF4444
- Success: #34D399
- Warning: #FBBF24
- Danger: #F87171

Rules:
- Use very light neutral backgrounds with subtle blue/cyan accents.
- Maintain strong contrast for KPI numbers and labels.
- Use borders and shadows sparingly to avoid visual clutter.
- Prefer one primary accent color per page and allow secondary accent only for comparisons.

### Dark theme
Purpose: analytical deep-dive, night use, focused data review.

Design tokens:
- Background: #0B1220
- Surface: #111827
- Surface Elevated: #162033
- Border: #233247
- Text Primary: #E5EEF9
- Text Secondary: #B7C4D8
- Text Muted: #8EA0BA
- Accent Blue: #60A5FA
- Accent Cyan: #22D3EE
- Accent Green: #34D399
- Accent Amber: #FBBF24
- Accent Red: #F87171

Rules:
- Keep the background dark and layered, not flat black.
- Ensure chart gridlines are subtle and low contrast.
- Use emphasis through spacing and color contrast, not through excessive glow.
- Preserve the same top-level hierarchy as the light theme.

### Shared rules for both themes
- One strong visual hierarchy for the page
- One dominant KPI area per screen
- Consistent alignment and grid spacing
- Consistent card elevation rules
- Same semantic meaning for green / amber / red
- Same page scan path in both themes

---

## Page-by-page design brief

## 1) Home / Executive Dashboard

### Role
Primary landing page; executive summary and operational signal page.

### User need
Answer: “What is the current workforce story?” in under 5 seconds.

### Current issues
- Too much content competes before the primary story appears.
- KPI cards are visible but not sufficiently prioritized.
- Visual story is not front-loaded.
- Business language needs stronger narrative framing.

### Desired structure
1. Top hero headline summary
   - Example: Workforce health summary
   - Example: Headcount, diversity, and utilization story
2. Dominant KPI cluster (3-5 cards)
   - Total employees
   - Diversity ratio
   - Workforce mix
   - Attrition / retention indicator
3. Insight callout bar
   - One sentence summarizing the business story
4. Secondary analytics cards
   - Regional state story
   - Department mix
   - Talent distribution
5. Deep-dive section as needed

### Design rules
- The page should begin with one headline insight, not a collection of tiles.
- KPI cards must have clear hierarchy by size and weight.
- Use less than 5 primary KPI tiles on the first screen.
- Reduce card density and allow each card to breathe.
- Keep labels business-facing and concise.

### Priority fixes
- Align the top board-level summary above the grid
- Make the first insight visually dominant
- Reduce the noisy card stack after hero region
- Rename subtitles into clearer business framing

---

## 2) Statewise Dashboard

### Role
Regional operating performance review.

### User need
Understand where the workforce is concentrated and how regions compare.

### Current issues
- Dense region data can overwhelm the user
- Comparative story is present but not highlighted strongly enough
- It reads more like a data report than a story summary

### Desired structure
1. Region summary header
2. Top performing / at-risk region callout
3. Comparison chart or ranked view
4. Secondary distribution detail cards
5. Drill-down from region to employee or team view

### Design rules
- Use a primary comparison lens and a secondary detail lens
- Put the most important region first in ranking or by selected focus
- Distinguish strong vs weak regions with explicit comparative color encoding
- Secondary rows should be secondary in weight

### Priority fixes
- Add explicit “highest” and “lowest” region callout blocks
- Clean up dense comparison areas
- Use stronger visual contrast for the key region comparison

---

## 3) Tech Wise Dashboard

### Role
Technical capability and skills inventory view.

### User need
Understand the capability landscape and key skill concentration areas.

### Current issues
- Skill inventory can become visually noisy
- Metric density is high without a strong primary story
- There is not enough emphasis on the key capability signal

### Desired structure
1. Skill landscape overview
2. Most common / most concentrated skills
3. Skill distribution and category comparison
4. Secondary detail list or inventory breakdown

### Design rules
- Put the top capability insights in a hero section
- Keep skill categories with a consistent visual color pattern
- Use a stronger lead metric at the top of the page
- Reduce tabular clutter in the deep inventory view

### Priority fixes
- Add a clear top-skill callout
- Reduce visual competition from dense skill tiles
- Use stronger labeling for capability clusters

---

## 4) Salary Wise Dashboard

### Role
Compensation overview and cost analysis.

### User need
Review payroll spend, salary distribution, and compensation structure.

### Current issues
- Tends to feel tabular and dense
- The relative story is not obvious enough
- Too much equal-weight content on the first screen

### Desired structure
1. Payroll summary headline
2. Total base salary / total CTC / average values in priority order
3. Salary distribution comparison card
4. Secondary detail ranges and exception view
5. Drill-down by department or level as needed

### Design rules
- Lead with the hardest business number first
- Reduce visual noise from repeated table-like blocks
- Use comparative callouts and delta indicators
- Keep high-salary outliers visually distinct but not dominating the page

### Priority fixes
- Hero metrics for salary cost summary
- Strong comparison framing between base and CTC
- Cleaner card rhythm for distribution panels

---

## 5) Salary 2 Wise Dashboard

### Role
Compensation trend and movement analysis.

### User need
Understand how compensation differs by team and changes over time.

### Current issues
- The comparison layer is useful but visually crowded
- Not enough emphasis on the key salary movement message
- Some charts compete without a clear focus lens

### Desired structure
1. Trend summary at the top
2. Base vs CTC comparison lens
3. Team or segment performance comparison
4. Secondary trend details and exceptions

### Design rules
- One central comparison should dominate the view
- Use clear delta labels and trend direction
- Keep team comparison data consistent and readable
- Avoid stacking too many charts in one panel

### Priority fixes
- Create a single primary comparison story
- Simplify chart density
- Add clearer trend callouts for major movement

---

## 6) Employee Calendar

### Role
Leave and utilization tracking page.

### User need
See leave patterns, utilization pressure, and employee time-off distribution.

### Current issues
- Heavy calendar layout can feel visually compressed
- The story is more operational than leadership-oriented
- Signal generation could be stronger

### Desired structure
1. Leave utilization summary panel
2. Key workforce absence highlights
3. Calendar or grid view with reduced noise
4. Details panel for selected dates or employee view

### Design rules
- Prioritize utilization overview above raw calendar detail
- Use strong but subtle status colors for different leave states
- Keep the grid readable and not overly saturated
- The user should understand the operational issue before reading detail cells

### Priority fixes
- Put leave utilization summary before the dense grid
- Reduce clutter in the calendar view
- Simplify color semantics so users scan faster

---

## 7) Employee Details

### Role
Employee profile, performance, compensation, and skill detail page.

### User need
Understand a single employee in context quickly without drowning in metadata.

### Current issues
- Too much metadata is presented without a clean hierarchy
- The page reads like a profile dump more than a decision-support view
- There is significant cognitive load on a detailed person page

### Desired structure
1. Profile hero section
   - photo / initials
   - name
   - role / grade / location
   - primary quick metrics
2. Summary metric strip
   - reporting manager
   - tenure
   - experience
   - project / state
3. Skills / capabilities section
4. Compensation progression section
5. Financial detail table or drill-down data section

### Design rules
- Lead with a profile summary and anchor identity
- Separate essential metadata from secondary information
- Use accordions or collapsible detail blocks for lower-priority content
- Reduce visual clutter in the financial breakdown section
- Don’t let the table overshadow the story

### Priority fixes
- Reframe the page as a profile-first summary, not a data dump
- Reduce the amount of raw metadata on the first fold
- Use spacing and grouping to create a clean summary-to-detail flow

---

## Naming and terminology standards

### Naming fix recommendations
The product should adopt a consistent naming system to feel enterprise-grade.

Preferred naming examples:
- Workforce Overview
- State Performance
- Skills & Capability
- Compensation Analytics
- Compensation Trends
- Leave & Attendance
- Employee Profile

Avoid:
- Tech Wise
- Salary 2 Wise
- ETS Employee Dashboard
- awkward mixed naming styles

Consistency principle:
- Use the same naming pattern across all tabs, headers, and section titles.
- Titles should sound executive-ready and repeatable across the experience.

---

## Interaction model standards

### General interaction guidance
- Users should be able to scan a page in 3 steps:
  1. What is the key message?
  2. What is the evidence?
  3. What is the detail?
- The action model should support faster drill-down rather than overloaded screens.
- Use filter chips and control surfaces consistently.
- Keep tables secondary unless the user is intentionally drilling into detail.

### Hover and selection
- Use subtle elevation rather than heavy emphasis
- Use active states that are visually clear but not noisy
- Avoid large hover animations that distract from the insight

---

## Accessibility and readability rules

- Preserve strong contrast in both light and dark themes
- Avoid low-contrast gray text for important labels
- Ensure readable chart axes and legends
- Keep text hierarchy consistent across all pages
- Do not rely on color alone for meaning; add labels and patterns
- Increase spacing around dense metric groups
- Avoid too many text blocks stacked without separation

---

## Implementation checklist for the next AI agent

When continuing this work, follow this order:

1. Fix the page narrative hierarchy first
2. Fix naming inconsistency
3. Fix spacing and density across all pages
4. Add light and dark theme support
5. Improve KPI emphasis and callout cards
6. Simplify tables and reduce raw metadata overload
7. Add stronger visual separators between summary and detail sections
8. Review all pages for consistency of tone, color, and labeling

---

## Final recommendation
The product already has a solid analytical foundation. The opportunity is not to reinvent the dashboard—it is to refine it into an enterprise-grade story-driven experience.

The best path is:
- keep the data richness,
- reduce the visual noise,
- increase the narrative emphasis,
- and unify the product language across all pages.

This will raise the experience from “functional internal dashboard” to “executive-ready enterprise analytics product.”
