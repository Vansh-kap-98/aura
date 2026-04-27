import { useEffect, useMemo, useState } from "react";
import { BubbleMenu, EditorContent, JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { SlashCommand, SlashRange } from "@/lib/tiptap/slash-command";

type CommandItem = {
  id: string;
  label: string;
  description: string;
  run: () => void;
};

type SubmitPayload = {
  html: string;
  json: JSONContent;
  text: string;
};

type ChatInputEditorProps = {
  valueHtml: string;
  placeholder?: string;
  onChangeHtml: (html: string) => void;
  onSubmit: (payload: SubmitPayload) => void | Promise<void>;
  onRegisterSubmit?: (submit: () => void) => void;
  className?: string;
};

export const ChatInputEditor = ({
  valueHtml,
  placeholder = "Type a message...",
  onChangeHtml,
  onSubmit,
  onRegisterSubmit,
  className,
}: ChatInputEditorProps) => {
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashRange, setSlashRange] = useState<SlashRange | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder,
        emptyNodeClass: "is-editor-empty",
      }),
      SlashCommand.configure({
        onOpen: ({ query, range }) => {
          setSlashOpen(true);
          setSlashQuery(query);
          setSlashRange(range);
          setSlashIndex(0);
        },
        onQueryChange: ({ query, range }) => {
          setSlashOpen(true);
          setSlashQuery(query);
          setSlashRange(range);
          setSlashIndex(0);
        },
        onClose: () => {
          setSlashOpen(false);
          setSlashQuery("");
          setSlashRange(null);
          setSlashIndex(0);
        },
        onNavigate: (direction) => {
          setSlashIndex((prev) => {
            const next = direction === "down" ? prev + 1 : prev - 1;
            return next;
          });
        },
        onSelect: () => {
          // Handled below using selected command and clamped index.
        },
      }),
    ],
    content: valueHtml || "",
    editorProps: {
      attributes: {
        class:
          "max-h-56 min-h-[3rem] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border/60 bg-background/30 px-3 py-2 text-sm outline-none focus:border-primary/50",
      },
      handleKeyDown: (_view, event) => {
        if (slashOpen && event.key === "Enter") {
          event.preventDefault();
          return true;
        }

        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          const html = editor?.getHTML() ?? "";
          const json = editor?.getJSON() ?? { type: "doc", content: [] };
          const text = editor?.getText().trim() ?? "";
          if (!text) return true;
          void onSubmit({ html, json, text });
          editor?.commands.clearContent();
          onChangeHtml("");
          setSlashOpen(false);
          setSlashQuery("");
          setSlashRange(null);
          setSlashIndex(0);
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChangeHtml(nextEditor.getHTML());
    },
  });

  const commandItems = useMemo<CommandItem[]>(() => {
    if (!editor) return [];

    return [
      {
        id: "paragraph",
        label: "Paragraph",
        description: "Start writing plain text",
        run: () => editor.chain().focus().setParagraph().run(),
      },
      {
        id: "h1",
        label: "Heading 1",
        description: "Large section heading",
        run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        id: "h2",
        label: "Heading 2",
        description: "Medium section heading",
        run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        id: "h3",
        label: "Heading 3",
        description: "Small section heading",
        run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        id: "bullet",
        label: "Bullet list",
        description: "Create an unordered list",
        run: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        id: "ordered",
        label: "Numbered list",
        description: "Create an ordered list",
        run: () => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        id: "code",
        label: "Code block",
        description: "Insert a code block",
        run: () => editor.chain().focus().toggleCodeBlock().run(),
      },
      {
        id: "image-placeholder",
        label: "Media placeholder",
        description: "Insert a media placeholder block",
        run: () => editor.chain().focus().insertContent("[media]").run(),
      },
    ];
  }, [editor]);

  const filteredCommands = useMemo(() => {
    const query = slashQuery.trim().toLowerCase();
    if (!query) return commandItems;
    return commandItems.filter(
      (command) =>
        command.label.toLowerCase().includes(query) ||
        command.description.toLowerCase().includes(query)
    );
  }, [commandItems, slashQuery]);

  const activeSlashIndex = useMemo(() => {
    if (filteredCommands.length === 0) return 0;
    const normalized = slashIndex % filteredCommands.length;
    return normalized < 0 ? filteredCommands.length + normalized : normalized;
  }, [filteredCommands.length, slashIndex]);

  const submitNow = () => {
    if (!editor) return;
    const html = editor.getHTML();
    const json = editor.getJSON();
    const text = editor.getText().trim();
    if (!text) return;
    void onSubmit({ html, json, text });
    editor.commands.clearContent();
    onChangeHtml("");
    setSlashOpen(false);
    setSlashQuery("");
    setSlashRange(null);
    setSlashIndex(0);
  };

  useEffect(() => {
    onRegisterSubmit?.(submitNow);
  }, [onRegisterSubmit, submitNow]);

  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (valueHtml === currentHtml) return;
    editor.commands.setContent(valueHtml || "", false);
  }, [editor, valueHtml]);

  const slashCoordinates = useMemo(() => {
    if (!editor || !slashRange || !slashOpen) return null;
    try {
      const coords = editor.view.coordsAtPos(slashRange.from);
      return {
        left: coords.left,
        top: coords.bottom + 8,
      };
    } catch {
      return null;
    }
  }, [editor, slashOpen, slashRange]);

  const executeSlashCommand = (item: CommandItem | undefined) => {
    if (!editor || !item || !slashRange) return;

    editor
      .chain()
      .focus()
      .deleteRange({ from: slashRange.from, to: slashRange.to })
      .run();
    item.run();

    setSlashOpen(false);
    setSlashQuery("");
    setSlashRange(null);
    setSlashIndex(0);
  };

  useEffect(() => {
    if (!slashOpen || !editor) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashIndex((prev) => prev + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashIndex((prev) => prev - 1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        executeSlashCommand(filteredCommands[activeSlashIndex]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setSlashOpen(false);
        setSlashQuery("");
        setSlashRange(null);
        setSlashIndex(0);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slashOpen, filteredCommands, activeSlashIndex, editor]);

  if (!editor) return null;

  return (
    <div className={cn("relative", className)}>
      <EditorContent editor={editor} />

      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 120, placement: "top" }}
        shouldShow={({ editor: nextEditor }) => !nextEditor.state.selection.empty}
      >
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="border-border/70 bg-card/85 flex items-center gap-1 rounded-xl border px-2 py-1.5 shadow-lg backdrop-blur-md"
        >
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-semibold",
              editor.isActive("bold") ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            B
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              "rounded-md px-2 py-1 text-xs italic",
              editor.isActive("italic") ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            I
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={cn(
              "rounded-md px-2 py-1 text-xs line-through",
              editor.isActive("strike") ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            S
          </button>
          <button
            onClick={() => {
              const url = window.prompt("Enter URL");
              if (!url) return;
              editor.chain().focus().setLink({ href: url }).run();
            }}
            className={cn(
              "rounded-md px-2 py-1 text-xs",
              editor.isActive("link") ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            Link
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={cn(
              "rounded-md px-2 py-1 font-mono text-xs",
              editor.isActive("code") ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            {'</>'}
          </button>
        </motion.div>
      </BubbleMenu>

      <AnimatePresence>
        {slashOpen && slashCoordinates && filteredCommands.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            style={{ left: slashCoordinates.left, top: slashCoordinates.top }}
            className="border-border/70 bg-card/90 fixed z-[70] w-72 rounded-xl border p-1.5 shadow-xl backdrop-blur-md"
          >
            <div className="max-h-56 overflow-y-auto">
              {filteredCommands.map((command, index) => (
                <button
                  key={command.id}
                  onClick={() => executeSlashCommand(command)}
                  className={cn(
                    "flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition-colors",
                    index === activeSlashIndex ? "bg-primary/15" : "hover:bg-muted/70"
                  )}
                >
                  <span className="text-sm font-medium">{command.label}</span>
                  <span className="text-muted-foreground text-xs">{command.description}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
