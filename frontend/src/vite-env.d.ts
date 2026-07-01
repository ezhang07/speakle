/// <reference types="vite/client" />

// `resizeMode` (used in Record.tsx's getUserMedia constraints) is a valid
// MediaTrackConstraint, but the browser typings TypeScript ships don't include
// it yet. This "declaration merging" adds it to the built-in interface so the
// constraint stays type-checked instead of being cast away.
interface MediaTrackConstraintSet {
  resizeMode?: ConstrainDOMString;
}
