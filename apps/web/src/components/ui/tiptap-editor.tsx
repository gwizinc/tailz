'use client'

import {
  useEditor,
  EditorContent,
  type Extensions,
  type Content,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { useEffect, useMemo } from 'react'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  Quote,
  Heading1,
  Heading2,
  Heading3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TiptapEditorProps {
  value: string // JSON string (ProseMirror JSON format)
  onChange: (value: string) => void // Returns JSON string
  readOnly?: boolean
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function TiptapEditor({
  value,
  onChange,
  readOnly = false,
  placeholder,
  className,
  autoFocus = false,
}: TiptapEditorProps) {
  const extensions = useMemo<Extensions>(() => {
    const baseExtensions: Extensions = [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
    ]

    // Only add placeholder extension when not read-only and placeholder is provided
    if (!readOnly && placeholder) {
      baseExtensions.push(
        Placeholder.configure({
          placeholder,
        }),
      )
    }

    return baseExtensions
  }, [readOnly, placeholder])

  const editor = useEditor({
    extensions,
    content: (() => {
      if (!value) {
        return ''
      }
      try {
        // Try to parse as JSON (ProseMirror format)
        return JSON.parse(value) as Content
      } catch {
        // Fallback: treat as HTML for backward compatibility
        return value
      }
    })(),
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none min-h-[200px]',
          'prose-headings:font-semibold prose-headings:text-foreground',
          'prose-p:text-foreground prose-p:my-2',
          'prose-ul:text-foreground prose-ul:my-2',
          'prose-ol:text-foreground prose-ol:my-2',
          'prose-li:text-foreground prose-li:my-1',
          'prose-strong:text-foreground prose-strong:font-semibold',
          'prose-code:text-foreground prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
          'prose-pre:text-foreground prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-md',
          'prose-blockquote:text-foreground prose-blockquote:border-l-4 prose-blockquote:border-muted-foreground prose-blockquote:pl-4',
          'prose-a:text-primary prose-a:underline',
        ),
      },
      handleKeyDown: (view, event) => {
        // Prevent Cmd+Enter or Ctrl+Enter from inserting a newline
        // Let the parent component handle the save action
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          return true // Return true to prevent default behavior
        }
        return false // Let other keys work normally
      },
    },
    onUpdate: ({ editor }) => {
      // Save as JSON (ProseMirror format) to preserve all structure and metadata
      const json = editor.getJSON()
      onChange(JSON.stringify(json))
    },
  })

  // Update editor content when value prop changes (e.g., when loading from server)
  useEffect(() => {
    if (!editor) {
      return
    }

    try {
      // Try to parse as JSON first
      const parsedValue = value ? (JSON.parse(value) as Content) : ''
      const currentJson = editor.getJSON()

      // Only update if content actually changed
      if (JSON.stringify(currentJson) !== JSON.stringify(parsedValue)) {
        editor.commands.setContent(parsedValue)
      }
    } catch {
      // Fallback: treat as HTML for backward compatibility
      if (value !== editor.getHTML()) {
        editor.commands.setContent(value || '')
      }
    }
  }, [value, editor])

  // Update editable state when readOnly changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly)
    }
  }, [editor, readOnly])

  // Auto-focus the editor when autoFocus is true
  useEffect(() => {
    if (editor && autoFocus && !readOnly) {
      // Use setTimeout to ensure the editor is fully rendered
      const timeoutId = setTimeout(() => {
        editor.commands.focus()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [editor, autoFocus, readOnly])

  if (!editor) {
    return (
      <div
        className={cn(
          'w-full h-96 rounded-md border border-input bg-white p-4 text-sm text-card-foreground shadow-sm',
          'flex items-center justify-center text-muted-foreground',
          className,
        )}
      >
        Loading editor...
      </div>
    )
  }

  if (readOnly) {
    return (
      <>
        <style>{`
          .tiptap p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: hsl(var(--muted-foreground));
            pointer-events: none;
            height: 0;
          }
        `}</style>
        <div
          className={cn(
            'w-full rounded-md border border-input bg-white p-4 text-sm text-card-foreground shadow-sm overflow-auto',
            className,
          )}
        >
          <EditorContent editor={editor} />
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
      `}</style>
      <div
        className={cn(
          'w-full rounded-md border border-input bg-white shadow-sm flex flex-col',
          className,
        )}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b border-input p-2 flex-wrap shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 1 }) && 'bg-accent',
            )}
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 2 }) && 'bg-accent',
            )}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 3 }) && 'bg-accent',
            )}
          >
            <Heading3 className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bold') && 'bg-accent',
            )}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('italic') && 'bg-accent',
            )}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bulletList') && 'bg-accent',
            )}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('orderedList') && 'bg-accent',
            )}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('code') && 'bg-accent',
            )}
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const url = window.prompt('Enter URL:')
              if (url) {
                editor.chain().focus().setLink({ href: url }).run()
              }
            }}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('link') && 'bg-accent',
            )}
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('blockquote') && 'bg-accent',
            )}
          >
            <Quote className="h-4 w-4" />
          </Button>
        </div>
        {/* Editor Content */}
        <div className="p-4 text-sm text-card-foreground overflow-auto flex-1 min-h-0">
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  )
}
