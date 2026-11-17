import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, utility, styles, overlay] = await Promise.all([
  readFile(new URL("../required-componets-design/App.tsx", import.meta.url), "utf8"),
  readFile(new URL("../required-componets-design/UtilityApps.tsx", import.meta.url), "utf8"),
  readFile(new URL("../required-componets-design/index.css", import.meta.url), "utf8"),
  readFile(new URL("../src/dashboard-tsx/LoadingOverlay.tsx", import.meta.url), "utf8"),
]);

test("mail workspace has no split mode toggles and uses one draggable divider", () => {
  assert.doesNotMatch(app, /No split|Horizontal|Vertical|previewMode|previewLayout/);
  assert.match(app, /role="separator"/);
  assert.match(app, /aria-orientation="vertical"/);
  assert.match(app, /onPointerDown={startMailSplitResize}/);
  assert.match(app, /onPointerMove={moveMailSplitResize}/);
  assert.match(app, /setMailSplitPercent\(Math\.max\(28,Math\.min\(72,/);
  assert.match(app, /onClick={\(\)=>\{ void openMessage\(email\.id,false\); \}\}/);
  assert.match(app, /onDoubleClick={\(\)=>\{ void openMessage\(email\.id,true\); \}\}/);
  assert.doesNotMatch(app, /target="_blank"/);
});

test("all utility routes are full-width same-tab workspaces", () => {
  assert.match(utility, /lm-utility-workspace flex h-dvh min-h-0 w-full flex-col/);
  assert.match(utility, /<main className="min-h-0 w-full flex-1/);
  assert.doesNotMatch(utility, /max-w-6xl|max-w-2xl|target="_blank"/);
});

test("tab navigation keeps the global loading veil until the destination has painted", () => {
  assert.match(app, /const \[navigationLoading, setNavigationLoading\] = useState\(false\)/);
  assert.match(app, /loadingOverlayActive = .*navigationLoading/);
  assert.match(app, /requestAnimationFrame\(\(\) => \{[\s\S]*requestAnimationFrame\(\(\) => setNavigationLoading\(false\)\)/);
  assert.match(app, /navigateToView\(next\)/);
  assert.match(overlay, /fixed inset-0 z-\[120\]/);
  assert.match(overlay, /backdrop-blur-md/);
  assert.match(overlay, /bg-black\/25/);
  assert.match(overlay, /onClick={onDismiss}/);
});

test("desktop mail split fills the available viewport and has a narrow-screen fallback", () => {
  assert.match(styles, /\.lm-mail-workspace\{display:grid;[\s\S]*height:calc\(100dvh - 132px\)/);
  assert.match(styles, /\.lm-mail-resize-handle\{[\s\S]*cursor:col-resize/);
  assert.match(styles, /@media\(max-width:1023px\)\{\.lm-mail-workspace\{display:flex/);
});
