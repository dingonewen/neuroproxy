# Workflow UI review

`src/workflow.css` defines the shared scale for intermediate and saved states. Keep new review and editing controls aligned with it instead of giving each state a separate size. Dashboard proportions remain in `src/style.css`.

## Shared scale

- Body and entered text: `0.8rem`, regular weight.
- Field labels and secondary explanations: `0.75rem`.
- Small action buttons: `0.72rem`, with the same border, shadow, and press behavior.
- Section headings: `1.1rem`; category headings: `0.9rem`.
- Action rows: right-aligned, wrapping with an `8px` gap.
- Long context fields: reuse `ExpandingInsightInput`; message editors resize vertically.

## Check the full journey

Use synthetic conversation data and a consenting test contact. AI analysis and generation on the full app use the configured provider; sending requires separate approval. The public preview has no AI output and cannot exercise these states.

- [ ] Initial analysis: review heading, topic, people, tasks, questions, relationship lists, and message draft.
- [ ] Edit a long task or question: all text is visible, and the card remains inside its panel.
- [ ] Review actions: Save and Discard share the compact action scale.
- [ ] Saved context: select a node, Revisit, edit, Save or Cancel.
- [ ] Delegation: select a person and action, Generate, edit, Create.
- [ ] Pending draft: Revisit, Save or Discard; open Add Contact and check its form.
- [ ] Send review: consent checkbox and approval button, loading and error text.
- [ ] Reply analysis: editable insight cards, Save Reviewed Analysis, Suggested Reply and Draft.
- [ ] Unlinked reply: candidate selection and confirmation.
- [ ] Mobile: buttons wrap and fields stay within the panel.

The build and TypeScript checks do not replace a browser review of these states.
