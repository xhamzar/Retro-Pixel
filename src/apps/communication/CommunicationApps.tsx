'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, ChatMessageRecord, EmailRecord, GroupRecord } from '@/src/types/os';

// ==========================================
// 1. PERSISTENT GROUPS APP
// ==========================================
export const GroupsApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const openApp = useOSStore((s) => s.openApp);
  const showToast = useOSStore((s) => s.showToast);

  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [selected, setSelected] = useState(0);
  const [creating, setCreating] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [topicInput, setTopicInput] = useState('');

  const loadGroups = async () => {
    setGroups(await db.groups.toArray());
  };

  useEffect(() => {
    let active = true;
    db.groups.toArray().then((rows) => {
      if (active) setGroups(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  const createGroup = async () => {
    const clean = nameInput.trim();
    if (!clean) {
      soundEngine.playCue('error');
      return;
    }
    const threadId = `grup-${clean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-4)}`;
    await db.groups.add({
      threadId,
      name: clean,
      members: 1,
      topic: topicInput.trim() || (language === 'id' ? 'Diskusi grup' : 'Group chat'),
    });
    await db.messages.add({
      threadId,
      contactName: clean,
      phone: threadId.toUpperCase(),
      body: language === 'id' ? `Grup "${clean}" dibuat.` : `Group "${clean}" created.`,
      timestamp: Date.now(),
      unread: false,
      isOutgoing: false,
    });
    setNameInput('');
    setTopicInput('');
    setCreating(false);
    soundEngine.playCue('select');
    showToast(language === 'id' ? `Grup "${clean}" dibuat` : `Group "${clean}" created`);
    loadGroups();
  };

  useEffect(() => {
    if (creating) {
      setSoftkeys({
        leftLabel: '',
        centerLabel: language === 'id' ? 'Simpan' : 'Save',
        rightLabel: language === 'id' ? 'Batal' : 'Cancel',
        onCenter: createGroup,
        onRight: () => setCreating(false),
      });
    } else {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Baru' : 'New',
        centerLabel: language === 'id' ? 'Buka' : 'Open',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => setCreating(true),
        onCenter: () => {
          const g = groups[selected];
          if (g) openApp('messages', { phoneNumber: g.threadId, title: g.name });
        },
        onRight: onBack,
      });
    }
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Grup' : 'Groups'} showChevrons={false} />
      {creating ? (
        <div className="p-3 space-y-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={language === 'id' ? 'Nama grup...' : 'Group name...'}
            className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-sm outline-none"
          />
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder={language === 'id' ? 'Topik (opsional)...' : 'Topic (optional)...'}
            className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-sm outline-none"
          />
          <button
            type="button"
            onClick={createGroup}
            className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-sm font-bold cursor-pointer"
          >
            {language === 'id' ? 'Buat Grup' : 'Create Group'}
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto lcd-scroll divide-y-2 divide-[var(--lcd-fg)]">
          {groups.map((g, idx) => (
            <div
              key={g.id ?? g.threadId}
              className={`flex items-center justify-between p-2 ${
                selected === idx ? 'bg-[var(--lcd-sec)]' : 'hover:bg-[var(--lcd-sec)]'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setSelected(idx);
                  soundEngine.playCue('click');
                  openApp('messages', { phoneNumber: g.threadId, title: g.name });
                }}
                className="flex-1 min-w-0 text-left flex items-center gap-2.5 cursor-pointer"
              >
                <PixelIcon name="groups" size={26} />
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-bold leading-none truncate">
                    {g.name} ({g.members})
                  </div>
                  <div className="text-xs opacity-80 truncate mt-1">{g.topic}</div>
                </div>
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!g.id) return;
                  await db.groups.delete(g.id);
                  loadGroups();
                }}
                className="ml-2 px-1.5 py-0.5 border border-[var(--lcd-fg)] text-xs font-bold cursor-pointer"
                title={language === 'id' ? 'Hapus' : 'Delete'}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. PERSISTENT EMAIL APP + REPLY + MAILTO
// ==========================================
export const EmailApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox');
  const [view, setView] = useState<'list' | 'read' | 'compose'>('list');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [toInput, setToInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [bodyInput, setBodyInput] = useState('');

  const loadEmails = async () => {
    const rows = await db.emails.orderBy('timestamp').reverse().toArray();
    setEmails(rows);
  };

  useEffect(() => {
    let active = true;
    db.emails
      .orderBy('timestamp')
      .reverse()
      .toArray()
      .then((rows) => {
        if (active) setEmails(rows);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleEmails = useMemo(
    () => emails.filter((e) => e.folder === folder),
    [emails, folder]
  );

  const current = emails.find((e) => e.id === activeId) ?? visibleEmails[0];

  const handleSend = async () => {
    if (!toInput.trim() || !subjectInput.trim()) {
      soundEngine.playCue('error');
      showToast(language === 'id' ? 'Tujuan & subjek wajib diisi' : 'Recipient & subject required');
      return;
    }
    soundEngine.playCue('select');
    await db.emails.add({
      folder: 'sent',
      from: 'user@retropixel.local',
      to: toInput.trim(),
      subject: subjectInput.trim(),
      body: bodyInput.trim() || '(Tanpa isi)',
      timestamp: Date.now(),
      unread: false,
    });
    setToInput('');
    setSubjectInput('');
    setBodyInput('');
    setFolder('sent');
    setView('list');
    await loadEmails();
    showToast(language === 'id' ? 'Email disimpan di Terkirim' : 'Email saved in Sent');
  };

  const startReply = (mail: EmailRecord) => {
    setToInput(mail.folder === 'inbox' ? mail.from : mail.to);
    setSubjectInput(mail.subject.startsWith('Re:') ? mail.subject : `Re: ${mail.subject}`);
    setBodyInput(`\n\n--- ${mail.from} ---\n${mail.body}`);
    setView('compose');
  };

  const deleteMail = async (id?: number) => {
    if (!id) return;
    await db.emails.delete(id);
    soundEngine.playCue('back');
    setView('list');
    await loadEmails();
    showToast(language === 'id' ? 'Email dihapus' : 'Email deleted');
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel:
        view === 'list'
          ? language === 'id'
            ? 'Tulis'
            : 'Write'
          : view === 'read' && current
            ? language === 'id'
              ? 'Balas'
              : 'Reply'
            : '',
      centerLabel:
        view === 'compose'
          ? language === 'id'
            ? 'Kirim'
            : 'Send'
          : view === 'read' && current
            ? language === 'id'
              ? 'Hapus'
              : 'Delete'
            : language === 'id'
              ? 'Buka'
              : 'Read',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => {
        if (view === 'list') {
          setToInput('');
          setSubjectInput('');
          setBodyInput('');
          setView('compose');
        } else if (view === 'read' && current) {
          startReply(current);
        }
      },
      onCenter: () => {
        if (view === 'list' && current) {
          setActiveId(current.id ?? null);
          setView('read');
          if (current.unread && current.id) {
            db.emails.update(current.id, { unread: false }).then(loadEmails);
          }
        } else if (view === 'read' && current) {
          deleteMail(current.id);
        } else if (view === 'compose') {
          handleSend();
        }
      },
      onRight: () => {
        if (view === 'list') onBack();
        else setView('list');
      },
    });
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title="Email" showChevrons={false} />

      {view === 'list' && (
        <>
          <div className="grid grid-cols-2 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setFolder('inbox')}
              className={`py-1 cursor-pointer ${folder === 'inbox' ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : ''}`}
            >
              {language === 'id' ? 'Kotak Masuk' : 'Inbox'} ({emails.filter((e) => e.folder === 'inbox').length})
            </button>
            <button
              type="button"
              onClick={() => setFolder('sent')}
              className={`py-1 border-l-2 border-[var(--lcd-fg)] cursor-pointer ${folder === 'sent' ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : ''}`}
            >
              {language === 'id' ? 'Terkirim' : 'Sent'} ({emails.filter((e) => e.folder === 'sent').length})
            </button>
          </div>
          <div className="flex-1 overflow-y-auto lcd-scroll divide-y-2 divide-[var(--lcd-fg)]">
            {visibleEmails.length === 0 ? (
              <div className="p-4 text-center text-sm opacity-75">
                {language === 'id' ? 'Folder email kosong.' : 'Folder is empty.'}
              </div>
            ) : (
              visibleEmails.map((mail) => (
                <button
                  key={mail.id}
                  type="button"
                  onClick={async () => {
                    setActiveId(mail.id ?? null);
                    setView('read');
                    soundEngine.playCue('click');
                    if (mail.unread && mail.id) {
                      await db.emails.update(mail.id, { unread: false });
                      loadEmails();
                    }
                  }}
                  className="w-full text-left p-2 hover:bg-[var(--lcd-sec)] cursor-pointer"
                >
                  <div className="flex justify-between text-sm font-bold">
                    <span className="truncate">
                      {mail.unread ? '● ' : ''}
                      {mail.subject}
                    </span>
                    <span className="text-[11px] shrink-0 ml-2">
                      {new Date(mail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-xs opacity-80 truncate">
                    {mail.folder === 'inbox' ? mail.from : `→ ${mail.to}`}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {view === 'read' && current && (
        <div className="flex-1 overflow-y-auto lcd-scroll p-2.5 space-y-2">
          <div className="border-b-2 border-[var(--lcd-fg)] pb-1.5">
            <h3 className="text-base font-bold leading-tight">{current.subject}</h3>
            <p className="text-xs opacity-85 mt-0.5">
              {current.folder === 'inbox' ? current.from : `→ ${current.to}`} ·{' '}
              {new Date(current.timestamp).toLocaleString()}
            </p>
          </div>
          <p className="text-xs sm:text-sm leading-snug whitespace-pre-wrap break-words">{current.body}</p>
          <div className="grid grid-cols-2 gap-1.5 pt-2">
            <button
              type="button"
              onClick={() => startReply(current)}
              className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
            >
              {language === 'id' ? 'Balas' : 'Reply'}
            </button>
            <button
              type="button"
              onClick={() => deleteMail(current.id)}
              className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
            >
              {language === 'id' ? 'Hapus' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {view === 'compose' && (
        <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-2">
          <input
            type="email"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            placeholder={language === 'id' ? 'Kepada (email)' : 'To (email)'}
            className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-sm outline-none"
          />
          <input
            type="text"
            value={subjectInput}
            onChange={(e) => setSubjectInput(e.target.value)}
            placeholder={language === 'id' ? 'Subjek' : 'Subject'}
            className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-sm outline-none"
          />
          <textarea
            rows={4}
            value={bodyInput}
            onChange={(e) => setBodyInput(e.target.value)}
            placeholder={language === 'id' ? 'Isi email...' : 'Email body...'}
            className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-sm outline-none resize-none"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleSend}
              className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] py-1 text-xs font-bold cursor-pointer"
            >
              {language === 'id' ? 'Simpan & Kirim' : 'Save & Send'}
            </button>
            <a
              href={`mailto:${encodeURIComponent(toInput)}?subject=${encodeURIComponent(subjectInput)}&body=${encodeURIComponent(bodyInput)}`}
              className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] py-1 text-xs font-bold text-center"
            >
              {language === 'id' ? 'Kirim via Mailto' : 'Open Mail App'}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. REAL CROSS-TAB + LOCAL PERSISTENT CHAT APP
// ==========================================
export const ChatApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [lines, setLines] = useState<ChatMessageRecord[]>([]);
  const [nickname, setNickname] = useState(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem('rpos_chat_nick') || 'Saya' : 'Saya'
  );
  const [editingNick, setEditingNick] = useState(false);
  const [input, setInput] = useState('');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  const loadChat = async () => {
    const rows = await db.chatMessages.orderBy('timestamp').toArray();
    setLines(rows);
  };

  useEffect(() => {
    let active = true;
    db.chatMessages
      .orderBy('timestamp')
      .toArray()
      .then((rows) => {
        if (active) setLines(rows);
      });

    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('retro_pixel_chat');
      channelRef.current = ch;
      ch.onmessage = async (ev) => {
        const data = ev.data as { type?: string; sender?: string; text?: string; timestamp?: number };
        if (data?.type === 'chat' && data.text) {
          await db.chatMessages.add({
            room: 'lobby',
            sender: data.sender || 'Peer',
            text: data.text,
            timestamp: data.timestamp || Date.now(),
            isSelf: false,
          });
          soundEngine.playCue('notify');
          loadChat();
        }
      };
      return () => {
        active = false;
        ch.close();
      };
    }

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines.length]);

  const sendChat = async () => {
    const text = input.trim();
    if (!text) return;
    const now = Date.now();
    soundEngine.playCue('click');
    await db.chatMessages.add({
      room: 'lobby',
      sender: nickname,
      text,
      timestamp: now,
      isSelf: true,
    });
    channelRef.current?.postMessage({
      type: 'chat',
      sender: nickname,
      text,
      timestamp: now,
    });
    setInput('');
    loadChat();
  };

  const clearChat = async () => {
    await db.chatMessages.clear();
    await db.chatMessages.add({
      room: 'lobby',
      sender: 'Sistem',
      text: language === 'id' ? 'Riwayat obrolan dibersihkan.' : 'Chat history cleared.',
      timestamp: Date.now(),
      isSelf: false,
    });
    loadChat();
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: language === 'id' ? 'Bersih' : 'Clear',
      centerLabel: language === 'id' ? 'Kirim' : 'Send',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: clearChat,
      onCenter: () => sendChat(),
      onRight: onBack,
    });
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title="Chat (Live Tab)"
        showChevrons={false}
        rightSlot={
          <button
            type="button"
            onClick={() => setEditingNick((v) => !v)}
            className="border border-current px-1.5 text-[10px] font-bold cursor-pointer"
          >
            @{nickname}
          </button>
        }
      />

      {editingNick && (
        <div className="flex gap-1 p-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={language === 'id' ? 'Nama panggilan...' : 'Nickname...'}
            className="flex-1 min-w-0 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-0.5 text-xs outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const clean = nickname.trim() || 'Saya';
              setNickname(clean);
              window.localStorage.setItem('rpos_chat_nick', clean);
              setEditingNick(false);
              showToast(`Nickname: ${clean}`);
            }}
            className="px-2 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
          >
            OK
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-1.5 min-h-0">
        {lines.map((l, idx) => (
          <div
            key={l.id ?? idx}
            className={`border border-[var(--lcd-fg)] px-2 py-1 text-xs leading-tight ${
              l.isSelf ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
            }`}
          >
            <div className="flex justify-between text-[10px] opacity-80 mb-0.5">
              <span className="font-bold">{l.sender}</span>
              <span>{new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="break-words">{l.text}</div>
          </div>
        ))}
        <div ref={listEndRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendChat();
        }}
        className="flex gap-1 p-1.5 border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={language === 'id' ? 'Ketik pesan...' : 'Type chat...'}
          className="flex-1 min-w-0 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-0.5 text-xs outline-none"
        />
        <button
          type="submit"
          className="px-2.5 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
        >
          OK
        </button>
      </form>
    </div>
  );
};
