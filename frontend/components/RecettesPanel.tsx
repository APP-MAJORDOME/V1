'use client';

import { useMemo, useState } from 'react';
import { IconMeal } from './md-icons';

export type RecipeRow = {
  id: string;
  title: string;
  emoji: string;
  time: number;
  servings: number;
  ingredients: { label: string; qty?: string }[];
  tags: string[];
};

const DEFAULT_RECIPES: RecipeRow[] = [
  {
    id: 'r1',
    title: 'Pâtes crémeuses aux champignons',
    emoji: '🍝',
    time: 25,
    servings: 4,
    tags: ['rapide', 'veggie'],
    ingredients: [
      { label: 'Pâtes', qty: '400g' },
      { label: 'Champignons', qty: '300g' },
      { label: 'Crème', qty: '20cl' },
      { label: 'Ail', qty: '2 gousses' },
    ],
  },
  {
    id: 'r2',
    title: 'Bol riz / haricots anti-gaspi',
    emoji: '🥗',
    time: 20,
    servings: 3,
    tags: ['anti-gaspi', 'batch'],
    ingredients: [
      { label: 'Riz cuit restant', qty: '300g' },
      { label: 'Haricots rouges', qty: '1 boîte' },
      { label: 'Poivron', qty: '1' },
      { label: 'Œufs', qty: '2' },
    ],
  },
  {
    id: 'r3',
    title: 'Nuggets maison express',
    emoji: '🍗',
    time: 35,
    servings: 4,
    tags: ['enfant'],
    ingredients: [
      { label: 'Blanc de poulet', qty: '500g' },
      { label: 'Chapelure', qty: '100g' },
      { label: 'Yaourt', qty: '1 pot' },
    ],
  },
];

export function RecettesPanel({
  C,
  onAddIngredients,
}: {
  C: Record<string, string>;
  onAddIngredients: (labels: string[]) => void;
}) {
  const [filter, setFilter] = useState<string>('all');
  const tags = ['all', 'rapide', 'anti-gaspi', 'enfant', 'veggie', 'batch'];

  const filtered = useMemo(() => {
    return DEFAULT_RECIPES.filter((r) => filter === 'all' || r.tags.includes(filter));
  }, [filter]);

  return (
    <div style={{ padding: '14px 18px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <IconMeal size={26} color={C.sun} strokeWidth={1.65} />
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.5 }}>CUISINE</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
            Démo locale — sync recettes foyer peut rejoindre l&apos;API plus tard.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              borderRadius: 999,
              border: filter === t ? 'none' : `1px solid ${C.border}`,
              background: filter === t ? C.text : C.white,
              color: filter === t ? '#fff' : C.text2,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: t === 'all' ? 'none' : 'capitalize',
            }}
          >
            {t === 'all' ? 'Toutes' : t}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((r) => (
          <div
            key={r.id}
            style={{
              borderRadius: 18,
              border: `1.5px solid ${C.border}`,
              overflow: 'hidden',
              background: C.white,
            }}
          >
            <div style={{ padding: 14, background: `linear-gradient(135deg, ${C.terraXL}, ${C.lilacL})` }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 36 }}>{r.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: C.text2, marginTop: 4 }}>
                    {r.time} min · {r.servings} pers.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {r.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: C.white,
                          color: C.terra,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, marginBottom: 6 }}>Ingrédients</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.text, lineHeight: 1.55 }}>
                {r.ingredients.map((ing, i) => (
                  <li key={i}>
                    {ing.label}
                    {ing.qty ? ` · ${ing.qty}` : ''}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onAddIngredients(r.ingredients.map((i) => i.label))}
                style={{
                  marginTop: 12,
                  width: '100%',
                  borderRadius: 12,
                  border: 'none',
                  padding: '11px 14px',
                  background: C.sage,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Ajouter à la liste courses ({r.ingredients.length})
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
