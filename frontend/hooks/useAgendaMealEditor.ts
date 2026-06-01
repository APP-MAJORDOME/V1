'use client';

import { useCallback, type MutableRefObject } from 'react';
import type { MealPlan } from '../lib/meals';

export type UseAgendaMealEditorOptions = {
  selectedMealDay: string;
  selectedMeal: MealPlan;
  setMealPlans: React.Dispatch<React.SetStateAction<Record<string, MealPlan>>>;
  mealsDirtyRef: MutableRefObject<boolean>;
  courses: Array<{ label: string }>;
  onAddCourseItem: (label: string) => void;
  onInfo: (message: string) => void;
};

export function useAgendaMealEditor({
  selectedMealDay,
  selectedMeal,
  setMealPlans,
  mealsDirtyRef,
  courses,
  onAddCourseItem,
  onInfo,
}: UseAgendaMealEditorOptions) {
  const patchMeal = useCallback(
    (patch: Partial<MealPlan>) => {
      mealsDirtyRef.current = true;
      setMealPlans((m) => ({
        ...m,
        [selectedMealDay]: { ...selectedMeal, ...patch },
      }));
    },
    [selectedMeal, selectedMealDay, setMealPlans, mealsDirtyRef],
  );

  const onMealLunchChange = useCallback((v: string) => patchMeal({ lunch: v }), [patchMeal]);
  const onMealDinnerChange = useCallback((v: string) => patchMeal({ dinner: v }), [patchMeal]);

  const onMealMissingChange = useCallback(
    (raw: string) => {
      patchMeal({
        missing: raw
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      });
    },
    [patchMeal],
  );

  const onGenerateCoursesFromMeal = useCallback(() => {
    const missingToAdd = selectedMeal.missing.filter(
      (it) => !courses.some((c) => c.label.toLowerCase() === it.toLowerCase()),
    );
    if (missingToAdd.length === 0) {
      onInfo('Aucun ingredient nouveau a ajouter.');
      return;
    }
    for (const it of missingToAdd) onAddCourseItem(it);
    onInfo('Ingredients ajoutes a Courses.');
  }, [selectedMeal.missing, courses, onAddCourseItem, onInfo]);

  return {
    onMealLunchChange,
    onMealDinnerChange,
    onMealMissingChange,
    onGenerateCoursesFromMeal,
  };
}
