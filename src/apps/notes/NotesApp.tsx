'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, NoteRecord } from '@/src/types/os';

export const NotesApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [editing, setEditing] = useState<NoteRecord | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [query, setQuery] = useState('');

  const loadNotes = async () => {
    const rows = await db.notes.orderBy('updatedAt').reverse().toArray();
    setNotes(rows);
  };

  useEffect(() => {
    let active = true;
    db.notes
      .orderBy('updatedAt')
      .reverse()
      .toArray()
      .then((rows) => {
        if (active) setNotes(rows);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }, [notes, query]);

  const createNote = async () => {
    const id = await db.notes.add({
      title: language === 'id' ? 'Catatan Baru' : 'New Note',
      body: '',
      updatedAt: Date.now(),
    });
    const created = await db.notes.get(id);
    if (created) setEditing(created);
    await loadNotes();
  };

  // Autosave while editing
  useEffect(() => {
    if (!editing?.id) return;
    const timer = setTimeout(async () => {
      await db.notes.update(editing.id!, {
        title: editing.title || (language === 'id' ? 'Tanpa Judul' : 'Untitled'),
        body: editing.body,
        updatedAt: Date.now(),
      });
      loadNotes();
    }, 350);
    return () => clearTimeout(timer);
  }, [editing?.id, editing?.title, editing?.body, language]);

  const deleteNote = async (id?: number) => {
    if (!id) return;
    await db.notes.delete(id);
    soundEngine.playCue('back');
    showToast(language === 'id' ? 'Catatan dihapus' : 'Note deleted');
    setEditing(null);
    loadNotes();
  };

  const exportNoteTxt = async (note: NoteRecord) => {
    const safeName = `${(note.title || 'catatan').replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
    const fullText = `${note.title}\n${'='.repeat(Math.min(24, note.title.length))}\n\n${note.body}`;
    await db.files.add({
      folder: 'Dokumen',
      name: safeName,
      mimeType: 'text/plain',
      sizeKb: Math.max(1, Math.ceil(new Blob([fullText]).size / 1024)),
      content: fullText,
      createdAt: Date.now(),
    });
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    soundEngine.playCue('select');
    showToast(language === 'id' ? `Diekspor: ${safeName}` : `Exported: ${safeName}`);
  };

  const shareNote = async (note: NoteRecord) => {
    const text = `${note.title}\n\n${note.body}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: note.title, text });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast(language === 'id' ? 'Catatan disalin ke clipboard' : 'Note copied to clipboard');
    } catch {
      showToast(language === 'id' ? 'Gagal menyalin' : 'Copy failed');
    }
  };

  useEffect(() => {
    if (editing) {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Ekspor' : 'Export',
        centerLabel: language === 'id' ? 'Simpan' : 'Save',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => exportNoteTxt(editing),
        onCenter: () => {
          showToast(language === 'id' ? 'Tersimpan otomatis' : 'Autosaved');
          setEditing(null);
        },
        onRight: () => setEditing(null),
      });
    } else {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Baru' : 'New',
        centerLabel: language === 'id' ? 'Buka' : 'Open',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: createNote,
        onCenter: () => {
          if (filteredNotes[selectedIdx]) setEditing(filteredNotes[selectedIdx]);
        },
        onRight: onBack,
      });
    }
  });

  const wordCount = editing?.body.trim() ? editing.body.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={language === 'id' ? 'Catatan' : 'Notes'}
        showChevrons={false}
      />

      {editing ? (
        <div className="flex-1 flex flex-col p-2 gap-1.5 min-h-0">
          <input
            type="text"
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            placeholder={language === 'id' ? 'Judul catatan...' : 'Note title...'}
            className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-base font-bold outline-none"
          />
          <textarea
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            placeholder={language === 'id' ? 'Tulis catatan...' : 'Write note...'}
            className="flex-1 w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] p-2 text-sm leading-snug outline-none resize-none"
          />
          <div className="flex items-center justify-between text-[11px] shrink-0">
            <span className="opacity-80">
              {wordCount} {language === 'id' ? 'kata' : 'words'} · {editing.body.length} ch
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shareNote(editing)}
                className="border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-1.5 py-0.5 font-bold cursor-pointer"
              >
                {language === 'id' ? 'Salin' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => exportNoteTxt(editing)}
                className="border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-1.5 py-0.5 font-bold cursor-pointer"
              >
                .TXT
              </button>
              <button
                type="button"
                onClick={() => deleteNote(editing.id)}
                className="border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] px-1.5 py-0.5 font-bold cursor-pointer"
              >
                {language === 'id' ? 'Hapus' : 'Del'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-1 p-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIdx(0);
              }}
              placeholder={language === 'id' ? 'Cari catatan...' : 'Search notes...'}
              className="flex-1 min-w-0 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-0.5 text-xs outline-none"
            />
            <button
              type="button"
              onClick={createNote}
              className="px-2 py-0.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
            >
              + {language === 'id' ? 'Baru' : 'New'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto lcd-scroll divide-y-2 divide-[var(--lcd-fg)]">
            {filteredNotes.length === 0 ? (
              <div className="p-4 text-center text-sm">
                {language === 'id' ? 'Belum ada catatan.' : 'No notes yet.'}
              </div>
            ) : (
              filteredNotes.map((n, idx) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setSelectedIdx(idx);
                    setEditing(n);
                    soundEngine.playCue('click');
                  }}
                  className={`w-full text-left px-2.5 py-2 flex items-start gap-2 cursor-pointer ${
                    idx === selectedIdx ? 'bg-[var(--lcd-sec)]' : 'hover:bg-[var(--lcd-sec)]'
                  }`}
                >
                  <PixelIcon name="note" size={22} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold leading-none truncate">{n.title}</div>
                    <div className="text-xs opacity-80 truncate mt-1">{n.body || '...'}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
