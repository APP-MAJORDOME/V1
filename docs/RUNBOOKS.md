# Runbooks

## 1. Démarrage local
```bash
cp config/.env.example .env
bash scripts/dev-up.sh
```

## 2. Réinitialisation locale
- arrêter les conteneurs ;
- supprimer les volumes si nécessaire ;
- relancer la stack ;
- reseed si besoin.

## 3. Incident connecteur
Symptômes : sync KO, données incomplètes.
Actions :
1. vérifier les variables d'env ;
2. vérifier l'état du connecteur ;
3. vérifier les logs backend/worker ;
4. désactiver temporairement le connecteur si nécessaire.

## 4. Incident agent
Symptômes : suggestions absurdes, actions incohérentes.
Actions :
1. repasser l'action en mode suggestion uniquement ;
2. vérifier contexte chargé ;
3. inspecter le prompt/tool plan ;
4. revoir les règles dures.

## 5. Incident DB
1. vérifier santé Postgres ;
2. vérifier migrations ;
3. restaurer depuis backup si prod.

## 6. Housekeeping repo
- supprimer fichiers parasites ;
- vérifier README et STATUS_MATRIX ;
- vérifier cohérence docs/code.
