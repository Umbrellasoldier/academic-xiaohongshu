import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MathInlineView } from "./math-inline-view";

export interface MathInlineOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathInline: {
      /**
       * Insert an inline math expression
       */
      setMathInline: (latex: string) => ReturnType;
    };
  }
}

export const MathInline = Node.create<MathInlineOptions>({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex") || element.textContent,
        renderHTML: (attributes) => ({
          "data-latex": attributes.latex,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="math-inline"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "math-inline",
        class: "math-inline",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },

  addCommands() {
    return {
      setMathInline:
        (latex: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex },
          });
        },
    };
  },

  // Input rule: typing $...$ converts to inline math
  addInputRules() {
    return [
      new InputRule({
        // Match $...$ but not $$
        find: /(?:^|[^$])\$([^$]+)\$$/,
        handler: ({ state, range, match }) => {
          const latex = match[1];
          if (!latex) return;

          // Adjust range to not include the leading char before $
          const from = match[0].startsWith("$") ? range.from : range.from + 1;
          const { tr } = state;

          tr.replaceWith(from, range.to, this.type.create({ latex }));
        },
      }),
    ];
  },
});
