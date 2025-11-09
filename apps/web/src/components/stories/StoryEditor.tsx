import { type ComponentType, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type TiptapEditor = {
  getHTML: () => string
  isEmpty: boolean
  commands: {
    clearContent: () => void
    setContent: (content: string, emitUpdate?: boolean) => void
  }
  setEditable: (value: boolean) => void
  destroy: () => void
}

type TiptapExtension = {
  configure: (config: Record<string, unknown>) => TiptapExtension
}

type TiptapUseEditor = (
  options: {
    extensions: Array<TiptapExtension | null>
    content?: string
    editable?: boolean
    onUpdate?: (payload: { editor: TiptapEditor }) => void
  },
  deps?: unknown[],
) => TiptapEditor | null

type EditorContentComponent = ComponentType<{
  editor: TiptapEditor | null
  id?: string
  className?: string
}>

type TiptapReactModule = {
  EditorContent: EditorContentComponent
  useEditor: TiptapUseEditor
}

type StoryEditorProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  editable?: boolean
  placeholder?: string
  className?: string
}

type LoadedModules = {
  react: TiptapReactModule
  starterKit: TiptapExtension
  placeholder: TiptapExtension | null
}

export function StoryEditor({
  id,
  value,
  onChange,
  editable = true,
  placeholder,
  className,
}: StoryEditorProps) {
  const [modules, setModules] = useState<LoadedModules | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadTiptap() {
      try {
        setLoadError(null)

        const results: [unknown, unknown, unknown] = await Promise.all([
          // @ts-expect-error -- dynamic import of remote TipTap bundle
          import(
            /* @vite-ignore */
            'https://esm.sh/@tiptap/react@2?bundle'
          ),
          // @ts-expect-error -- dynamic import of remote TipTap bundle
          import(
            /* @vite-ignore */
            'https://esm.sh/@tiptap/starter-kit@2?bundle'
          ),
          // @ts-expect-error -- dynamic import of remote TipTap bundle
          import(
            /* @vite-ignore */
            'https://esm.sh/@tiptap/extension-placeholder@2?bundle'
          ).catch(() => null),
        ])

        const [reactModuleRaw, starterKitModuleRaw, placeholderModuleRaw] =
          results

        if (!isMounted) {
          return
        }

        const reactModule = isTiptapReactModule(reactModuleRaw)
          ? reactModuleRaw
          : null
        const starterKit = extractConfigurableExtension(starterKitModuleRaw)
        const placeholderExtension =
          extractConfigurableExtension(placeholderModuleRaw)

        if (!reactModule || !starterKit) {
          throw new Error('Failed to load TipTap modules')
        }

        setModules({
          react: reactModule,
          starterKit,
          placeholder: placeholderExtension,
        })
        setLoadError(null)
      } catch (error) {
        console.error('Failed to load TipTap editor', error)
        setLoadError(
          error instanceof Error
            ? error
            : new Error('Failed to load TipTap editor'),
        )
      }
    }

    void loadTiptap()

    return () => {
      isMounted = false
    }
  }, [])

  if (!modules) {
    return (
      <div
        className={cn(
          'flex min-h-[240px] flex-1 items-center justify-center rounded-md border border-dashed border-input bg-muted/30 text-sm text-muted-foreground',
          className,
        )}
      >
        {loadError ? 'Failed to load story editor.' : 'Loading story editor...'}
      </div>
    )
  }

  return (
    <LoadedStoryEditor
      id={id}
      value={value}
      onChange={onChange}
      editable={editable}
      placeholder={placeholder}
      className={className}
      modules={modules}
    />
  )
}

type LoadedStoryEditorProps = StoryEditorProps & {
  modules: LoadedModules
}

function LoadedStoryEditor({
  id,
  value,
  onChange,
  editable = true,
  placeholder,
  className,
  modules,
}: LoadedStoryEditorProps) {
  const { useEditor, EditorContent } = modules.react
  const normalizedValue = normalizeContent(value)

  const editor = useEditor(
    {
      extensions: [
        modules.starterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        modules.placeholder
          ? modules.placeholder.configure({
              placeholder: placeholder ?? 'Write your story...',
              showOnlyWhenEditable: true,
              showOnlyCurrent: false,
            })
          : null,
      ].filter(Boolean),
      content: normalizedValue,
      editable,
      onUpdate({ editor }: { editor: TiptapEditor }) {
        const html = editor.getHTML()
        onChange(editor.isEmpty ? '' : html)
      },
    },
    [editable, placeholder, modules.starterKit, modules.placeholder],
  )

  useEffect(() => {
    if (!editor) {
      return
    }
    const desired = normalizeContent(value)
    const current = editor.getHTML()
    if (!desired && editor.isEmpty) {
      return
    }
    if (desired === current) {
      return
    }
    if (!desired) {
      editor.commands.clearContent()
      return
    }
    editor.commands.setContent(desired, false)
  }, [editor, value])

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  if (!editor) {
    return (
      <div
        className={cn(
          'flex min-h-[240px] flex-1 items-center justify-center rounded-md border border-input bg-muted/20 text-sm text-muted-foreground',
          className,
        )}
      >
        Initializing editor...
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-[240px] flex-1 flex-col', className)}>
      <div
        className={cn(
          'flex-1 overflow-hidden rounded-md border border-input bg-card text-card-foreground shadow-sm transition-colors',
          !editable && 'bg-muted/50',
        )}
      >
        <EditorContent
          id={id}
          editor={editor}
          className={cn(
            'prose prose-sm relative h-full max-w-none overflow-auto px-4 py-3 text-sm focus:outline-none focus-visible:ring-0',
            editable ? 'cursor-text' : 'cursor-default',
          )}
        />
      </div>
    </div>
  )
}

function normalizeContent(value: string) {
  if (!value) {
    return ''
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  if (looksLikeHtml(trimmed)) {
    return value
  }

  const paragraphs = value.split(/\n{2,}/)
  return paragraphs
    .map((paragraph) => {
      const sanitized = escapeHtml(paragraph)
        .split('\n')
        .map((line) => (line.length > 0 ? line : '<br />'))
        .join('<br />')
      if (!sanitized || sanitized === '<br />') {
        return '<p><br /></p>'
      }
      return `<p>${sanitized}</p>`
    })
    .join('')
}

function looksLikeHtml(value: string) {
  return /<[^>]+>/i.test(value)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function extractConfigurableExtension(module: unknown): TiptapExtension | null {
  if (!module) {
    return null
  }

  const candidate =
    isRecord(module) && 'default' in module
      ? (module as { default: unknown }).default
      : module
  return isConfigurableExtension(candidate) ? candidate : null
}

function isConfigurableExtension(value: unknown): value is TiptapExtension {
  return isRecord(value) && typeof value.configure === 'function'
}

function isTiptapReactModule(value: unknown): value is TiptapReactModule {
  if (!isRecord(value)) {
    return false
  }
  const { EditorContent, useEditor } = value
  return typeof EditorContent === 'function' && typeof useEditor === 'function'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
