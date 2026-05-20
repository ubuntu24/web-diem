"use client";

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

type HiddenSubjectRule = {
  id: number;
  msv: string;
  subject_key: string;
  note: string | null;
  created_at: string | null;
};

export default function HiddenSubjectAdmin() {
  const [msv, setMsv] = useState('');
  const [subjectKey, setSubjectKey] = useState('');
  const [note, setNote] = useState('');
  const [list, setList] = useState<HiddenSubjectRule[]>([]);

  const loadList = async (studentMsv: string) => {
    const res = await fetch(`/api/bff/admin/hidden-subjects?msv=${encodeURIComponent(studentMsv)}`);
    if (res.ok) {
      const data = await res.json();
      setList(data);
    } else {
      toast.error('Failed to load hidden subjects');
    }
  };

  const handleHide = async () => {
    const payload = { msv, subject_key: subjectKey, note };
    const res = await fetch('/api/bff/admin/hidden-subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success('Subject hidden');
      await loadList(msv);
    } else {
      toast.error('Hide failed');
    }
  };

  const handleUnhide = async (key: string) => {
    const payload = { msv, subject_key: key };
    const res = await fetch('/api/bff/admin/hidden-subjects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success('Subject unhidden');
      await loadList(msv);
    } else {
      toast.error('Unhide failed');
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin: Manage Hidden Subjects</h1>
      <div className="flex gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder="Student Mã SV"
          value={msv}
          onChange={e => setMsv(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={() => loadList(msv)}
          disabled={!msv}
        >
          Load
        </button>
      </div>
      {list.length > 0 && (
        <table className="table w-full mb-6">
          <thead>
            <tr>
              <th>Subject Key</th>
              <th>Note</th>
              <th>Created At</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id}>
                <td>{r.subject_key}</td>
                <td>{r.note}</td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                <td>
                  <button className="btn btn-sm btn-error" onClick={() => handleUnhide(r.subject_key)}>
                    Unhide
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="border-t pt-4">
        <h2 className="text-xl font-semibold mb-2">Hide New Subject</h2>
        <div className="flex flex-col gap-2">
          <input
            className="input"
            placeholder="Subject Key (e.g., N_MATH101)"
            value={subjectKey}
            onChange={e => setSubjectKey(e.target.value)}
          />
          <input
            className="input"
            placeholder="Optional note"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleHide} disabled={!msv || !subjectKey}>
            Hide Subject
          </button>
        </div>
      </div>
    </div>
  );
}
