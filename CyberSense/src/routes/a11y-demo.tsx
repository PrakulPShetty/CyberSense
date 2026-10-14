import { createFileRoute } from "@tanstack/react-router";

/**
 * CONTROLLED TEST FIXTURE — synthetic, not part of the product UI.
 *
 * This page exists so an accessibility scan can be validated against defects
 * whose exact axe-core rule ids are known in advance. Each defect is annotated
 * with the rule it is expected to trigger. Nothing here is real content, and the
 * defects are intentional.
 *
 * Inline styles are used deliberately: the app's Tailwind theme would otherwise
 * decide the computed colours, and a contrast failure has to be deterministic.
 */
export const Route = createFileRoute("/a11y-demo")({
  head: () => ({ meta: [{ title: "Accessibility test fixture (synthetic) — CyberSense" }] }),
  component: A11yFixture,
});

const shell: React.CSSProperties = {
  background: "#ffffff",
  color: "#111111",
  fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
  fontSize: 16,
  lineHeight: 1.5,
  margin: 0,
  padding: "24px",
  minHeight: "100dvh",
};

const banner: React.CSSProperties = {
  background: "#fff4d6",
  border: "1px solid #8a6d1f",
  color: "#3d2f08",
  padding: "12px 14px",
  borderRadius: 8,
  marginBottom: 20,
  fontSize: 14,
};

const block: React.CSSProperties = {
  border: "1px dashed #b9b9b9",
  borderRadius: 8,
  padding: "12px 14px",
  marginBottom: 14,
};

const hint: React.CSSProperties = { fontSize: 12, color: "#5a5a5a", marginTop: 6, marginBottom: 0 };

function A11yFixture() {
  return (
    <div style={shell} data-a11y-fixture="deliberate-violations">
      <div style={banner} role="note">
        <strong>Synthetic accessibility test fixture.</strong> This page intentionally contains accessibility defects so
        that a scan can be checked against known axe-core rules. It is not part of the CyberSense interface and must not
        be copied into it.
      </div>

      <h1 style={{ margin: "0 0 6px", fontSize: 26 }}>Controlled accessibility fixture</h1>
      <p style={hint}>Expected rule ids are noted beside each defect.</p>

      {/* image-alt: no alt attribute at all. */}
      <div style={block}>
        <p style={{ margin: 0 }}>Logo with no alternative text (expects <code>image-alt</code>):</p>
        <img src="/favicon.svg" width={64} height={64} />
      </div>

      {/* Correct control: a described image must NOT be reported. */}
      <div style={block}>
        <p style={{ margin: 0 }}>Correct control — described image (expected to pass):</p>
        <img src="/favicon.svg" width={32} height={32} alt="CyberSense shield mark" />
      </div>

      {/* color-contrast: ~2.0:1 against white, far below the 4.5:1 minimum. */}
      <div style={block}>
        <p style={{ margin: 0, color: "#b0b0b0", fontSize: 14 }}>
          Low-contrast paragraph at 14px, #b0b0b0 on #ffffff (expects <code>color-contrast</code>).
        </p>
      </div>

      {/* label: a form field with no programmatic label. */}
      <div style={block}>
        <p style={{ margin: "0 0 6px" }}>Unlabelled text field (expects <code>label</code>):</p>
        <input type="email" name="fixture_email" placeholder="you@example.org" style={{ padding: 8, width: 260 }} />
      </div>

      {/* select-name: a select with no accessible name. */}
      <div style={block}>
        <p style={{ margin: "0 0 6px" }}>Unlabelled select (expects <code>select-name</code>):</p>
        <select name="fixture_choice" style={{ padding: 8, width: 260 }}>
          <option>Alpha</option>
          <option>Beta</option>
        </select>
      </div>

      {/* button-name: icon-only button whose only child is aria-hidden. */}
      <div style={block}>
        <p style={{ margin: "0 0 6px" }}>Icon-only button with no accessible name (expects <code>button-name</code>):</p>
        <button type="button" style={{ padding: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 4h16v16H4z" fill="none" stroke="#111" strokeWidth="2" />
          </svg>
        </button>
      </div>

      {/* link-name: an anchor with no text content. */}
      <div style={block}>
        <p style={{ margin: "0 0 6px" }}>Link with no accessible name (expects <code>link-name</code>):</p>
        <a href="/a11y-demo" style={{ display: "inline-block", width: 24, height: 24, background: "#dcdcdc" }} />
      </div>

      {/* aria-roles: not a real ARIA role. */}
      <div style={block}>
        <p style={{ margin: 0 }}>Invalid ARIA role (expects <code>aria-roles</code>):</p>
        <div role="notarealrole">Content inside an invented role.</div>
      </div>

      {/* heading-order: jumps from h1 to h3. */}
      <div style={block}>
        <p style={{ margin: 0 }}>Heading level skipped, h1 → h3 (expects <code>heading-order</code>):</p>
        <h3 style={{ margin: "8px 0 0", fontSize: 18 }}>Subsection that skipped level two</h3>
      </div>

      {/* list: a ul whose direct child is not an li. */}
      <div style={block}>
        <p style={{ margin: "0 0 6px" }}>List with a non-list child (expects <code>list</code>):</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <div>Not a list item</div>
          <li>Proper list item</li>
        </ul>
      </div>

      {/* tabindex: a positive tabindex reorders keyboard focus. */}
      <div style={block}>
        <p style={{ margin: "0 0 6px" }}>Positive tabindex (expects <code>tabindex</code>):</p>
        <button type="button" tabIndex={3} style={{ padding: 8 }}>
          Focused third
        </button>
      </div>

      {/* frame-title: an iframe with no title attribute. */}
      <div style={block}>
        <p style={{ margin: "0 0 6px" }}>Frame with no title (expects <code>frame-title</code>):</p>
        <iframe srcDoc="<p>Framed synthetic content</p>" width={280} height={60} />
      </div>

      {/* region (best-practice): the trailing content sits outside any landmark. */}
      <p style={{ marginTop: 20 }}>End of the synthetic fixture.</p>
    </div>
  );
}
