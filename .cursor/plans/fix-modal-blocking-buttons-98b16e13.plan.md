<!-- 98b16e13-bc83-40ec-af30-0fb0d63e946d ed693089-8cc1-4ee8-804d-63b8f28bd97d -->
# Fix Modal Backdrop Blocking Button Clicks

## Problem

The modal backdrop (`#confirm-modal`) is blocking clicks on buttons like "Apply structure" even when it should be hidden. The backdrop has `hidden="true"` in the HTML but remains visible and intercepts mouse events.

## Root Cause

1. CSS doesn't explicitly handle the `hidden` attribute - only uses `.visible` class for opacity
2. The backdrop has `position: fixed; inset: 0; z-index: 10` which covers the entire viewport
3. Even with `opacity: 0`, the element can still intercept pointer events if not properly hidden

## Solution

### File: `ui/page3.html`

Add CSS rule to ensure `hidden` attribute properly hides the modal:

```css
.modal-backdrop[hidden] {
  display: none !important;
  pointer-events: none;
}
```

Also ensure when hidden, the backdrop doesn't block events:

```css
.modal-backdrop:not(.visible) {
  pointer-events: none;
}
```

This ensures:

- When `hidden` attribute is present, element is completely removed from layout and interaction
- When visible but transitioning (opacity 0), pointer events are disabled
- Only when `.visible` class is present and element is not hidden, it can receive clicks

### Verification

After fix:

- Modal backdrop should not block buttons when hidden
- Modal should still appear/disappear smoothly when opened/closed
- Click events should reach buttons underneath when modal is closed

## Implementation Details

The CSS changes will be added around line 312 in the `.modal-backdrop` rule section, ensuring the hidden state is properly respected and doesn't interfere with page interactions.

### To-dos

- [ ] Add CSS rule for .modal-backdrop[hidden] to ensure display: none and pointer-events: none
- [ ] Add CSS rule to disable pointer-events when modal is not visible (not .visible class)
- [ ] Verify modal state management in JavaScript ensures proper hidden attribute handling