'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, ContactRecord, MessageRecord } from '@/src/types/os';

interface ThreadSummary {
  threadId: string;
  contactName: string;
  phone: string;
  lastBody: string;
  lastTimestamp: number;
  unreadCount: number;
}

export const MessagesApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [view, setView] = useState<'list' | 'thread' | 'compose'>(() =>
    params?.phoneNumber ? 'thread' : 'list'
  );
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() =>
    params?.phoneNumber ? String(params.phoneNumber) : null
  );
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [composePhone, setComposePhone] = useState(() =>
    params?.phoneNumber ? String(params.phoneNumber) : ''
  );
  const [composeName, setComposeName] = useState(() =>
    params?.title
      ? String(params.title)
      : params?.phoneNumber
        ? params.contactId
          ? String(params.contactId)
          : String(params.phoneNumber)
        : ''
  );
  const [replyText, setReplyText] = useState('');

  const loadData = async () => {
    const [msgs, conts] = await Promise.all([
      db.messages.orderBy('timestamp').reverse().toArray(),
      db.contacts.orderBy('name').toArray(),
    ]);
    setMessages(msgs);
    setContacts(conts);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      db.messages.orderBy('timestamp').reverse().toArray(),
      db.contacts.orderBy('name').toArray(),
    ]).then(([msgs, conts]) => {
      if (!active) return;
      setMessages(msgs);
      setContacts(conts);
    });
    return () => {
      active = false;
    };
  }, []);

  const threads = useMemo<ThreadSummary[]>(() => {
    const map = new Map<string, ThreadSummary>();
    for (const m of messages) {
      const existing = map.get(m.threadId);
      if (!existing) {
        map.set(m.threadId, {
          threadId: m.threadId,
          contactName: m.contactName,
          phone: m.phone,
          lastBody: m.body,
          lastTimestamp: m.timestamp,
          unreadCount: m.unread ? 1 : 0,
        });
      } else {
        if (m.timestamp > existing.lastTimestamp) {
          existing.lastBody = m.body;
          existing.lastTimestamp = m.timestamp;
        }
        if (m.unread) existing.unreadCount += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [messages]);

  const threadMessages = useMemo(() => {
    if (!activeThreadId) return [];
    return messages
      .filter((m) => m.threadId === activeThreadId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [messages, activeThreadId]);

  const openThread = async (threadId: string) => {
    soundEngine.playCue('open');
    setActiveThreadId(threadId);
    setView('thread');
    await db.messages.where('threadId').equals(threadId).modify({ unread: false });
    loadData();
  };

  const deleteThread = async (threadId: string) => {
    soundEngine.playCue('back');
    await db.messages.where('threadId').equals(threadId).delete();
    showToast(language === 'id' ? 'Percakapan dihapus' : 'Conversation deleted');
    setView('list');
    setActiveThreadId(null);
    loadData();
  };

  const sendMessage = async (targetThreadId: string, targetName: string, targetPhone: string, body: string) => {
    const clean = body.trim();
    if (!clean) return;
    soundEngine.playCue('select');
    const now = Date.now();
    await db.messages.add({
      threadId: targetThreadId,
      contactName: targetName || targetPhone,
      phone: targetPhone,
      body: clean,
      timestamp: now,
      unread: false,
      isOutgoing: true,
    });
    setReplyText('');
    await loadData();

    // Simulated reply after short delay for realistic local feedback
    if (targetThreadId !== 'system') {
      setTimeout(async () => {
        const replyOptions =
          language === 'id'
            ? [
                'Oke siap! Pesan diterima.',
                'Baik, nanti saya kabari lagi ya.',
                'Terima kasih infonya!',
              ]
            : ['Got it! Message received.', 'Okay, will follow up shortly.', 'Thanks for the update!'];
        const reply = replyOptions[Math.floor(Math.random() * replyOptions.length)];
        await db.messages.add({
          threadId: targetThreadId,
          contactName: targetName || targetPhone,
          phone: targetPhone,
          body: reply,
          timestamp: Date.now(),
          unread: false,
          isOutgoing: false,
        });
        soundEngine.playCue('notify');
        loadData();
      }, 1100);
    }
  };

  useEffect(() => {
    if (view === 'list') {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Baru' : 'New',
        centerLabel: language === 'id' ? 'Buka' : 'Open',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => setView('compose'),
        onCenter: () => {
          const item = threads[selectedIdx];
          if (item) openThread(item.threadId);
        },
        onRight: onBack,
      });
    } else if (view === 'thread') {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Hapus' : 'Delete',
        centerLabel: language === 'id' ? 'Kirim' : 'Send',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => {
          if (activeThreadId) deleteThread(activeThreadId);
        },
        onCenter: () => {
          const tInfo = threads.find((t) => t.threadId === activeThreadId);
          if (activeThreadId && replyText.trim()) {
            sendMessage(
              activeThreadId,
              tInfo?.contactName ?? composeName ?? activeThreadId,
              tInfo?.phone ?? activeThreadId,
              replyText
            );
          }
        },
        onRight: () => setView('list'),
      });
    } else {
      setSoftkeys({
        leftLabel: '',
        centerLabel: language === 'id' ? 'Kirim' : 'Send',
        rightLabel: language === 'id' ? 'Batal' : 'Cancel',
        onCenter: async () => {
          if (!composePhone.trim() || !replyText.trim()) {
            soundEngine.playCue('error');
            return;
          }
          const tid = composePhone.trim();
          await sendMessage(tid, composeName.trim() || tid, tid, replyText);
          setActiveThreadId(tid);
          setView('thread');
        },
        onRight: () => setView('list'),
      });
    }
  }, [view, selectedIdx, threads, activeThreadId, replyText, composePhone, composeName, language]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const today = new Date().toDateString();
    if (d.toDateString() === today) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return language === 'id' ? 'Kemarin' : 'Earlier';
  };

  const activeThreadMeta = threads.find((t) => t.threadId === activeThreadId);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={
          view === 'list'
            ? language === 'id'
              ? 'Pesan'
              : 'Messages'
            : view === 'compose'
              ? language === 'id'
                ? 'Pesan Baru'
                : 'New Message'
              : activeThreadMeta?.contactName || activeThreadId || 'Chat'
        }
        showChevrons={false}
      />

      {view === 'list' && (
        <div className="flex-1 overflow-y-auto lcd-scroll divide-y-2 divide-[var(--lcd-fg)]">
          {threads.length === 0 ? (
            <div className="p-4 text-center text-xs sm:text-sm">
              {language === 'id' ? 'Kotak pesan kosong.' : 'No conversations yet.'}
            </div>
          ) : (
            threads.map((item, idx) => {
              const selected = idx === selectedIdx;
              return (
                <button
                  key={item.threadId}
                  type="button"
                  onClick={() => {
                    setSelectedIdx(idx);
                    openThread(item.threadId);
                  }}
                  className={`w-full flex items-start gap-2 px-2 py-2 text-left cursor-pointer ${
                    selected ? 'bg-[var(--lcd-sec)]' : 'hover:bg-[var(--lcd-sec)]'
                  }`}
                >
                  <div className="pt-0.5 relative">
                    <PixelIcon name="message" size={26} />
                    {item.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--lcd-fg)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs sm:text-sm font-bold leading-none truncate">
                        {item.contactName}
                        {item.unreadCount > 0 ? ` (${item.unreadCount})` : ''}
                      </span>
                      <span className="text-[10px] shrink-0 opacity-85">{formatTime(item.lastTimestamp)}</span>
                    </div>
                    <p className="text-[11px] leading-tight truncate opacity-90 mt-1">{item.lastBody}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {view === 'thread' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-2">
            {threadMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isOutgoing ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] border-2 border-[var(--lcd-fg)] px-2 py-1 text-xs leading-snug ${
                    msg.isOutgoing
                      ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                      : 'bg-[var(--lcd-sec)] text-[var(--lcd-fg)]'
                  }`}
                >
                  <p className="break-words">{msg.body}</p>
                  <span className="block text-[9px] opacity-80 text-right mt-0.5">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (activeThreadId && replyText.trim()) {
                sendMessage(
                  activeThreadId,
                  activeThreadMeta?.contactName ?? composeName ?? activeThreadId,
                  activeThreadMeta?.phone ?? activeThreadId,
                  replyText
                );
              }
            }}
            className="flex items-center gap-1 p-1.5 border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)]"
          >
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={language === 'id' ? 'Ketik pesan...' : 'Type message...'}
              className="flex-1 min-w-0 bg-[var(--lcd-bg)] text-[var(--lcd-fg)] border-2 border-[var(--lcd-fg)] px-2 py-1 text-xs outline-none"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer shrink-0"
            >
              {language === 'id' ? 'Kirim' : 'Send'}
            </button>
          </form>
        </div>
      )}

      {view === 'compose' && (
        <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-2">
          <div>
            <label className="block text-xs font-bold">
              {language === 'id' ? 'Pilih Kontak Cepat:' : 'Quick Contact:'}
            </label>
            <div className="flex flex-wrap gap-1 mt-1">
              {contacts.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setComposePhone(c.phone);
                    setComposeName(c.name);
                    soundEngine.playCue('click');
                  }}
                  className={`px-1.5 py-0.5 text-xs border border-[var(--lcd-fg)] cursor-pointer ${
                    composePhone === c.phone
                      ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                      : 'bg-[var(--lcd-sec)]'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold">
              {language === 'id' ? 'Nomor Tujuan:' : 'Recipient Number:'}
            </label>
            <input
              type="text"
              value={composePhone}
              onChange={(e) => setComposePhone(e.target.value)}
              placeholder="+62 812..."
              className="w-full bg-[var(--lcd-bg)] border-2 border-[var(--lcd-fg)] px-2 py-1 text-xs outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold">
              {language === 'id' ? 'Isi Pesan:' : 'Message Text:'}
            </label>
            <textarea
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={language === 'id' ? 'Tulis pesan Anda...' : 'Write your message...'}
              className="w-full bg-[var(--lcd-bg)] border-2 border-[var(--lcd-fg)] px-2 py-1 text-xs outline-none resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};
