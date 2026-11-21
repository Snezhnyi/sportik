import { useCallback } from 'react';
import { all } from '../../../data/store';
import { libraryNow, saveWorkout } from '../../../data/repo';
import { createWorkout } from '../../../domain/workout';
import type { SequenceItem } from '../../../domain/schedule';
import type { Program } from '../../../domain/types';
import { useNav } from '../../nav';
import { useUi } from '../../components/common';
import { haptic } from '../../../telegram/tg';

/** Creates a workout draft from a program session and opens the runner. Only one workout can run at a time. */
export function useStartWorkout() {
  const nav = useNav();
  const ui = useUi();
  return useCallback(async (program: Program, item: SequenceItem) => {
    if (all('workout').some((w) => w.status === 'in_progress')) {
      ui.toast('Сначала завершите текущую тренировку');
      nav.push({ name: 'run' });
      return;
    }
    const w = createWorkout(program, item, {
      exercises: new Map(libraryNow().map((e) => [e.id, e])),
      workouts: all('workout'),
      recommendations: all('recommendation'),
    });
    await saveWorkout(w);
    haptic.impact();
    nav.push({ name: 'run' });
  }, [nav, ui]);
}
