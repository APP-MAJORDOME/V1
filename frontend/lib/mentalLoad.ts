/** Météo mentale & charge — libellés utilisateur (Sprint 2). */

export type MentalWeatherLevel = 'calm' | 'moderate' | 'heavy';

export type MentalWeather = {
  level: MentalWeatherLevel;
  message: string;
  bg: string;
  accent: string;
};

export function computeMentalWeather(input: {
  urgentCount: number;
  openTasksCount: number;
  fridgeExpiredCount: number;
}): MentalWeather {
  const score =
    input.urgentCount * 2 + Math.min(input.openTasksCount, 10) + input.fridgeExpiredCount * 2;

  if (score >= 8 || input.urgentCount >= 3) {
    return {
      level: 'heavy',
      message:
        input.urgentCount > 0
          ? `${input.urgentCount} urgence(s) — Alfred peut t’aider`
          : 'Journée chargée — Alfred peut t’aider',
      bg: '#F5E8E6',
      accent: '#B85450',
    };
  }
  if (score >= 3 || input.openTasksCount >= 4 || input.fridgeExpiredCount > 0) {
    const n = input.urgentCount + input.fridgeExpiredCount + Math.min(input.openTasksCount, 3);
    return {
      level: 'moderate',
      message: n > 0 ? `${n} chose(s) à régler ce matin` : 'Quelques points à surveiller',
      bg: '#FFF4E8',
      accent: '#D4956A',
    };
  }
  return {
    level: 'calm',
    message: 'Tu peux souffler aujourd’hui',
    bg: '#E8F0E6',
    accent: '#8FAF8A',
  };
}
