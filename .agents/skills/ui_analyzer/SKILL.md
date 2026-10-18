---
name: ui-analyzer
description: Guidelines and instructions for analyzing and optimizing React Native UI layouts, visual aesthetics, typography, safe areas, keyboard compatibility, and dark/light mode rendering.
---

# UI Analyzer Skill Guidelines

Use this skill when you need to audit, debug, or refine mobile screen layouts, stylesheets, and styling systems in React Native / Expo applications.

## 1. Structural Auditing & Layouts

- **Safe Area Management**: Always verify that the top of screens accounts for status bars / notches (`useSafeAreaInsets` or `<SafeAreaView>`) and bottom tabs or home indicators.
- **Flexbox Flow**: Avoid hardcoded widths or heights for container elements. Use `flex: 1` or percentage-based widths so components stretch naturally across different device screens.
- **Touch Target Targets**: Ensure all touchable elements (buttons, pressable links, checkboxes) have a minimum interactive size of 44x44 pt. Use transparent padding or hit-boxes (e.g. `hitSlop`) if the visual element is smaller.
- **Scrollable Containers**: Any page or card form that contains inputs or detailed lists should be wrapped in a `<ScrollView>` or `<FlatList>` with `keyboardShouldPersistTaps="handled"`.

## 2. Keyboard & Input Handling

- **Keyboard Shifting**: Wrap modal contents or screen sheets in a `<KeyboardAvoidingView>` using `behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}` (or `'height'`).
- **Resizing Controls**: Ensure parent elements have flexible heights (e.g., `maxHeight` caps rather than hardcoded `height`) so that when the soft keyboard is active, the container resizes and lets the user scroll to the focused field.
- **Text Input Padding**: Add adequate vertical and horizontal padding to all `<TextInput>` elements so text does not touch borders.

## 3. Premium Visual Aesthetics

- **Color Palettes**: Utilize curated semantic variables from the theme provider rather than raw hex values (e.g., use `colors.surfaceSecondary` or `colors.borderMuted`).
- **Gradients & Glowing Highlights**: Incorporate subtle linear gradients, low-opacity fills, and colorful glowing borders to distinguish active selection cards.
- **Card Shadows & Borders**:
  - In light mode: use very soft shadow colors with high blur (e.g. `rgba(0, 0, 0, 0.04)` or translucent primary tint).
  - In dark mode: use thin translucent borders (`colors.border` or `rgba(255,255,255,0.08)`) instead of heavy shadows, which are invisible against dark backgrounds.
- **Micro-Animations**: Add layout animations (`LayoutAnimation.configureNext`) before updating interactive states (toggles, accordions, tooltips, tab changes) to transition elements smoothly.

## 4. Analysis Workflow

When analyzing a screen's UI code:
1. **Analyze imports and dependencies**: Check safe area providers, svg packages, animation libraries.
2. **Review the layout tree**: Trace from parent container down to buttons and inputs.
3. **Inspect StyleSheet rules**: Check for hardcoded sizes, border styling, contrast ratios, and font weight matches.
4. **Identify friction points**: Look for overlapping elements, lack of scrollability, or missing keyboard safety.
5. **Recommend refinements**: Propose structured style refactorings to align with premium design best practices.
