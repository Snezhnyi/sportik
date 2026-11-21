import * as XLSX from 'xlsx';
import type { Exercise, Workout } from '../domain/types';
import { elapsedMs } from '../domain/workout';
import { muscleLabel } from '../domain/exerciseLibrary';

/** One row per completed set — easy to pivot in Excel. */
export function historyRows(workouts: Workout[], library: Map<string, Exercise>) {
  const rows: (string | number | null)[][] = [[
    'Дата', 'Программа', 'Блок', 'День', 'Длительность, мин', 'Упражнение', 'Группа мышц', 'Подход', 'Вес, кг', 'Повторения', 'RIR', 'Отдых после, с', 'Заменено вместо', 'Комментарий',
  ]];
  const done = workouts.filter((w) => w.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
  for (const w of done) {
    const minutes = Math.round(elapsedMs(w) / 60000);
    if (!w.exercises.length) rows.push([w.date, w.programName, w.blockName, w.dayName, minutes, '', '', null, null, null, null, null, '', w.comment]);
    for (const e of w.exercises) {
      const ex = library.get(e.exerciseId);
      const original = e.originalExerciseId ? library.get(e.originalExerciseId)?.name ?? '' : '';
      e.sets.filter((s) => s.done).forEach((s, i) => {
        rows.push([
          w.date, w.programName, w.blockName, w.dayName, minutes, e.name, ex ? muscleLabel(ex.primary) : '',
          i + 1, s.weight, s.reps, s.rir, s.restTakenSec, original, i === 0 ? w.comment : '',
        ]);
      });
    }
  }
  return rows;
}

export function exportHistory(workouts: Workout[], library: Map<string, Exercise>, format: 'csv' | 'xlsx') {
  const rows = historyRows(workouts, library);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const name = `sportik-history-${new Date().toISOString().slice(0, 10)}`;
  if (format === 'csv') {
    // BOM + ';' so Russian Excel opens it with correct encoding and columns.
    const csv = '﻿' + XLSX.utils.sheet_to_csv(ws, { FS: ';' });
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
    return;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Подходы');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${name}.xlsx`);
}

function download(blob: Blob, fileName: string) {
  // Telegram's mobile webview ignores <a download>; the system share sheet works there.
  const file = new File([blob], fileName, { type: blob.type });
  if (window.Telegram?.WebApp?.initData && navigator.canShare?.({ files: [file] })) {
    void navigator.share({ files: [file], title: fileName }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
