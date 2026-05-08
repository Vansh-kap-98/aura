import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

export type MentionRange = {
  from: number;
  to: number;
};

type MentionState = {
  open: boolean;
  query: string;
  range: MentionRange | null;
};

type MentionContext = {
  query: string;
  range: MentionRange;
};

export interface MentionCommandOptions {
  onOpen: (ctx: MentionContext) => void;
  onQueryChange: (ctx: MentionContext) => void;
  onClose: () => void;
  onNavigate: (direction: "up" | "down") => void;
  onSelect: () => void;
}

const initialState: MentionState = {
  open: false,
  query: "",
  range: null,
};

export const MentionCommand = Extension.create<MentionCommandOptions>({
  name: "mentionCommand",

  addOptions() {
    return {
      onOpen: () => undefined,
      onQueryChange: () => undefined,
      onClose: () => undefined,
      onNavigate: () => undefined,
      onSelect: () => undefined,
    };
  },

  addProseMirrorPlugins() {
    let mentionState: MentionState = { ...initialState };

    const closeMentionMenu = () => {
      if (!mentionState.open) return;
      mentionState = { ...initialState };
      this.options.onClose();
    };

    return [
      new Plugin({
        props: {
          handleTextInput: (view, from, to, text) => {
            if (text === "@") {
              mentionState = {
                open: true,
                query: "",
                range: { from, to: from + 1 },
              };
              this.options.onOpen({ query: "", range: mentionState.range });
              return false;
            }

            if (!mentionState.open || !mentionState.range) return false;

            if (/\s/.test(text)) {
              closeMentionMenu();
              return false;
            }

            mentionState = {
              ...mentionState,
              query: `${mentionState.query}${text}`,
              range: {
                from: mentionState.range.from,
                to: mentionState.range.to + text.length,
              },
            };
            this.options.onQueryChange({
              query: mentionState.query,
              range: mentionState.range,
            });

            return false;
          },

          handleKeyDown: (_view, event) => {
            if (!mentionState.open) return false;

            if (event.key === "ArrowDown") {
              event.preventDefault();
              this.options.onNavigate("down");
              return true;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              this.options.onNavigate("up");
              return true;
            }

            if (event.key === "Enter") {
              event.preventDefault();
              this.options.onSelect();
              return true;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              closeMentionMenu();
              return true;
            }

            if (event.key === "Backspace") {
              if (mentionState.query.length === 0) {
                closeMentionMenu();
                return false;
              }

              mentionState = {
                ...mentionState,
                query: mentionState.query.slice(0, -1),
                range: mentionState.range
                  ? {
                      from: mentionState.range.from,
                      to: Math.max(mentionState.range.from + 1, mentionState.range.to - 1),
                    }
                  : null,
              };

              if (mentionState.range) {
                this.options.onQueryChange({
                  query: mentionState.query,
                  range: mentionState.range,
                });
              }
            }

            return false;
          },
        },

        view: () => ({
          update: (view) => {
            if (!mentionState.open || !mentionState.range) return;
            const cursorPos = view.state.selection.from;
            if (cursorPos < mentionState.range.from || cursorPos > mentionState.range.to + 1) {
              closeMentionMenu();
            }
          },
          destroy: () => {
            closeMentionMenu();
          },
        }),
      }),
    ];
  },
});
