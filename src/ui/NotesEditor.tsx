import { useCallback } from 'react';
import type { ActionItem, AgendaSection, MeetingNote } from '../notes/types';
import { css, colors } from './styles';

type Props = {
  note: MeetingNote;
  onChange: (next: MeetingNote) => void;
};

export function NotesEditor({ note, onChange }: Props) {
  const patch = useCallback(
    (p: Partial<MeetingNote>) => onChange({ ...note, ...p, updatedAt: new Date().toISOString() }),
    [note, onChange],
  );

  const updateSection = (id: string, next: Partial<AgendaSection>) => {
    patch({
      agenda: note.agenda.map((s) => (s.id === id ? { ...s, ...next } : s)),
    });
  };

  const updateBullet = (sectionId: string, idx: number, text: string) => {
    updateSection(sectionId, {
      bullets: note.agenda
        .find((s) => s.id === sectionId)!
        .bullets.map((b, i) => (i === idx ? text : b)),
    });
  };

  const removeBullet = (sectionId: string, idx: number) => {
    updateSection(sectionId, {
      bullets: note.agenda.find((s) => s.id === sectionId)!.bullets.filter((_, i) => i !== idx),
    });
  };

  const addSection = () => {
    patch({
      agenda: [
        ...note.agenda,
        { id: crypto.randomUUID(), heading: '새 안건', bullets: [''] },
      ],
    });
  };

  const removeSection = (id: string) => {
    patch({ agenda: note.agenda.filter((s) => s.id !== id) });
  };

  const updateAction = (id: string, next: Partial<ActionItem>) => {
    patch({
      actionItems: note.actionItems.map((a) => (a.id === id ? { ...a, ...next } : a)),
    });
  };

  const removeAction = (id: string) => {
    patch({ actionItems: note.actionItems.filter((a) => a.id !== id) });
  };

  const addAction = () => {
    patch({
      actionItems: [...note.actionItems, { id: crypto.randomUUID(), text: '' }],
    });
  };

  return (
    <div style={editorStyles.container}>
      <div style={editorStyles.row}>
        <label style={css.field}>
          제목
          <input
            style={editorStyles.input}
            value={note.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
      </div>
      <div style={editorStyles.metaRow}>
        <label style={css.field}>
          일자
          <input
            style={editorStyles.input}
            type="date"
            value={note.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
        </label>
        <label style={css.field}>
          시각
          <input
            style={editorStyles.input}
            type="time"
            value={note.time}
            onChange={(e) => patch({ time: e.target.value })}
          />
        </label>
        <label style={{ ...css.field, flex: 1 }}>
          참석자 (쉼표 구분)
          <input
            style={editorStyles.input}
            value={note.attendees.join(', ')}
            onChange={(e) =>
              patch({
                attendees: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="예: 김철수, 이영희"
          />
        </label>
      </div>

      <h3 style={editorStyles.section}>안건 ({note.agenda.length})</h3>
      {note.agenda.map((s) => (
        <div key={s.id} style={editorStyles.card}>
          <div style={editorStyles.cardHeader}>
            <input
              style={{ ...editorStyles.input, fontWeight: 600 }}
              value={s.heading}
              onChange={(e) => updateSection(s.id, { heading: e.target.value })}
            />
            <button style={editorStyles.iconBtn} onClick={() => removeSection(s.id)} aria-label="섹션 삭제">
              ×
            </button>
          </div>
          {s.bullets.map((b, i) => (
            <div key={i} style={editorStyles.bulletRow}>
              <span style={editorStyles.bulletDot}>•</span>
              <input
                style={editorStyles.input}
                value={b}
                onChange={(e) => updateBullet(s.id, i, e.target.value)}
              />
              <button
                style={editorStyles.iconBtn}
                onClick={() => removeBullet(s.id, i)}
                aria-label="항목 삭제"
              >
                ×
              </button>
            </div>
          ))}
          <button
            style={editorStyles.addBtn}
            onClick={() =>
              updateSection(s.id, { bullets: [...s.bullets, ''] })
            }
          >
            + 항목 추가
          </button>
        </div>
      ))}
      <button style={editorStyles.addBtn} onClick={addSection}>
        + 안건 추가
      </button>

      <h3 style={editorStyles.section}>액션 아이템 ({note.actionItems.length})</h3>
      {note.actionItems.map((a) => (
        <div key={a.id} style={editorStyles.actionRow}>
          <input
            style={{ ...editorStyles.input, flex: 2 }}
            value={a.text}
            placeholder="할 일"
            onChange={(e) => updateAction(a.id, { text: e.target.value })}
          />
          <input
            style={{ ...editorStyles.input, flex: 1 }}
            value={a.owner ?? ''}
            placeholder="담당"
            onChange={(e) => updateAction(a.id, { owner: e.target.value })}
          />
          <input
            style={{ ...editorStyles.input, flex: 1 }}
            type="date"
            value={a.due ?? ''}
            onChange={(e) => updateAction(a.id, { due: e.target.value })}
          />
          <button style={editorStyles.iconBtn} onClick={() => removeAction(a.id)} aria-label="액션 삭제">
            ×
          </button>
        </div>
      ))}
      <button style={editorStyles.addBtn} onClick={addAction}>
        + 액션 아이템 추가
      </button>
    </div>
  );
}

const editorStyles = {
  container: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'flex', gap: 12 },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  input: {
    padding: '8px 10px',
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    fontSize: 14,
    background: colors.surface,
    color: colors.text,
    minWidth: 0,
    width: '100%',
  } as const,
  section: { margin: '12px 0 4px', fontSize: 16, fontWeight: 700 },
  card: {
    padding: 12,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    background: colors.surface,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  cardHeader: { display: 'flex', gap: 6, alignItems: 'center' },
  bulletRow: { display: 'flex', gap: 6, alignItems: 'center' },
  bulletDot: { color: colors.faint, minWidth: 12 },
  actionRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const },
  iconBtn: {
    width: 32,
    height: 32,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 18,
    color: colors.muted,
  },
  addBtn: {
    alignSelf: 'flex-start',
    padding: '6px 12px',
    border: `1px dashed ${colors.border}`,
    background: 'transparent',
    color: colors.muted,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
  },
} as const;
