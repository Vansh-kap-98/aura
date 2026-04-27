import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

export type SlashRange = {
  from: number;
  to: number;
};

type SlashState = {
  open: boolean;
  query: string;
  range: SlashRange | null;
};

type SlashContext = {
  query: string;
  range: SlashRange;
};

export interface SlashCommandOptions {
  onOpen: (ctx: SlashContext) => void;
  onQueryChange: (ctx: SlashContext) => void;
  onClose: () => void;
  onNavigate: (direction: "up" | "down") => void;
  onSelect: () => void;
}

const initialState: SlashState = {
  open: false,
  query: "",
  range: null,
};

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

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
    let slashState: SlashState = { ...initialState };

    const closeSlashMenu = () => {
      if (!slashState.open) return;
      slashState = { ...initialState };
      this.options.onClose();
    };

    return [
      new Plugin({
        props: {
          handleTextInput: (view, from, to, text) => {
            const { state } = view;
            const parentOffset = state.selection.$from.parentOffset;

            if (text === "/" && parentOffset === 0) {
              slashState = {
                open: true,
                query: "",
                range: { from, to: from + 1 },
              };
              this.options.onOpen({ query: "", range: slashState.range });
              return false;
            }

            if (!slashState.open || !slashState.range) return false;

            if (/\s/.test(text)) {
              closeSlashMenu();
              return false;
            }

            slashState = {
              ...slashState,
              query: `${slashState.query}${text}`,
              range: {
                from: slashState.range.from,
                to: slashState.range.to + text.length,
              },
            };
            this.options.onQueryChange({
              query: slashState.query,
              range: slashState.range,
            });

            return false;
          },

          handleKeyDown: (_view, event) => {
            if (!slashState.open) return false;

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
              closeSlashMenu();
              return true;
            }

            if (event.key === "Backspace") {
              if (slashState.query.length === 0) {
                closeSlashMenu();
                return false;
              }

              slashState = {
                ...slashState,
                query: slashState.query.slice(0, -1),
                range: slashState.range
                  ? {
                      from: slashState.range.from,
                      to: Math.max(slashState.range.from + 1, slashState.range.to - 1),
                    }
                  : null,
              };

              if (slashState.range) {
                this.options.onQueryChange({
                  query: slashState.query,
                  range: slashState.range,
                });
              }
            }

            return false;
          },
        },

        view: () => ({
          update: (view) => {
            if (!slashState.open || !slashState.range) return;
            const cursorPos = view.state.selection.from;
            if (cursorPos < slashState.range.from || cursorPos > slashState.range.to + 1) {
              closeSlashMenu();
            }
          },
          destroy: () => {
            closeSlashMenu();
          },
        }),
      }),
    ];
  },
});
