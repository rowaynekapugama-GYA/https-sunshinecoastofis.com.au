'use client';
import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { MediaPicker } from '../ui/MediaPicker';
import { mediaFull } from '../lib/api';

/**
 * The article editor: headings, lists, links, quotes and inline photos from
 * the media library. Stores plain HTML, which the site sanitises and renders
 * with its own article styles.
 */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [pick, setPick] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, code: false }),
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: null, target: null } }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: 'Start writing your article…' }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  if (!editor) return <div className="d-rte" style={{ minHeight: 400 }} />;

  const B = ({ on, active, label, title }: { on: () => void; active?: boolean; label: React.ReactNode; title: string }) => (
    <button type="button" title={title} aria-label={title} className={active ? 'active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={on}>
      {label}
    </button>
  );
  const setLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('Link address (a page such as /services/ or a full https:// address)', prev);
    if (url === null) return;
    if (!url.trim()) return editor.chain().focus().unsetLink().run();
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };
  return (
    <div className="d-rte">
      <div className="d-rte-toolbar" role="toolbar" aria-label="Formatting">
        <B title="Paragraph" label="¶" active={editor.isActive('paragraph')} on={() => editor.chain().focus().setParagraph().run()} />
        <B title="Heading" label="H2" active={editor.isActive('heading', { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <B title="Sub-heading" label="H3" active={editor.isActive('heading', { level: 3 })} on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <span className="sep" />
        <B title="Bold" label={<strong>B</strong>} active={editor.isActive('bold')} on={() => editor.chain().focus().toggleBold().run()} />
        <B title="Italic" label={<em>I</em>} active={editor.isActive('italic')} on={() => editor.chain().focus().toggleItalic().run()} />
        <span className="sep" />
        <B title="Bullet list" label="• List" active={editor.isActive('bulletList')} on={() => editor.chain().focus().toggleBulletList().run()} />
        <B title="Numbered list" label="1. List" active={editor.isActive('orderedList')} on={() => editor.chain().focus().toggleOrderedList().run()} />
        <B title="Quote" label="“ Quote" active={editor.isActive('blockquote')} on={() => editor.chain().focus().toggleBlockquote().run()} />
        <span className="sep" />
        <B title="Link" label="Link" active={editor.isActive('link')} on={setLink} />
        <B title="Insert photo" label="Photo" on={() => setPick(true)} />
        <span className="sep" />
        <B title="Undo" label="Undo" on={() => editor.chain().focus().undo().run()} />
        <B title="Redo" label="Redo" on={() => editor.chain().focus().redo().run()} />
      </div>
      <EditorContent editor={editor} />
      {pick && (
        <MediaPicker
          onClose={() => setPick(false)}
          onSelect={(m) => {
            editor.chain().focus().setImage({ src: mediaFull(m), alt: m.alt || '' }).run();
            setPick(false);
          }}
        />
      )}
    </div>
  );
}
