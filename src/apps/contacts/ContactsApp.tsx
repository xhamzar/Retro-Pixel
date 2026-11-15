'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, ContactRecord } from '@/src/types/os';

export const ContactsApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const openApp = useOSStore((s) => s.openApp);
  const showToast = useOSStore((s) => s.showToast);

  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mode, setMode] = useState<'list' | 'detail' | 'form'>('list');
  const [editing, setEditing] = useState<ContactRecord | null>(null);

  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [groupInput, setGroupInput] = useState('Umum');

  const loadContacts = async () => {
    const rows = await db.contacts.orderBy('name').toArray();
    setContacts(rows);
  };

  useEffect(() => {
    let active = true;
    db.contacts
      .orderBy('name')
      .toArray()
      .then((rows) => {
        if (active) setContacts(rows);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    );
  }, [contacts, query]);

  const activeContact = filtered[selectedIdx] ?? null;

  const startNew = () => {
    setEditing(null);
    setNameInput('');
    setPhoneInput('');
    setGroupInput('Umum');
    setMode('form');
  };

  const startEdit = (c: ContactRecord) => {
    setEditing(c);
    setNameInput(c.name);
    setPhoneInput(c.phone);
    setGroupInput(c.group || 'Umum');
    setMode('form');
  };

  const saveContact = async () => {
    if (!nameInput.trim() || !phoneInput.trim()) {
      soundEngine.playCue('error');
      showToast(language === 'id' ? 'Nama & nomor wajib diisi' : 'Name & number required');
      return;
    }
    if (editing?.id) {
      await db.contacts.update(editing.id, {
        name: nameInput.trim(),
        phone: phoneInput.trim(),
        group: groupInput.trim() || 'Umum',
      });
      showToast(language === 'id' ? 'Kontak diperbarui' : 'Contact updated');
    } else {
      await db.contacts.add({
        name: nameInput.trim(),
        phone: phoneInput.trim(),
        group: groupInput.trim() || 'Umum',
      });
      showToast(language === 'id' ? 'Kontak ditambahkan' : 'Contact added');
    }
    soundEngine.playCue('select');
    await loadContacts();
    setMode('list');
  };

  const deleteContact = async (c: ContactRecord) => {
    if (!c.id) return;
    await db.contacts.delete(c.id);
    soundEngine.playCue('back');
    showToast(language === 'id' ? 'Kontak dihapus' : 'Contact deleted');
    setSelectedIdx(0);
    setMode('list');
    loadContacts();
  };

  useEffect(() => {
    if (mode === 'list') {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Baru' : 'New',
        centerLabel: language === 'id' ? 'Lihat' : 'View',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: startNew,
        onCenter: () => {
          if (activeContact) setMode('detail');
        },
        onRight: onBack,
      });
    } else if (mode === 'detail' && activeContact) {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Ubah' : 'Edit',
        centerLabel: language === 'id' ? 'Panggil' : 'Call',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => startEdit(activeContact),
        onCenter: () => openApp('phone', { phoneNumber: activeContact.phone, contactId: activeContact.id }),
        onRight: () => setMode('list'),
      });
    } else {
      setSoftkeys({
        leftLabel: '',
        centerLabel: language === 'id' ? 'Simpan' : 'Save',
        rightLabel: language === 'id' ? 'Batal' : 'Cancel',
        onCenter: saveContact,
        onRight: () => setMode('list'),
      });
    }
  }, [mode, activeContact, nameInput, phoneInput, groupInput, language]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={
          mode === 'form'
            ? editing
              ? language === 'id'
                ? 'Ubah Kontak'
                : 'Edit Contact'
              : language === 'id'
                ? 'Kontak Baru'
                : 'New Contact'
            : language === 'id'
              ? 'Kontak'
              : 'Contacts'
        }
        showChevrons={false}
      />

      {mode === 'list' && (
        <>
          <div className="p-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)]">
            <div className="flex items-center border-2 border-[var(--lcd-fg)] px-1.5 py-0.5 bg-[var(--lcd-bg)]">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIdx(0);
                }}
                placeholder={language === 'id' ? 'Cari kontak...' : 'Search contacts...'}
                className="flex-1 min-w-0 bg-transparent text-base outline-none"
              />
              <PixelIcon name="search" size={18} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto lcd-scroll divide-y border-[var(--lcd-fg)]">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-base">
                {language === 'id' ? 'Kontak tidak ditemukan.' : 'No contacts found.'}
              </div>
            ) : (
              filtered.map((c, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                  <button
                    key={c.id ?? c.phone}
                    type="button"
                    onClick={() => {
                      setSelectedIdx(idx);
                      setMode('detail');
                      soundEngine.playCue('click');
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 text-left cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                        : 'hover:bg-[var(--lcd-sec)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PixelIcon name="contacts" size={24} />
                      <span className="text-lg font-bold truncate">{c.name}</span>
                    </div>
                    <span className="text-xs opacity-80 shrink-0">{c.group}</span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {mode === 'detail' && activeContact && (
        <div className="flex-1 overflow-y-auto lcd-scroll p-3 space-y-3">
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-3 flex items-center gap-3">
            <div className="p-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)]">
              <PixelIcon name="contacts" size={40} />
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl font-bold leading-none truncate">{activeContact.name}</h3>
              <p className="text-lg mt-1 tabular-nums">{activeContact.phone}</p>
              <p className="text-sm opacity-80">{activeContact.group}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                openApp('phone', { phoneNumber: activeContact.phone, contactId: activeContact.id })
              }
              className="flex items-center justify-center gap-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] py-1.5 text-base font-bold cursor-pointer"
            >
              <PixelIcon name="phone" size={20} />
              <span>{language === 'id' ? 'Panggil' : 'Call'}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                openApp('messages', { phoneNumber: activeContact.phone, contactId: activeContact.id })
              }
              className="flex items-center justify-center gap-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] py-1.5 text-base font-bold cursor-pointer"
            >
              <PixelIcon name="message" size={20} />
              <span>{language === 'id' ? 'Pesan' : 'Message'}</span>
            </button>
            <button
              type="button"
              onClick={() => startEdit(activeContact)}
              className="border-2 border-[var(--lcd-fg)] py-1 text-base font-bold hover:bg-[var(--lcd-sec)] cursor-pointer"
            >
              {language === 'id' ? 'Ubah' : 'Edit'}
            </button>
            <button
              type="button"
              onClick={() => deleteContact(activeContact)}
              className="border-2 border-[var(--lcd-fg)] py-1 text-base font-bold hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer"
            >
              {language === 'id' ? 'Hapus' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {mode === 'form' && (
        <div className="flex-1 overflow-y-auto lcd-scroll p-3 space-y-2.5">
          <div>
            <label className="block text-sm font-bold">{language === 'id' ? 'Nama' : 'Name'}</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-lg outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold">{language === 'id' ? 'Nomor Telepon' : 'Phone Number'}</label>
            <input
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-lg outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold">{language === 'id' ? 'Grup' : 'Group'}</label>
            <input
              type="text"
              value={groupInput}
              onChange={(e) => setGroupInput(e.target.value)}
              className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-lg outline-none"
            />
          </div>
          <button
            type="button"
            onClick={saveContact}
            className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] py-1.5 text-lg font-bold cursor-pointer"
          >
            {language === 'id' ? 'Simpan Kontak' : 'Save Contact'}
          </button>
        </div>
      )}
    </div>
  );
};
